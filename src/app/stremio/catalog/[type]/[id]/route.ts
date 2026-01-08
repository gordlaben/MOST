import { NextRequest, NextResponse } from 'next/server';
import { TraktClient, TraktBingeReadyShow, TraktEpisodeLeftShow } from '@/lib/trakt';
import { getTraktCredentials, getSetting } from '@/lib/settings';
import { StremioMeta } from '@/lib/stremio';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// In-memory lock to prevent concurrent refreshes
const refreshLocks: Record<string, boolean> = {};

interface CatalogFilters {
  includeEnded?: boolean;
  includeCanceled?: boolean;
  includeReturning?: boolean;
  sortBy?: 'newest' | 'oldest' | 'title';
  forceRefresh?: boolean;
}

type CatalogItem = TraktBingeReadyShow | TraktEpisodeLeftShow;

async function refreshCatalog(catalogId: string, cacheKey: string, filters: CatalogFilters) {
  if (refreshLocks[cacheKey]) {
    logger.debug(`Refresh already in progress for ${cacheKey}`);
    return;
  }
  
  refreshLocks[cacheKey] = true;
  logger.info(`Starting background refresh for ${cacheKey}`);

  try {
    const { clientId, clientSecret, accessToken } = await getTraktCredentials();

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

    let shows: (TraktBingeReadyShow | TraktEpisodeLeftShow)[] = [];
    if (catalogId === 'binge_ready') {
      shows = await trakt.getBingeReadyShows(undefined, filters);
    } else {
      shows = await trakt.getEpisodesLeftShows(undefined, filters);
    }
    
    await prisma.calendarCache.upsert({
      where: { id: cacheKey },
      update: {
        data: JSON.stringify(shows),
        updatedAt: new Date(),
      },
      create: {
        id: cacheKey,
        data: JSON.stringify(shows),
        updatedAt: new Date(),
      },
    });
    
    logger.info(`Background refresh completed for ${cacheKey}`);
  } catch (error) {
    logger.error(`Background refresh failed for ${cacheKey}`, error);
  } finally {
    refreshLocks[cacheKey] = false;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  const { type, id } = await params;
  const catalogId = id.replace('.json', '');

  if (type !== 'series' || (catalogId !== 'binge_ready' && catalogId !== 'episodes_left')) {
    return NextResponse.json({ metas: [] }, {
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  }

  // Get Default Filters
  const includeEnded = (await getSetting('FILTER_INCLUDE_ENDED')) !== 'false';
  const includeCanceled = (await getSetting('FILTER_INCLUDE_CANCELED')) !== 'false';
  const includeReturning = (await getSetting('FILTER_INCLUDE_RETURNING')) !== 'false';
  const sortBy = (await getSetting('FILTER_SORT_BY')) as 'newest' | 'oldest' | 'title' || 'newest';

  const filters = { includeEnded, includeCanceled, includeReturning, sortBy };
  const baseKey = catalogId === 'binge_ready' ? 'binge-ready-shows' : 'episodes-left-shows';
  const cacheKey = `${baseKey}-${JSON.stringify(filters)}`;

  // Check cache first
  const cached = await prisma.calendarCache.findUnique({
    where: { id: cacheKey },
  });

  let shows: CatalogItem[] = [];
  let shouldRefresh = false;

  if (cached) {
    try {
      shows = JSON.parse(cached.data);
      const cacheAge = Date.now() - cached.updatedAt.getTime();
      // If cache is older than 24 hours, mark for refresh but still serve it
      if (cacheAge > 24 * 60 * 60 * 1000) {
        shouldRefresh = true;
        logger.debug(`Cache expired for ${cacheKey}, serving stale data and refreshing in background`);
      } else {
        logger.debug(`Serving valid cache for ${cacheKey}`);
      }
    } catch {
      logger.warn('Failed to parse cached shows for Stremio');
      shouldRefresh = true;
    }
  } else {
    shouldRefresh = true;
    logger.debug(`No cache for ${cacheKey}, returning empty and refreshing in background`);
  }

  if (shouldRefresh) {
    // Trigger background refresh without awaiting
    refreshCatalog(catalogId, cacheKey, filters).catch(e => logger.error('Background refresh trigger failed', e));
  }

  // Get RPDB Key (default to free tier if not set)
  const rpdbKey = (await getSetting('RPDB_API_KEY')) || 't0-free-rpdb';

  // Map to Stremio format
      const metas: StremioMeta[] = shows.map((item: CatalogItem) => {
    const show = item.show;
    let poster = null;
    
    if (show.images?.poster) {
      if (Array.isArray(show.images.poster) && show.images.poster.length > 0) {
        poster = show.images.poster[0];
      } else if (!Array.isArray(show.images.poster) && typeof show.images.poster === 'object' && show.images.poster.thumb) {
        poster = show.images.poster.thumb;
      } else if (typeof show.images.poster === 'string') {
        poster = show.images.poster;
      }
    }

    // Ensure protocol
    if (poster && !poster.startsWith('http')) {
      poster = `https://${poster}`;
    }

    // RPDB Override
    if (rpdbKey && rpdbKey !== 'disabled' && show.ids) {
      // Log first poster for debugging
      if (metas.length === 0) {
        logger.debug(`Generating RPDB poster with key: ${rpdbKey}`);
      }

      if (show.ids.imdb) {
        poster = `https://api.ratingposterdb.com/${rpdbKey}/imdb/poster-default/${show.ids.imdb}.jpg`;
      } else if (show.ids.tmdb) {
        poster = `https://api.ratingposterdb.com/${rpdbKey}/tmdb/poster-default/${show.ids.tmdb}.jpg`;
      } else if (show.ids.tvdb) {
        poster = `https://api.ratingposterdb.com/${rpdbKey}/tvdb/poster-default/${show.ids.tvdb}.jpg`;
      }
    }

    const description = catalogId === 'binge_ready'
      ? `Season ${item.latestSeason} is ready to binge! (${item.totalEpisodes} episodes)`
      : `${(item.totalEpisodes || 0) - item.watchedEpisodes} episodes left to watch. Last watched: ${new Date(item.releaseDate || 0).toLocaleDateString('de-DE')}`;

    return {
      id: show.ids.imdb || `tt${show.ids.tmdb}` || `trakt:${show.ids.trakt}`,
      type: 'series',
      name: show.title,
      poster: poster,
      description: description,
      releaseInfo: `${item.latestSeason}`,
    };
  });

  // UX Improvement: If we have no shows and no cache (first run), show a "Scanning" placeholder
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

  return NextResponse.json({ metas }, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Cache-Control': 'no-cache, no-store, must-revalidate' // Don't let Stremio/browser cache the response itself too aggressively, so it asks again
    }
  });
}
