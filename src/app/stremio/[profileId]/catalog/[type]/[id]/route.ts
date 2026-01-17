import { NextRequest, NextResponse } from 'next/server';
import { getProfile } from '@/lib/settings';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { mapTraktItemToMeta, StremioMeta } from '@/lib/stremio';
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

function shuffleItems<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ profileId: string; type: string; id: string }> }
) {
  const { profileId, type, id } = await params;
  const catalogId = id.replace('.json', '');
  const sortParam = request.nextUrl.searchParams.get('sort');

  logger.info(`Stremio Catalog Request: ${catalogId} (${type}) | Profile: ${profileId}`);

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

        // Override sortBy with per-list preference
        if (savedFilters.sortPreferences && savedFilters.sortPreferences[catalogId]) {
          filters.sortBy = savedFilters.sortPreferences[catalogId] as 'newest' | 'oldest' | 'title' | 'title_z_a' | 'rating_desc' | 'rating_asc' | 'random';
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
  if (sortParam && (sortParam === 'newest' || sortParam === 'oldest' || sortParam === 'title' || sortParam === 'title_z_a' || sortParam === 'rating_desc' || sortParam === 'rating_asc' || sortParam === 'random')) {
    filters.sortBy = sortParam as 'newest' | 'oldest' | 'title' | 'title_z_a' | 'rating_desc' | 'rating_asc' | 'random';
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

  if (finalFilters.sortBy === 'random') {
    items = shuffleItems(items);
  }

    // Map to Stremio format
    const origin = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;
    const metas: StremioMeta[] = items.map((item: CatalogItem) => (
      mapTraktItemToMeta(item, type, rpdbKey, origin, catalogId, true, profileId)
    ));

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
