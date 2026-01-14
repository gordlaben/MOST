import { NextRequest, NextResponse } from 'next/server';
import { TraktClient, TraktShow, TraktMovie, TraktBingeReadyShow, TraktEpisodeLeftShow } from '@/lib/trakt';
import { getTraktCredentials, getProfile } from '@/lib/settings';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { cacheImage } from '@/lib/images';
import { mapTraktItemToMeta, StremioMeta } from '@/lib/stremio';

// In-memory lock to prevent concurrent refreshes
const refreshLocks: Record<string, boolean> = {};

interface CatalogFilters {
  includeEnded?: boolean;
  includeCanceled?: boolean;
  includeReturning?: boolean;
  sortBy?: 'newest' | 'oldest' | 'title' | 'title_z_a';
  forceRefresh?: boolean;
}

type CatalogItem = 
  | TraktBingeReadyShow 
  | TraktEpisodeLeftShow 
  | { show?: TraktShow; movie?: TraktMovie; [key: string]: unknown };

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



async function refreshCatalog(catalogId: string, cacheKey: string, filters: CatalogFilters, profileId: string, username?: string) {
  if (refreshLocks[cacheKey]) {
    logger.debug(`Refresh already in progress for ${cacheKey}`);
    return;
  }
  
  refreshLocks[cacheKey] = true;
  logger.info(`Starting background refresh for ${cacheKey}`);

  try {
    const { clientId, clientSecret, accessToken } = await getTraktCredentials(profileId);

    if (!accessToken) {
      logger.warn('Cannot refresh catalog: No access token');
      return;
    }

    const trakt = new TraktClient(
      clientId || process.env.TRAKT_CLIENT_ID || '',
      clientSecret || process.env.TRAKT_CLIENT_SECRET || '',
      process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
      accessToken
    );

    let items: CatalogItem[] = [];
    if (catalogId === 'binge_ready') {
      // Pass empty callback for progress
      items = await trakt.getBingeReadyShows(() => {}, filters);
    } else if (catalogId === 'episodes_left') {
      // Pass empty callback for progress
      items = await trakt.getEpisodesLeftShows(() => {}, filters);
    } else {
      // Personal List
      const listItems = await trakt.getListItems(
          catalogId, 
          username, 
          false, 
          undefined, 
          filters.sortBy, 
          {
             includeEnded: filters.includeEnded ?? true,
             includeCanceled: filters.includeCanceled ?? true,
             includeReturning: filters.includeReturning ?? true
          }
      );
      
      if (Array.isArray(listItems)) {
        // Map Trakt items to our format
        items = listItems
          .filter((item: CatalogItem) => ('show' in item && item.show) || ('movie' in item && item.movie))
          .map((item: CatalogItem) => {
            const content = ('show' in item && item.show) ? item.show : ('movie' in item && item.movie ? item.movie : null);
            if (!content) throw new Error('Invalid item');
            return {
              show: { // Keeping 'show' key for compatibility, but it can be a movie
                title: content.title,
                year: content.year,
                ids: content.ids,
                images: content.images,
                status: content.status,
                type: 'movie' in item ? 'movie' : 'show'
              },
              // For lists, we don't have specific episode info usually
              nextEpisode: null,
              season: null
            };
          }) as unknown as CatalogItem[];
      } else {
          logger.warn(`getListItems returned non-array for ${catalogId}`);
      }
    }
    
    await prisma.calendarCache.upsert({
      where: { id: cacheKey },
      update: {
        data: JSON.stringify(items),
        updatedAt: new Date(),
      },
      create: {
        id: cacheKey,
        data: JSON.stringify(items),
        updatedAt: new Date(),
      },
    });

    // Cache images in background
    (async () => {
      try {
        logger.info(`Starting background image caching for ${cacheKey}`);
        let count = 0;
        for (const item of items) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const content = (('show' in item && item.show) || ('movie' in item && item.movie) || item) as any;
          if (content?.images?.poster) {
             let posterUrl = '';
             if (Array.isArray(content.images.poster) && content.images.poster.length > 0) {
                posterUrl = content.images.poster[0];
             } else if (!Array.isArray(content.images.poster) && typeof content.images.poster === 'object' && content.images.poster.thumb) {
                posterUrl = content.images.poster.thumb;
             } else if (typeof content.images.poster === 'string') {
                posterUrl = content.images.poster;
             }

             if (posterUrl) {
               await cacheImage(posterUrl);
               count++;
             }
          }
        }
        logger.info(`Cached ${count} images for ${cacheKey}`);
      } catch (e) {
        logger.error(`Failed to cache images for ${cacheKey}`, e);
      }
    })();
    
    logger.info(`Background refresh completed for ${cacheKey}`);
  } catch (error) {
    logger.error(`Background refresh failed for ${cacheKey}`, error);
  } finally {
    refreshLocks[cacheKey] = false;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ profileId: string; type: string; ids: string[] }> }
) {
  const { profileId, type, ids } = await params;
  
  logger.info(`Stremio Catalog Request (Extended): ${ids.join('/')} (${type}) | Profile: ${profileId}`);

  const origin = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;
  
  if (type !== 'series' && type !== 'movie') {
    return NextResponse.json({ metas: [] }, {
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  }

  // Handle Search
  if (ids[0] === 'most_search' || ids[0] === 'most_search.json') {
      const searchParam = ids.find(p => p.startsWith('search='));
      if (!searchParam) {
          return NextResponse.json({ metas: [] }, { headers: { 'Access-Control-Allow-Origin': '*' } });
      }

      const query = decodeURIComponent(searchParam.replace('search=', '').replace('.json', ''));
      
      try {
        const { clientId, clientSecret, accessToken } = await getTraktCredentials(profileId);
        if (!accessToken) {
            return NextResponse.json({ metas: [] }, { headers: { 'Access-Control-Allow-Origin': '*' } });
        }

        const trakt = new TraktClient(
            clientId || process.env.TRAKT_CLIENT_ID || '',
            clientSecret || process.env.TRAKT_CLIENT_SECRET || '',
            process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
            accessToken
        );

        const searchResults = await trakt.search(query, type === 'series' ? 'show' : 'movie');
        
        // Get RPDB Key if available
        let rpdbKey = 't0-free-rpdb';
        const profile = await getProfile(profileId);
        if (profile && profile.rpdbKey) {
            rpdbKey = profile.rpdbKey;
        }

        const metas = searchResults.map((item: CatalogItem) => 
            mapTraktItemToMeta(item, type, rpdbKey, origin, undefined, false)
        );

        return NextResponse.json({ metas }, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': '*',
                'Cache-Control': 'max-age=3600' // Cache search results for 1 hour
            }
        });

      } catch (e) {
          logger.error('Search failed', e);
          return NextResponse.json({ metas: [] }, { headers: { 'Access-Control-Allow-Origin': '*' } });
      }
  }

  // Handle Regular Lists
  const catalogId = ids[0].replace('.json', '');

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
        
        // Override sortBy with per-list preference
        if (savedFilters.sortPreferences && savedFilters.sortPreferences[catalogId]) {
             filters.sortBy = savedFilters.sortPreferences[catalogId] as 'newest' | 'oldest' | 'title' | 'title_z_a';
        }
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

  // Handle Sort Param from URL (Overrides profile settings)
  if (ids.length > 1) {
    const sortParam = ids.find(p => p.startsWith('sort='));
    if (sortParam) {
      const val = sortParam.replace('sort=', '').replace('.json', '');
      if (val === 'newest' || val === 'oldest' || val === 'title' || val === 'title_z_a') {
         filters.sortBy = val as 'newest' | 'oldest' | 'title' | 'title_z_a';
      }
    }
  }

  // Ensure strict key order for cache key consistency with API routes
  const finalFilters = {
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
  let shouldRefresh = false;

  if (cached) {
    try {
      items = JSON.parse(cached.data);
      const cacheAge = Date.now() - cached.updatedAt.getTime();
      if (cacheAge > 24 * 60 * 60 * 1000) {
        shouldRefresh = true;
      }
      // Safety: If we have a cached list but it's empty, try to refresh it
      // This fixes issues where a previous failed attempt might have cached an empty result
      if (items.length === 0) {
        shouldRefresh = true;
      }
    } catch {
      shouldRefresh = true;
    }
  } else {
    shouldRefresh = true;
  }

  if (shouldRefresh) {
    refreshCatalog(catalogId, cacheKey, finalFilters, profileId, username).catch(e => logger.error('Background refresh trigger failed', e));
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
    const metas = items.map((item: CatalogItem) => 
        mapTraktItemToMeta(item, type, rpdbKey, origin, catalogId, true)
    );

  // Inject user-defined placeholder if configured
  if (profileId && !shouldRefresh) { // Only inject if we are serving content, not just for cache priming? Actually, we want it always.
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
                      type: type, // Matches the catalog type (movie/series)
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
      id: 'bingarr_scanning_placeholder',
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
