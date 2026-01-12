import { TraktClient, TraktShow, TraktMovie, TraktBingeReadyShow, TraktEpisodeLeftShow } from '@/lib/trakt';
import { getTraktCredentials } from '@/lib/settings';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { cacheImage } from '@/lib/images';

export interface CatalogFilters {
  includeEnded?: boolean;
  includeCanceled?: boolean;
  includeReturning?: boolean;
  sortBy?: 'newest' | 'oldest' | 'title';
  forceRefresh?: boolean;
}

export type CatalogItem = 
  | TraktBingeReadyShow 
  | TraktEpisodeLeftShow 
  | { show?: TraktShow; movie?: TraktMovie; [key: string]: unknown };


// In-memory lock to prevent concurrent refreshes
const refreshLocks: Record<string, boolean> = {};

export async function detectAndUpdateListTypes(profileId: string, lists: any[], forceUpdate = false) {
  let updated = false;
  try {
    const { clientId, clientSecret, accessToken } = await getTraktCredentials(profileId);
    
    if (!accessToken || !clientId || !clientSecret) return lists;

    const trakt = new TraktClient(clientId, clientSecret, '', accessToken);

    logger.info(`Starting list type detection for profile ${profileId} (force=${forceUpdate})`);

    // Process serially to avoid rate limits? Or parallel?
    // Parallel is risky for Trakt API rate limits if many lists.
    for (const list of lists) {
        if (list.enabled === false) continue; // Skip disabled lists

        if (list.type !== 'system' && (!list.content_type || forceUpdate)) {
             try {
                // Special handling for Watchlist: Always mixed
                if (list.id === 'watchlist') {
                    if (list.content_type !== 'mixed') {
                         list.content_type = 'mixed';
                         updated = true;
                         logger.info(`Forced type 'mixed' for list ${list.name} (${list.id})`);
                    }
                    continue;
                }

                 const listOwner = list.type === 'custom' ? list.owner : undefined;
                 
                 // Fetch limiting to small amount to detect type efficiently? 
                 // We need to find at least one movie and one show.
                 // Fetching full list might be overkill if it's huge. 
                 // Let's rely on getListItems caching which we improved earlier.
                 const items = await trakt.getListItems(list.id, listOwner, forceUpdate);
                 
                 let hasMovies = false;
                 let hasShows = false;

                 if (Array.isArray(items)) {
                    for (const item of items) {
                        if (item.movie || item.type === 'movie') hasMovies = true;
                        if (item.show || item.type === 'show') hasShows = true;
                        if (hasMovies && hasShows) break;
                    }

                    let contentType = 'mixed';
                    if (hasMovies && !hasShows) contentType = 'movie';
                    if (!hasMovies && hasShows) contentType = 'series';
                    // If empty, default to mixed or keep previous?
                    if (!hasMovies && !hasShows) contentType = list.content_type || 'mixed'; 

                    if (list.content_type !== contentType) {
                        logger.info(`Detected type change for list ${list.name} (${list.id}): ${list.content_type} -> ${contentType}`);
                        list.content_type = contentType;
                        updated = true;
                    } else if (!list.content_type) {
                        // First time detection (even if mixed)
                        list.content_type = contentType;
                        updated = true;
                    }
                 }
             } catch (e) {
                 logger.error(`Failed to detect type for list ${list.id}`, e);
             }
        }
    }

    if (updated) {
        await prisma.profile.update({
            where: { id: profileId },
            data: { selectedLists: JSON.stringify(lists) }
        });
        logger.info(`Updated profile ${profileId} with detected list types`);
    }

    return lists;
  } catch (e) {
    logger.error('Error in detectAndUpdateListTypes', e);
    return lists;
  }
}
export async function refreshCatalog(catalogId: string, cacheKey: string, filters: CatalogFilters, profileId: string, username?: string) {
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
      const listItems = await trakt.getListItems(catalogId, username);
      
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
