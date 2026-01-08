import { NextRequest, NextResponse } from 'next/server';
import { TraktBingeReadyShow, TraktEpisodeLeftShow } from '@/lib/trakt';
import { getProfile } from '@/lib/settings';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { StremioMeta } from '@/lib/stremio';
import { CatalogFilters, CatalogItem, refreshCatalog } from '@/lib/catalog';

interface SelectedList {
  id: string;
  name: string;
  owner?: string;
  placeholder?: {
    enabled: boolean;
    poster: string;
    title?: string;
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ profileId: string; type: string; id: string }> }
) {
  const { profileId, type, id } = await params;
  const catalogId = id.replace('.json', '');

  if (type !== 'series' && type !== 'movie') {
    return NextResponse.json({ metas: [] }, {
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  }

  // System lists are series only
  if ((catalogId === 'binge_ready' || catalogId === 'episodes_left') && type === 'movie') {
    return NextResponse.json({ metas: [] }, {
        headers: { 'Access-Control-Allow-Origin': '*' }
    });
  }

  // Get Profile Filters
  // Default filters matching API route defaults
  let filters: CatalogFilters = {
    includeEnded: true,
    includeCanceled: true,
    includeReturning: true,
    sortBy: 'newest'
  };
  
  let rpdbKey = 't0-free-rpdb';
  let username: string | undefined = undefined;

  if (profileId) {
    const profile = await getProfile(profileId);
    if (profile) {
      if (profile.filters) {
        const savedFilters = JSON.parse(profile.filters);
        filters = { ...filters, ...savedFilters };
      }
      if (profile.rpdbKey) {
        rpdbKey = profile.rpdbKey;
      }
      if (profile.selectedLists) {
        try {
          const lists = JSON.parse(profile.selectedLists) as SelectedList[];
          const list = lists.find((l) => l.id === catalogId);
          if (list && list.owner) {
            username = list.owner;
          }
        } catch {
          // ignore
        }
      }
    } else {
        // Profile not found
        return NextResponse.json({ metas: [] }, { headers: { 'Access-Control-Allow-Origin': '*' } });
    }
  }

  // Ensure strict key order for cache key consistency with API routes
  const finalFilters: CatalogFilters = {
    includeEnded: filters.includeEnded,
    includeCanceled: filters.includeCanceled,
    includeReturning: filters.includeReturning,
    sortBy: filters.sortBy
  };

  let baseKey = '';
  if (catalogId === 'binge_ready') {
      baseKey = 'binge-ready-shows';
  } else if (catalogId === 'episodes_left') {
      baseKey = 'episodes-left-shows';
  } else {
      baseKey = `list-${catalogId}`;
  }

  // Match the cache key format used in API routes: `binge-ready-shows-${profileId}-${JSON.stringify(filters)}`
  const cacheKey = `${baseKey}-${profileId}-${JSON.stringify(finalFilters)}`;

  // Check cache first
  const cached = await prisma.calendarCache.findUnique({
    where: { id: cacheKey },
  });

  let items: CatalogItem[] = [];
  
  // Logic: 
  // 1. If no cache or corrupt cache -> Wait for fresh data
  // 2. If cached but empty -> Wait for fresh data
  // 3. If cached and valid but stale (>24h) -> Return stale, refresh in background
  // 4. If cached and valid and fresh -> Return it

  let needsImmediateRefresh = false;

  if (!cached) {
    needsImmediateRefresh = true;
  } else {
    try {
      items = JSON.parse(cached.data);
      
      const cacheAge = Date.now() - cached.updatedAt.getTime();
      const isStale = cacheAge > 24 * 60 * 60 * 1000;
      const isEmpty = items.length === 0;

      if (isEmpty) {
        needsImmediateRefresh = true;
      } else if (isStale) {
        // Return stale content immediately, refresh in background
        refreshCatalog(catalogId, cacheKey, finalFilters, profileId, username).catch(e => logger.error('Background refresh trigger failed', e));
      }
    } catch {
      // Corrupt JSON
      needsImmediateRefresh = true;
    }
  }

  if (needsImmediateRefresh) {
    // Await the data fetch so we never return an empty list if possible
    try {
        await refreshCatalog(catalogId, cacheKey, finalFilters, profileId, username);
        
        // Re-fetch from DB after refresh
        const freshCache = await prisma.calendarCache.findUnique({
        where: { id: cacheKey },
        });
        
        if (freshCache) {
        items = JSON.parse(freshCache.data);
        }
    } catch (e) {
        logger.error('Immediate refresh failed', e);
        // Fallback to empty if everything explodes
    }
  }

  // Filter by type if it's a personal list (system lists are already filtered by logic above)
  if (catalogId !== 'binge_ready' && catalogId !== 'episodes_left') {
      items = items.filter((item: CatalogItem) => {
          // Handle normalized format (where everything is in 'show' but has a type property)
          if ('show' in item && item.show && 'type' in item.show) {
              if (item.show.type === 'movie') return type === 'movie';
              if (item.show.type === 'show') return type === 'series';
          }

          // Legacy/Fallback checks
          if ('show' in item && item.show) return type === 'series';
          if ('movie' in item && item.movie) return type === 'movie';
          return false;
      });
  }

    // Map to Stremio format
    const metas: StremioMeta[] = items.map((item: CatalogItem) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const content = (item as any).show || (item as any).movie || item;
      let poster = null;
      
      if (content.images?.poster) {
        if (Array.isArray(content.images.poster) && content.images.poster.length > 0) {
          poster = content.images.poster[0];
        } else if (!Array.isArray(content.images.poster) && typeof content.images.poster === 'object' && content.images.poster.thumb) {
          poster = content.images.poster.thumb;
        } else if (typeof content.images.poster === 'string') {
          poster = content.images.poster;
        }
      }
  
      if (poster && !poster.startsWith('http')) {
        poster = `https://${poster}`;
      }
  
      if (rpdbKey && rpdbKey !== 'disabled' && content.ids) {
        if (content.ids.imdb) {
          poster = `https://api.ratingposterdb.com/${rpdbKey}/imdb/poster-default/${content.ids.imdb}.jpg`;
        } else if (content.ids.tmdb) {
          poster = `https://api.ratingposterdb.com/${rpdbKey}/tmdb/poster-default/${content.ids.tmdb}.jpg`;
        } else if (content.ids.tvdb) {
          poster = `https://api.ratingposterdb.com/${rpdbKey}/tvdb/poster-default/${content.ids.tvdb}.jpg`;
        }
      }
  
      // Use local proxy for caching
      if (poster) {
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;
          poster = `${baseUrl}/api/image?url=${encodeURIComponent(poster)}`;
      }
  
      let description = '';
      if (catalogId === 'binge_ready') {
          const brItem = item as TraktBingeReadyShow;
          description = `Season ${brItem.latestSeason} is ready to binge! (${brItem.totalEpisodes} episodes)`;
      } else if (catalogId === 'episodes_left') {
          const elItem = item as TraktEpisodeLeftShow;
          description = `${(elItem.totalEpisodes || 0) - elItem.watchedEpisodes} episodes left to watch. Last watched: ${new Date(elItem.releaseDate).toLocaleDateString('de-DE')}`;
      } else {
          description = content.year ? `${content.year}` : '';
      }
  
      return {
        id: content.ids.imdb || `tt${content.ids.tmdb}` || `trakt:${content.ids.trakt}`,
        type: type,
        name: content.title,
        poster: poster,
        description: description,
        releaseInfo: catalogId === 'binge_ready' || catalogId === 'episodes_left' ? `${item.latestSeason}` : (content.year ? `${content.year}` : ''),
      };
    });

  // Inject user-defined placeholder if configured
  if (profileId) {
      try {
          const profile = await getProfile(profileId);
          if (profile && profile.selectedLists) {
              const lists = JSON.parse(profile.selectedLists) as SelectedList[];
              const currentList = lists.find((l) => l.id === catalogId);
              
              if (currentList && currentList.placeholder && currentList.placeholder.enabled) {
                  const ph = currentList.placeholder;
                  
                  // Resolve poster URL (handle local relative paths)
                  let posterUrl = ph.poster || 'https://placehold.co/600x900/1a1a1a/ffffff/png?text=List';
                  
                  let origin = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;
                  // Remove trailing slash if present
                  if (origin.endsWith('/')) {
                      origin = origin.slice(0, -1);
                  }

                  if (posterUrl.startsWith('/')) {
                      // Already relative path (e.g. upload), just prepend origin
                      posterUrl = `${origin}${posterUrl}`;
                  } else if (posterUrl.includes('/api/image/upload/')) {
                      // Fix absolute URLs for uploads that might have wrong domain
                      const relativePath = posterUrl.substring(posterUrl.indexOf('/api/image/upload/'));
                      posterUrl = `${origin}${relativePath}`;
                  } else if (posterUrl.startsWith('http')) {
                      // Only proxy if not already using our proxy to avoid recursion
                      if (!posterUrl.includes('/api/image?url=')) {
                        posterUrl = `${origin}/api/image?url=${encodeURIComponent(posterUrl)}`;
                      }
                  }

                  // User requested test: use Real IMDB IDs to fix poster loading issues
                  // Inception for movies, The Office for series
                  const fakeId = type === 'movie' ? 'tt1375666' : 'tt0386676';

                  metas.unshift({
                      id: fakeId,
                      type: type,
                      name: ph.title || currentList.name,
                      poster: posterUrl,
                      description: `Placeholder for ${currentList.name}`,
                      releaseInfo: 'LIST',
                      background: posterUrl
                  });
              }
          }
      } catch (e) {
          logger.error('Error injecting placeholder', e);
      }
  }

  if (metas.length === 0 && !cached) {
    metas.push({
      id: 'most_scanning_placeholder',
      type: 'series',
      name: 'ℹ️ Scanning Library...',
      poster: 'https://placehold.co/600x900/1a1a1a/ffffff/png?text=Scanning...',
      description: 'Your library is currently being scanned in the background. This may take a few minutes depending on your library size. Please wait a moment and then refresh this list.',
      releaseInfo: 'Status',
    });
  }

  const responseBody: { metas: StremioMeta[]; cacheMaxAge?: number; staleRevalidate?: number; staleError?: number; } = { metas };

  if (metas.length === 1 && metas[0].id === 'bingarr_scanning_placeholder') {
      // Do not cache the placeholder
      responseBody.cacheMaxAge = 0;
      responseBody.staleRevalidate = 0;
      responseBody.staleError = 0;
  } else {
      // Cache valid results
      responseBody.cacheMaxAge = 3600; // 1 hour
      responseBody.staleRevalidate = 14400; // 4 hours
      responseBody.staleError = 14400; // 4 hours
  }

  return NextResponse.json(responseBody, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  });
}
