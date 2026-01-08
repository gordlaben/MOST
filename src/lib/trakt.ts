import axios from 'axios';
import { logger } from './logger';
import { prisma } from './db';

const TRAKT_API_URL = 'https://api.trakt.tv';
const TRAKT_OAUTH_URL = 'https://trakt.tv';

interface TraktImage {
    full: string;
    medium: string;
    thumb: string;
}

export interface TraktShow {
  title: string;
  year: number;
  ids: {
    trakt: number;
    slug: string;
    tvdb: number;
    imdb: string;
    tmdb: number;
  };
  images?: {
    poster?: string[] | TraktImage;
    fanart?: string[] | TraktImage;
    logo?: string[] | TraktImage;
    clearart?: string[] | TraktImage;
    banner?: string[] | TraktImage;
    thumb?: string[] | TraktImage;
  };
  first_aired?: string;
  aired_episodes?: number;
  status?: string;
  trailer?: string;
  homepage?: string;
  rating?: number;
  votes?: number;
  genres?: string[];
  certification?: string;
  network?: string;
  overview?: string;
  runtime?: number;
  language?: string;
  updated_at?: string;
}

export interface TraktMovie {
  title: string;
  year: number;
  ids: {
    trakt: number;
    slug: string;
    imdb: string;
    tmdb: number;
  };
  tagline?: string;
  overview?: string;
  released?: string;
  runtime?: number;
  country?: string;
  trailer?: string;
  homepage?: string;
  status?: string;
  rating?: number;
  votes?: number;
  comment_count?: number;
  updated_at?: string;
  language?: string;
  available_translations?: string[];
  genres?: string[];
  certification?: string;
  images?: {
    poster?: string[] | TraktImage;
    fanart?: string[] | TraktImage;
    logo?: string[] | TraktImage;
    clearart?: string[] | TraktImage;
    banner?: string[] | TraktImage;
    thumb?: string[] | TraktImage;
  };
}

export interface TraktEpisode {
  season: number;
  number: number;
  title: string;
  ids: {
    trakt: number;
    tvdb: number;
    imdb: string;
    tmdb: number;
  };
  first_aired: string;
  overview?: string;
  rating?: number;
  runtime?: number;
  images?: {
    screenshot?: string[] | TraktImage;
  };
}

export interface TraktList {
  name: string;
  description: string;
  privacy: string;
  item_count: number;
  ids: {
      trakt: number | string;
      slug: string;
  };
}

export interface TraktListItem {
  rank: number;
  listed_at: string;
  type: 'show' | 'movie' | 'season' | 'episode' | 'person';
  show?: TraktShow;
  movie?: TraktMovie;
  season?: { number: number };
  episode?: { season: number; number: number };
}


export interface TraktSeason {
  number: number;
  ids: {
    trakt: number;
    tvdb: number;
    tmdb: number;
  };
  episode_count: number;
  episodes?: TraktEpisode[];
}

interface TraktWatchedEpisode {
  number: number;
  plays: number;
  last_watched_at: string;
}

interface TraktWatchedSeason {
  number: number;
  episodes: TraktWatchedEpisode[];
}

export interface TraktWatchedShow {
  plays: number;
  last_watched_at: string;
  last_updated_at: string;
  show: TraktShow;
  seasons: TraktWatchedSeason[];
}

export interface TraktBingeReadyShow {
    show: TraktShow;
    latestSeason: number;
    releaseDate: Date | null;
    watchedEpisodes: number;
    totalEpisodes: number;
}

export interface TraktEpisodeLeftShow {
    show: TraktShow;
    latestSeason: number;
    releaseDate: string;
    watchedEpisodes: number;
    totalEpisodes?: number;
}

export class TraktClient {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private accessToken?: string;
  private profileId?: string;
  public requestCount = 0;

  constructor(clientId: string, clientSecret: string, redirectUri: string, accessToken?: string, profileId?: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
    this.accessToken = accessToken;
    this.profileId = profileId;
  }

  private get headers() {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'trakt-api-version': '2',
      'trakt-api-key': this.clientId,
      'User-Agent': 'Most/1.0.0',
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    return headers;
  }

  private async request<T>(method: 'get' | 'post', url: string, data?: unknown, config?: object): Promise<T> {
    this.requestCount++;
    const axiosConfig = {
      ...config,
      headers: this.headers,
      timeout: 15000, // 15 seconds timeout
    };

    try {
      if (method === 'get') {
        const response = await axios.get(url, axiosConfig);
        return response.data;
      } else {
        const response = await axios.post(url, data, axiosConfig);
        return response.data;
      }
    } catch (error) {
      throw error;
    }
  }

  getAuthUrl(state?: string) {
    let url = `${TRAKT_OAUTH_URL}/oauth/authorize?response_type=code&client_id=${this.clientId}&redirect_uri=${encodeURIComponent(this.redirectUri)}`;
    if (state) {
      url += `&state=${encodeURIComponent(state)}`;
    }
    return url;
  }

  async exchangeCodeForToken(code: string) {
    logger.info('Exchanging code for token');
    try {
      // Token exchange doesn't use standard headers usually, but let's count it anyway if we want total interaction
      // But usually we care about API rate limits. Token exchange is separate.
      // Let's keep it raw axios for auth to avoid header issues.
      const response = await axios.post(`${TRAKT_API_URL}/oauth/token`, {
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
      });
      logger.info('Token exchange successful');
      return response.data;
    } catch (error) {
      logger.error('Token exchange failed', error);
      throw error;
    }
  }

  async refreshAccessToken(refreshToken: string) {
    logger.info('Refreshing access token');
    try {
      const response = await axios.post(`${TRAKT_API_URL}/oauth/token`, {
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        grant_type: 'refresh_token',
      });
      logger.info('Token refresh successful');
      return response.data;
    } catch (error) {
      logger.error('Token refresh failed', error);
      throw error;
    }
  }

  async createList(name: string, description = '', privacy = 'private') {
    logger.debug(`Creating list: ${name}`);
    try {
      const response = await this.request<TraktList>('post', `${TRAKT_API_URL}/users/me/lists`, {
        name,
        description,
        privacy,
        display_numbers: false,
        allow_comments: true,
        sort_by: 'added',
        sort_how: 'asc'
      });
      return response;
    } catch (error) {
      logger.error('Failed to create list', error);
      throw error;
    }
  }

  async addItemsToList(listId: string, items: { movies?: { ids: { slug: string } }[], shows?: { ids: { slug: string } }[] }) {
    logger.debug(`Adding items to list ${listId}`);
    try {
      const url = `${TRAKT_API_URL}/users/me/lists/${listId}/items`;
      const response = await this.request('post', url, items);
      return response;
    } catch (error) {
      logger.error(`Failed to add items to list ${listId}`, error);
      throw error;
    }
  }

  async removeItemsFromList(listId: string, items: { movies?: { ids: { slug: string } }[], shows?: { ids: { slug: string } }[] }) {
    logger.debug(`Removing items from list ${listId}`);
    try {
      const url = `${TRAKT_API_URL}/users/me/lists/${listId}/items/remove`;
      const response = await this.request('post', url, items);
      return response;
    } catch (error) {
       logger.error(`Failed to remove items from list ${listId}`, error);
       throw error;
    }
  }

  async getUserLists(forceRefresh = false) {
    logger.debug('Fetching user lists');

    // Caching Logic
    if (this.profileId && !forceRefresh) {
        const cacheKey = `user-lists-${this.profileId}`;
        const cached = await prisma.calendarCache.findUnique({ where: { id: cacheKey } });
        // Cache for 30 minutes
        if (cached && Date.now() - cached.updatedAt.getTime() < 30 * 60 * 1000) {
            try {
                return JSON.parse(cached.data);
            } catch {
                // Ignore error, refetch
            }
        }
    }

    try {
      // Fetch personal lists
      const lists = await this.request<TraktList[]>('get', `${TRAKT_API_URL}/users/me/lists`);
      
      // Fetch watchlist count
      let watchlistCount = 0;
      try {
        const response = await axios.get(`${TRAKT_API_URL}/users/me/watchlist?limit=1`, { 
            headers: this.headers 
        });
        if (response.headers['x-pagination-item-count']) {
            watchlistCount = parseInt(response.headers['x-pagination-item-count'], 10);
        }
      } catch (e) {
        logger.warn('Failed to fetch watchlist count', e);
      }

      // Also fetch the watchlist as a "list"
      const watchlist = {
        ids: { trakt: 'watchlist', slug: 'watchlist' },
        name: 'Watchlist',
        description: 'Your Trakt Watchlist',
        privacy: 'private',
        display_numbers: false,
        allow_comments: false,
        sort_by: 'rank',
        sort_how: 'asc',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        item_count: watchlistCount,
        comment_count: 0,
        likes: 0
      } as unknown as TraktList;

      const result: TraktList[] = [watchlist, ...lists];

      // Save to Cache
        if (this.profileId) {
            const cacheKey = `user-lists-${this.profileId}`;
            await prisma.calendarCache.upsert({
                where: { id: cacheKey },
                update: { data: JSON.stringify(result) },
                create: { id: cacheKey, data: JSON.stringify(result) },
            });
            
            // Sync with DB
            await this.syncListsToDb(result);
        }

      return result;
    } catch (error) {
      logger.error('Failed to fetch user lists', error);
      throw error;
    }
  }
  
  async syncListsToDb(lists: TraktList[]) {
      if (!this.profileId) return;

      // Optimize: Parallel Execution using Promise.all
      // Lists are usually < 100, so we can run them concurrently without transaction overhead
      await Promise.all(lists.map(list => {
          const listId = list.ids.trakt.toString();
          
          return prisma.traktList.upsert({
              where: {
                  profileId_traktId: {
                      profileId: this.profileId!,
                      traktId: listId
                  }
              },
              update: {
                  name: list.name,
                  description: list.description,
                  privacy: list.privacy,
                  count: list.item_count,
                  type: listId === 'watchlist' ? 'system' : 'personal',
              },
              create: {
                  profileId: this.profileId!,
                  traktId: listId,
                  name: list.name,
                  description: list.description,
                  privacy: list.privacy,
                  count: list.item_count,
                  type: listId === 'watchlist' ? 'system' : 'personal',
              }
          });
      }));
  }


  async getListItems(
    listId: string, 
    username?: string, 
    forceRefresh = false, 
    limit?: number, 
    sortBy?: 'newest' | 'oldest' | 'title',
    filters?: { includeEnded: boolean; includeCanceled: boolean; includeReturning: boolean }
  ) {
    logger.debug(`Fetching items for list ${listId} (user: ${username || 'me'})${limit ? ` limit=${limit}` : ''} sortBy=${sortBy} filters=${JSON.stringify(filters)}`);
    
    // Caching Logic
    const userKey = username || 'me';
    const fullCacheKey = `list-items-v2-${this.profileId}-${listId}-${userKey}`;

    if (this.profileId && !forceRefresh) {
        // 1. Check Full Cache (Preferred)
        const cached = await prisma.calendarCache.findUnique({ where: { id: fullCacheKey } });
        
        if (cached) {
            // SWR: Return cached data immediately
            const isStale = Date.now() - cached.updatedAt.getTime() > 30 * 60 * 1000;
            
            logger.info(`Cache Hit: ${listId} ${isStale ? '(STALE - Refreshing Background)' : '(FRESH)'}`);

            if (isStale) {
                // Trigger background refresh (full list since we have full cache)
                this._fetchListItemsInternal(listId, username, undefined).catch(e => logger.error(`Background refresh failed for ${listId}`, e));
            }

            try {
                let data = JSON.parse(cached.data);
                if (filters) data = this.filterListItems(data, filters);
                data = this.sortListItems(data, sortBy);
                if (limit && Array.isArray(data)) return data.slice(0, limit);
                return data;
            } catch { /* ignore */ }
        }

        // 2. Check Preview Cache (Only if limit is small)
        if (limit && limit <= 100) {
             const previewCacheKey = `list-items-preview-${this.profileId}-${listId}-${userKey}`;
             const cachedPreview = await prisma.calendarCache.findUnique({ where: { id: previewCacheKey } });
             
             if (cachedPreview) {
                 const isStale = Date.now() - cachedPreview.updatedAt.getTime() > 30 * 60 * 1000;
                 if (isStale) {
                     // Trigger background refresh (preview only)
                     this._fetchListItemsInternal(listId, username, limit).catch(e => logger.error(`Background preview refresh failed for ${listId}`, e));
                 }

                 try {
                     let data = JSON.parse(cachedPreview.data);
                     if (filters) data = this.filterListItems(data, filters);
                     data = this.sortListItems(data, sortBy);
                     return data.slice(0, limit);
                 } catch { /* ignore */ }
             }
        }
    }
    
    // Cache Miss - Fetch
    logger.info(`Cache Miss: Fetching ${listId} from Trakt API...`);
    const data = await this._fetchListItemsInternal(listId, username, limit);
    
    // Apply Filtering & Sort (fetchInternal returns raw data)
    let processed = data;
    if (filters) processed = this.filterListItems(processed, filters);
    processed = this.sortListItems(processed, sortBy);
    
    if (limit && Array.isArray(processed)) {
        return processed.slice(0, limit);
    }
    return processed;
  }

  // Helper to fetch and cache (Internal use)
  private async _fetchListItemsInternal(listId: string, username?: string, limit?: number) {
      const userKey = username || 'me';
      const fullCacheKey = `list-items-v2-${this.profileId}-${listId}-${userKey}`;
      
      let url = '';
      const baseParams = 'extended=full,images';
      const user = username || 'me';
      
      // Determine if we can do a partial fetch
      const isPartialFetch = !!(limit && limit <= 100);
      let fetchUrlParams = baseParams;
      
      if (isPartialFetch) {
          fetchUrlParams += `&page=1&limit=${limit}`;
      }

      if (listId === 'watchlist') {
        url = `${TRAKT_API_URL}/sync/watchlist?${fetchUrlParams}`;
      } else {
        url = `${TRAKT_API_URL}/users/${user}/lists/${listId}/items?${fetchUrlParams}`;
      }
      
      const data = await this.request<TraktListItem[]>('get', url);

      // Cache Handling
      if (this.profileId) {
          if (isPartialFetch) {
              // Cache as Preview
              const previewCacheKey = `list-items-preview-${this.profileId}-${listId}-${userKey}`;
              prisma.calendarCache.upsert({
                  where: { id: previewCacheKey },
                  update: { data: JSON.stringify(data), updatedAt: new Date() },
                  create: { id: previewCacheKey, data: JSON.stringify(data), updatedAt: new Date() }
              }).catch(err => logger.error(`Failed to cache preview list ${listId}`, err));
          } else {
              // Cache as Full
              prisma.calendarCache.upsert({
                  where: { id: fullCacheKey },
                  update: { data: JSON.stringify(data), updatedAt: new Date() },
                  create: { id: fullCacheKey, data: JSON.stringify(data), updatedAt: new Date() }
              }).catch(err => logger.error(`Failed to cache full list ${listId}`, err));
              
              // Sync to DB (Only on full fetch to avoid partial overwrites/gaps if we implemented delete)
              // For now, upsert what we have.
              this.syncListItemsToDb(listId, data).catch(err => logger.error(`Failed to sync list items ${listId}`, err));
          }
      }
      return data;
  }
  
  async syncListItemsToDb(traktListId: string, items: TraktListItem[]) {
      if (!this.profileId) return;

      // 1. Get the List UUID
      const list = await prisma.traktList.findUnique({
          where: {
              profileId_traktId: {
                  profileId: this.profileId,
                  traktId: traktListId
              }
          }
      });

      if (!list) {
          // If list doesn't exist yet (e.g. wasn't synced via getUserLists), create a stub
           logger.warn(`List ${traktListId} not found in DB during item sync. Skipping.`);
           return;
      }

      // 2. BATCH OPTIMIZATION: Process Shows/Movies in parallel first
      const showsToUpsert = items.filter(i => i.show).map(i => i.show!);
      const moviesToUpsert = items.filter(i => i.movie).map(i => i.movie!);

      // Process global entites (Show/Movie) in chunks to avoid overwhelming the DB connection
      // We still use upsert because they might be updated by other lists
      const upsertShow = (show: TraktShow) => prisma.show.upsert({
              where: { traktId: show.ids.trakt },
              update: {
                  title: show.title,
                  slug: show.ids.slug,
                  tvdbId: show.ids.tvdb,
                  tmdbId: show.ids.tmdb,
                  imdbId: show.ids.imdb,
                  overview: show.overview,
                  year: show.year,
                  status: show.status,
                  rating: show.rating,
                  votes: show.votes,
                  images: show.images ? JSON.stringify(show.images) : undefined,
              },
              create: {
                  traktId: show.ids.trakt,
                  title: show.title,
                  slug: show.ids.slug,
                  tvdbId: show.ids.tvdb,
                  tmdbId: show.ids.tmdb,
                  imdbId: show.ids.imdb,
                  overview: show.overview,
                  year: show.year,
                  status: show.status,
                  rating: show.rating,
                  votes: show.votes,
                  images: show.images ? JSON.stringify(show.images) : undefined,
              }
      });
      
      const upsertMovie = (movie: TraktMovie) => prisma.movie.upsert({
              where: { traktId: movie.ids.trakt },
              update: {
                  title: movie.title,
                  slug: movie.ids.slug,
                  imdbId: movie.ids.imdb,
                  tmdbId: movie.ids.tmdb,
                  overview: movie.overview,
                  year: movie.year,
                  released: movie.released,
                  status: movie.status,
                  rating: movie.rating,
                  votes: movie.votes,
                  images: movie.images ? JSON.stringify(movie.images) : undefined,
              },
              create: {
                  traktId: movie.ids.trakt,
                  title: movie.title,
                  slug: movie.ids.slug,
                  imdbId: movie.ids.imdb,
                  tmdbId: movie.ids.tmdb,
                  overview: movie.overview,
                  year: movie.year,
                  released: movie.released,
                  status: movie.status,
                  rating: movie.rating,
                  votes: movie.votes,
                  images: movie.images ? JSON.stringify(movie.images) : undefined,
              }
      });

      // Execute upserts in parallel logic (Promise.all)
      await Promise.all([
          ...showsToUpsert.map(s => upsertShow(s)),
          ...moviesToUpsert.map(m => upsertMovie(m))
      ]);

      // 3. TRANSACTIONAL LIST UPDATE: Delete old items and insert new ones
      // This is much faster than upserting individual list items
      try {
        await prisma.$transaction(async (tx) => {
             // Delete existing items for this list to ensure clean slate (handles removals too!)
             await tx.traktListItem.deleteMany({
                 where: { listId: list.id }
             });

             // Prepare data for createMany
             const listItemsData = items.map((item) => ({
                 listId: list.id,
                 type: item.type,
                 rank: item.rank || 0,
                 listedAt: item.listed_at ? new Date(item.listed_at) : new Date(),
                 showId: item.show ? item.show.ids.trakt : null,
                 movieId: item.movie ? item.movie.ids.trakt : null,
                 seasonNumber: item.season ? item.season.number : (item.episode ? item.episode.season : null),
                 episodeNumber: item.episode ? item.episode.number : null,
             }));

             if (listItemsData.length > 0) {
                 // SQLite fallback: createMany might not be available or inferred correctly
                 // Using Promise.all with create inside transaction
                 await Promise.all(listItemsData.map(item => tx.traktListItem.create({ data: item })));
             }
        });
      } catch (e) {
         logger.error(`Error performing transactional sync for list ${traktListId}`, e);
      }
  }

  // Helper to filter list items

  // Helper to filter list items
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private filterListItems(items: any[], filters: { includeEnded: boolean; includeCanceled: boolean; includeReturning: boolean }) {
      if (!Array.isArray(items)) return items;

      return items.filter(item => {
          // Only filter Shows (Movies don't have these statuses usually, or we treat them as returning/ended?)
          // Actually Trakt Movies have statuses like "released", "in production".
          // But for now, focus on Shows as per user request (Show Status)
          
          const show = item.show;
          if (!show) return true; // Keep movies

          const status = (show.status || '').toLowerCase();
          
          if (status === 'ended' && !filters.includeEnded) return false;
          if (status === 'canceled' && !filters.includeCanceled) return false;
          if ((status === 'returning series' || status === 'in production' || status === 'planned') && !filters.includeReturning) return false;
          
          return true;
      });
  }

  // Helper to sort list items
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private sortListItems(items: any[], sortBy?: 'newest' | 'oldest' | 'title') {
      if (!Array.isArray(items)) return items;
      if (!sortBy) return items; // Return original order (Rank/Added)

      // Log first item to debug sorting
      if (items.length > 0) {
        const first = items[0];
        const dateStr = first.show?.first_aired || first.movie?.released || first.season?.first_aired || first.episode?.first_aired || 'MISSING';
        logger.debug(`Sorting ${items.length} items by ${sortBy}. Sample date: ${dateStr}`);
        if (dateStr === 'MISSING') {
            logger.warn('Sort key missing from item:', JSON.stringify(first).substring(0, 200));
        }
      }

      return [...items].sort((a, b) => {
          if (sortBy === 'title') {
              const titleA = (a.show?.title || a.movie?.title || '').toLowerCase();
              const titleB = (b.show?.title || b.movie?.title || '').toLowerCase();
              return titleA.localeCompare(titleB);
          } else {
              // Newest / Oldest (based on Release Date/First Aired)
              const dateAStr = a.show?.first_aired || a.movie?.released || a.season?.first_aired || a.episode?.first_aired || '1970-01-01';
              const dateBStr = b.show?.first_aired || b.movie?.released || b.season?.first_aired || b.episode?.first_aired || '1970-01-01';
              const dateA = new Date(dateAStr).getTime();
              const dateB = new Date(dateBStr).getTime();
              
              if (sortBy === 'oldest') {
                  return dateA - dateB;
              } else {
                  // Newest
                  return dateB - dateA;
              }
          }
      });
  }

  async getListDetails(username: string, listId: string) {
    logger.debug(`Fetching details for list ${listId} by user ${username}`);
    try {
      const url = `${TRAKT_API_URL}/users/${username}/lists/${listId}`;
      const data = await this.request<unknown>('get', url);
      return data;
    } catch (error) {
      logger.error(`Failed to fetch list details for ${username}/${listId}`, error);
      throw error;
    }
  }

  async getContent(type: 'movie' | 'show', id: string) {
    logger.debug(`Fetching content details for ${type} ${id}`);
    
    // Check cache first
    let lookupId = id;
    if (id.startsWith('trakt:')) lookupId = id.replace('trakt:', '');

    // Determine if lookupId is numeric (Trakt ID) or string (Slug/IMDB)
    const isNumeric = /^\d+$/.test(lookupId);
    
    try {
      const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
      const cacheCutoff = new Date(Date.now() - CACHE_TTL);

      if (type === 'show') {
            
         // Try to find by slug first as it's most common in this app
         const cachedShow = await prisma.show.findFirst({
            where: isNumeric ? { traktId: parseInt(lookupId) } : { OR: [{ slug: lookupId }, { imdbId: lookupId }] }
         });

         if (cachedShow && cachedShow.updatedAt > cacheCutoff && cachedShow.overview) {
             logger.debug(`Cache hit for show ${id}`);
             return {
                 title: cachedShow.title,
                 year: cachedShow.year || 0,
                 ids: {
                     trakt: cachedShow.traktId,
                     slug: cachedShow.slug,
                     tvdb: cachedShow.tvdbId || 0,
                     imdb: cachedShow.imdbId || '',
                     tmdb: cachedShow.tmdbId || 0,
                 },
                 overview: cachedShow.overview || undefined,
                 runtime: cachedShow.runtime || undefined,
                 certification: cachedShow.certification || undefined,
                 network: cachedShow.network || undefined,
                 status: cachedShow.status || undefined,
                 rating: cachedShow.rating || undefined,
                 votes: cachedShow.votes || undefined,
                 trailer: cachedShow.trailer || undefined,
                 homepage: cachedShow.homepage || undefined,
                 genres: cachedShow.genres ? JSON.parse(cachedShow.genres) : [],
                 images: cachedShow.images ? JSON.parse(cachedShow.images) : {},
                 updated_at: cachedShow.updatedAt.toISOString(),
             } as TraktShow;
         }
      } else {
         const cachedMovie = await prisma.movie.findFirst({
            where: isNumeric ? { traktId: parseInt(lookupId) } : { OR: [{ slug: lookupId }, { imdbId: lookupId }] }
         });

         if (cachedMovie && cachedMovie.updatedAt > cacheCutoff && cachedMovie.overview) {
             logger.debug(`Cache hit for movie ${id}`);
             return {
                 title: cachedMovie.title,
                 year: cachedMovie.year || 0,
                 ids: {
                     trakt: cachedMovie.traktId,
                     slug: cachedMovie.slug,
                     imdb: cachedMovie.imdbId || '',
                     tmdb: cachedMovie.tmdbId || 0,
                 },
                 overview: cachedMovie.overview || undefined,
                 runtime: cachedMovie.runtime || undefined,
                 tagline: cachedMovie.tagline || undefined,
                 released: cachedMovie.released || undefined,
                 certification: cachedMovie.certification || undefined,
                 status: cachedMovie.status || undefined,
                 rating: cachedMovie.rating || undefined,
                 votes: cachedMovie.votes || undefined,
                 trailer: cachedMovie.trailer || undefined,
                 homepage: cachedMovie.homepage || undefined,
                 genres: cachedMovie.genres ? JSON.parse(cachedMovie.genres) : [],
                 images: cachedMovie.images ? JSON.parse(cachedMovie.images) : {},
                 updated_at: cachedMovie.updatedAt.toISOString(),
             } as TraktMovie;
         }
      }
    } catch (e) {
        logger.warn(`Cache lookup failed for ${type} ${id}`, e);
        // Continue to fetch from API
    }

    try {
      // Trakt API uses 'movies' and 'shows' (plural)
      const endpoint = type === 'movie' ? 'movies' : 'shows';
      const data = await this.request<TraktShow | TraktMovie>('get', `${TRAKT_API_URL}/${endpoint}/${lookupId}?extended=full,images`);
      
      // Save to cache asynchronously
      (async () => {
          try {
              if (type === 'show') {
                  const show = data as TraktShow;
                  await prisma.show.upsert({
                      where: { traktId: show.ids.trakt },
                      update: {
                          title: show.title,
                          slug: show.ids.slug,
                          tvdbId: show.ids.tvdb,
                          tmdbId: show.ids.tmdb,
                          imdbId: show.ids.imdb,
                          overview: show.overview,
                          year: show.year,
                          runtime: show.runtime,
                          genres: JSON.stringify(show.genres || []),
                          certification: show.certification,
                          network: show.network,
                          status: show.status,
                          rating: show.rating,
                          votes: show.votes,
                          trailer: show.trailer,
                          homepage: show.homepage,
                          images: JSON.stringify(show.images || {}),
                          updatedAt: new Date(),
                      },
                      create: {
                          traktId: show.ids.trakt,
                          title: show.title,
                          slug: show.ids.slug,
                          tvdbId: show.ids.tvdb,
                          tmdbId: show.ids.tmdb,
                          imdbId: show.ids.imdb,
                          overview: show.overview,
                          year: show.year,
                          runtime: show.runtime,
                          genres: JSON.stringify(show.genres || []),
                          certification: show.certification,
                          network: show.network,
                          status: show.status,
                          rating: show.rating,
                          votes: show.votes,
                          trailer: show.trailer,
                          homepage: show.homepage,
                          images: JSON.stringify(show.images || {}),
                      }
                  });
              } else {
                  const movie = data as TraktMovie;
                  await prisma.movie.upsert({
                      where: { traktId: movie.ids.trakt },
                      update: {
                          title: movie.title,
                          slug: movie.ids.slug,
                          imdbId: movie.ids.imdb,
                          tmdbId: movie.ids.tmdb,
                          overview: movie.overview,
                          year: movie.year,
                          released: movie.released,
                          runtime: movie.runtime,
                          tagline: movie.tagline,
                          genres: JSON.stringify(movie.genres || []),
                          certification: movie.certification,
                          status: movie.status,
                          rating: movie.rating,
                          votes: movie.votes,
                          trailer: movie.trailer,
                          homepage: movie.homepage,
                          images: JSON.stringify(movie.images || {}),
                          updatedAt: new Date(),
                      },
                      create: {
                          traktId: movie.ids.trakt,
                          title: movie.title,
                          slug: movie.ids.slug,
                          imdbId: movie.ids.imdb,
                          tmdbId: movie.ids.tmdb,
                          overview: movie.overview,
                          year: movie.year,
                          released: movie.released,
                          runtime: movie.runtime,
                          tagline: movie.tagline,
                          genres: JSON.stringify(movie.genres || []),
                          certification: movie.certification,
                          status: movie.status,
                          rating: movie.rating,
                          votes: movie.votes,
                          trailer: movie.trailer,
                          homepage: movie.homepage,
                          images: JSON.stringify(movie.images || {}),
                      }
                  });
              }
          } catch (err) {
              logger.error(`Failed to cache ${type} ${id}`, err);
          }
      })();

      return data;
    } catch (error) {
      logger.error(`Failed to fetch content details for ${type} ${id}`, error);
      throw error;
    }
  }

  async search(query: string, type: 'movie' | 'show') {
    logger.debug(`Searching Trakt for ${type}: ${query}`);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await this.request<any[]>('get', `${TRAKT_API_URL}/search/${type}?query=${encodeURIComponent(query)}&extended=full`);
      return data;
    } catch (error) {
      logger.error('Trakt search failed', error);
      throw error;
    }
  }

  async getTrendingShows(): Promise<TraktShow[]> {
    logger.debug('Fetching trending shows');
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await this.request<any[]>('get', `${TRAKT_API_URL}/shows/trending`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return data.map((item: any) => item.show);
    } catch (error) {
      logger.error('Failed to fetch trending shows', error);
      throw error;
    }
  }

  async getUserProfile() {
    logger.debug('Fetching user profile');
    try {
      // Use /users/settings to ensure we get the full user object with images
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await this.request<any>('get', `${TRAKT_API_URL}/users/settings`);
      return data.user;
    } catch (error) {
      logger.error('Failed to fetch user profile', error);
      throw error;
    }
  }

  async getUserStats() {
    logger.debug('Fetching user stats');
    try {
      const data = await this.request<unknown>('get', `${TRAKT_API_URL}/users/me/stats`);
      return data;
    } catch (error) {
      logger.error('Failed to fetch user stats', error);
      throw error;
    }
  }

  async getLastWatchedShow() {
    logger.debug('Fetching last watched show');
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await this.request<any[]>('get', `${TRAKT_API_URL}/sync/history/shows?limit=1`);
      return data && data.length > 0 ? data[0] : null;
    } catch (error) {
      logger.error('Failed to fetch last watched show', error);
      throw error;
    }
  }

  async getWatchedShowsRaw(forceRefresh = false): Promise<TraktWatchedShow[]> {
    logger.debug('Fetching watched shows raw');
    
    const cacheKey = `watched-shows-${this.profileId}`;

    if (this.profileId && !forceRefresh) {
      const cached = await prisma.calendarCache.findUnique({ where: { id: cacheKey } });
      
      if (cached) {
          // Stale-While-Revalidate: Return cached data immediately
          // If older than 15 mins, trigger background refresh
          const isStale = Date.now() - cached.updatedAt.getTime() > 15 * 60 * 1000;
          
          if (isStale) {
              logger.debug('Cache stale, triggering background refresh for watched shows');
              // Background update (no await)
              this.fetchAndCacheWatchedShows().catch(err => logger.error('Background watched shows refresh failed', err));
          }

          try {
            return JSON.parse(cached.data);
          } catch {
            // If parse fails, fall through to fetch
          }
      }
    }

    // Cache miss or force refresh
    return this.fetchAndCacheWatchedShows();
  }

  private async fetchAndCacheWatchedShows(): Promise<TraktWatchedShow[]> {
      try {
        const data = await this.request<TraktWatchedShow[]>('get', `${TRAKT_API_URL}/sync/watched/shows?extended=full,images`);
  
        if (this.profileId) {
          const cacheKey = `watched-shows-${this.profileId}`;
          prisma.calendarCache.upsert({
            where: { id: cacheKey },
            update: { data: JSON.stringify(data), updatedAt: new Date() },
            create: { id: cacheKey, data: JSON.stringify(data), updatedAt: new Date() }
          }).catch(err => logger.error('Failed to cache watched shows', err));
        }
  
        return data;
      } catch (error) {
        logger.error('Failed to fetch watched shows', error);
        throw error;
      }
  }

  async getUserWatching(): Promise<TraktShow[]> {
    // 1. Get watched shows with full details
    const watchedShows = await this.getWatchedShowsRaw();
    
    // 2. Filter for shows that are NOT ended or canceled
    // Statuses: 'returning series', 'in production', 'planned', 'canceled', 'ended'
    const activeShows = watchedShows
      .map((item) => item.show)
      .filter((show) => 
        show.status && 
        show.status !== 'ended' && 
        show.status !== 'canceled'
      );

    return activeShows;
  }

  async getShowSummary(showId: string): Promise<TraktShow> {
    logger.debug(`Fetching summary for show ${showId}`);
    try {
      const data = await this.request<TraktShow>('get', `${TRAKT_API_URL}/shows/${showId}?extended=full`);
      return data;
    } catch (error) {
      logger.error(`Failed to fetch summary for show ${showId}`, error);
      throw error;
    }
  }

  async getShowSeasons(showId: string, extended = false): Promise<TraktSeason[]> {
    logger.debug(`Fetching seasons for show ${showId}`, { extended });
    try {
      const url = `${TRAKT_API_URL}/shows/${showId}/seasons${extended ? '?extended=full,episodes,images' : ''}`;
      const data = await this.request<TraktSeason[]>('get', url);
      return data;
    } catch (error) {
      logger.error(`Failed to fetch seasons for show ${showId}`, error);
      throw error;
    }
  }

  async getSeasonEpisodes(showId: string, seasonNumber: number, extended = false): Promise<TraktEpisode[]> {
    logger.debug(`Fetching episodes for show ${showId} season ${seasonNumber}`);
    try {
      const url = `${TRAKT_API_URL}/shows/${showId}/seasons/${seasonNumber}${extended ? '?extended=full,images' : ''}`;
      const data = await this.request<TraktEpisode[]>('get', url);
      return data;
    } catch (error) {
      logger.error(`Failed to fetch episodes for show ${showId} season ${seasonNumber}`, error);
      throw error;
    }
  }

  // This is a simplified "Binge Ready" check
  // In a real app, we'd need OAuth to get the USER'S specific progress
  // For now, we'll just check the latest season of a show
  async checkBingeReady(showId: string | { trakt: number; slug: string }): Promise<{ isReady: boolean; releaseDate: Date | null; lastEpisode: TraktEpisode | null; season: TraktSeason | null }> {
    const slug = typeof showId === 'string' ? showId : showId.slug;
    const traktId = typeof showId === 'object' ? showId.trakt : null;

    try {
      // 1. Try to fetch from DB if we have a Trakt ID
      if (traktId) {
        const cachedShow = await prisma.show.findUnique({
          where: { traktId },
          include: { seasons: { include: { episodes: true } } }
        });

        if (cachedShow) {
          const cacheAge = Date.now() - cachedShow.updatedAt.getTime();
          // Use cache if less than 24 hours old
          if (cacheAge < 24 * 60 * 60 * 1000) {
            // Reconstruct the logic from DB data
            const regularSeasons = cachedShow.seasons.filter(s => s.number > 0).sort((a, b) => a.number - b.number);
            if (regularSeasons.length > 0) {
              const lastSeason = regularSeasons[regularSeasons.length - 1];
              const episodes = lastSeason.episodes.sort((a, b) => a.number - b.number);
              
              if (episodes.length > 0) {
                const lastEp = episodes[episodes.length - 1];
                if (lastEp.firstAired) {
                  const airDate = new Date(lastEp.firstAired);
                  const now = new Date();
                  
                  // Map DB episode back to TraktEpisode interface (partial)
                  const traktLastEp: TraktEpisode = {
                    season: lastSeason.number,
                    number: lastEp.number,
                    title: lastEp.title,
                    ids: JSON.parse(lastEp.ids),
                    first_aired: lastEp.firstAired.toISOString()
                  };

                  const traktSeason: TraktSeason = {
                    number: lastSeason.number,
                    ids: { trakt: 0, tvdb: 0, tmdb: 0 }, // Dummy IDs as we don't store season IDs in this format
                    episode_count: episodes.length,
                    episodes: []
                  };

                  return {
                    isReady: now >= airDate,
                    releaseDate: airDate,
                    lastEpisode: traktLastEp,
                    season: traktSeason
                  };
                }
              }
            }
          }
        }
      }

      // 2. Fetch from Trakt
      // Fetch seasons WITH episodes in one call
      const seasons = await this.getShowSeasons(slug, true);
      
      // 3. Save to DB if we have a Trakt ID
      if (traktId) {
        // We need show details to create the show record first if it doesn't exist
        // But we might not have the title here if we only passed the slug.
        // However, usually we call this from a context where we know the show.
        // For now, we'll only update if the show exists OR we fetch the show info.
        // To keep it simple and fast, we'll skip creating the show if we don't have info,
        // but actually we can just fetch the show summary if needed.
        // Better: Just update the seasons/episodes if the show exists, or create it if we can.
        
        // Let's fetch the show summary to ensure we can create it
        try {
          const showSummary = await this.getShowSummary(slug);
          
          // Use findUnique + create/update instead of upsert to avoid Prisma Rust Panic
          const existingShow = await prisma.show.findUnique({ where: { traktId } });
          
          if (existingShow) {
            await prisma.show.update({
              where: { traktId },
              data: {
                updatedAt: new Date(),
              }
            });
          } else {
            // Ensure we don't violate unique constraints if the ID exists but wasn't found (race condition)
            // or if the summary ID is different (shouldn't happen usually)
            try {
              await prisma.show.create({
                data: {
                  traktId: showSummary.ids.trakt,
                  title: showSummary.title,
                  slug: showSummary.ids.slug,
                  tvdbId: showSummary.ids.tvdb || null,
                  tmdbId: showSummary.ids.tmdb || null,
                  imdbId: showSummary.ids.imdb || null,
                }
              });
            } catch (createError) {
              // If create fails (e.g. unique constraint), just try to update
              logger.warn(`Failed to create show ${slug}, trying update`, createError);
              // We can try to update by the summary ID if it exists
              const summaryId = showSummary.ids.trakt;
              const showBySummaryId = await prisma.show.findUnique({ where: { traktId: summaryId } });
              if (showBySummaryId) {
                 await prisma.show.update({
                    where: { traktId: summaryId },
                    data: { updatedAt: new Date() }
                 });
              }
            }
          }

          // Update Seasons and Episodes
          // This can be heavy, so maybe we only do it for the latest season?
          // But for completeness, let's do all regular seasons.
          
          for (const season of seasons) {
            if (season.number === 0) continue; // Skip specials for now

            // Replace season upsert with findUnique + create
            let dbSeason = await prisma.season.findUnique({
              where: {
                showId_number: {
                  showId: traktId,
                  number: season.number
                }
              }
            });

            if (!dbSeason) {
              try {
                dbSeason = await prisma.season.create({
                  data: {
                    number: season.number,
                    showId: traktId
                  }
                });
              } catch {
                // If create fails, try to find it again (race condition)
                dbSeason = await prisma.season.findUnique({
                  where: {
                    showId_number: {
                      showId: traktId,
                      number: season.number
                    }
                  }
                });
              }
            }

            if (dbSeason && season.episodes) {
              for (const ep of season.episodes) {
                // Replace episode upsert with findUnique + update/create
                const existingEp = await prisma.episode.findUnique({
                  where: {
                    seasonId_number: {
                      seasonId: dbSeason.id,
                      number: ep.number
                    }
                  }
                });

                const epData = {
                  title: ep.title,
                  firstAired: ep.first_aired ? new Date(ep.first_aired) : null,
                  ids: JSON.stringify(ep.ids)
                };

                if (existingEp) {
                  await prisma.episode.update({
                    where: { id: existingEp.id },
                    data: epData
                  });
                } else {
                  try {
                    await prisma.episode.create({
                      data: {
                        seasonId: dbSeason.id,
                        number: ep.number,
                        ...epData
                      }
                    });
                  } catch {
                    // Ignore create errors (race conditions)
                  }
                }
              }
            }
          }
        } catch (dbError) {
          logger.error('Failed to cache show to DB', dbError);
          // Continue without failing the request
        }
      }

      // Filter out specials (season 0)
      const regularSeasons = seasons.filter((s) => s.number > 0);
      
      if (regularSeasons.length === 0) {
        return { isReady: false, releaseDate: null, lastEpisode: null, season: null };
      }

      const lastSeason = regularSeasons[regularSeasons.length - 1];
      // Episodes are now included in the season object
      const episodes = lastSeason.episodes || [];
      
      if (episodes.length === 0) {
        return { isReady: false, releaseDate: null, lastEpisode: null, season: lastSeason };
      }

      const lastEpisode = episodes[episodes.length - 1];
      
      if (!lastEpisode.first_aired) {
        return { isReady: false, releaseDate: null, lastEpisode: null, season: null };
      }

      const airDate = new Date(lastEpisode.first_aired);
      
      // Filter out invalid dates or epoch dates (1970)
      if (isNaN(airDate.getTime()) || airDate.getFullYear() === 1970) {
        return { isReady: false, releaseDate: null, lastEpisode: null, season: null };
      }

      const now = new Date();

      return {
        isReady: now >= airDate,
        releaseDate: airDate,
        lastEpisode: lastEpisode,
        season: lastSeason
      };
    } catch (error) {
      console.error(`Error checking binge status for ${showId}:`, error);
      return { isReady: false, releaseDate: null, lastEpisode: null, season: null };
    }
  }

  async getBingeReadyShows(
    onProgress?: (message: string, current?: number, total?: number) => void,
    filters?: {
      includeEnded?: boolean;
      includeCanceled?: boolean;
      includeReturning?: boolean;
      sortBy?: 'newest' | 'oldest' | 'title';
      forceRefresh?: boolean;
    }
  ): Promise<TraktBingeReadyShow[]> {
    if (onProgress) onProgress('Fetching watched history...');
    const watchedShows = await this.getWatchedShowsRaw(filters?.forceRefresh);
    
    // Default filters
    const includeEnded = filters?.includeEnded ?? true;
    const includeCanceled = filters?.includeCanceled ?? true;
    const includeReturning = filters?.includeReturning ?? true;
    const sortBy = filters?.sortBy ?? 'newest';

    // Filter out shows where we've watched everything AND apply status filters
    const activeWatchedShows = watchedShows.filter((item) => {
      const show = item.show;
      
      // Status Filter
      if (show.status) {
        const status = show.status.toLowerCase();
        if (status === 'ended' && !includeEnded) return false;
        if (status === 'canceled' && !includeCanceled) return false;
        if ((status === 'returning series' || status === 'in production' || status === 'planned') && !includeReturning) return false;
      }

      const watchedSeasons = item.seasons;
      let watchedCount = 0;
      watchedSeasons.forEach((s) => watchedCount += s.episodes.length);
      
      // If we watched everything that aired, we don't need to check it
      if (show.aired_episodes && watchedCount >= show.aired_episodes) {
        return false;
      }
      return true;
    });

    if (onProgress) onProgress(`Found ${activeWatchedShows.length} shows to check...`, 0, activeWatchedShows.length);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: any[] = [];
    
    // Process in batches of 5 to improve speed while respecting rate limits
    const batchSize = 5;
    for (let i = 0; i < activeWatchedShows.length; i += batchSize) {
      if (onProgress) onProgress(`Analyzing shows...`, i, activeWatchedShows.length);
      const batch = activeWatchedShows.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (item) => {
        const show = item.show;
        const watchedSeasons = item.seasons; // Array of { number: 1, episodes: [...] }

        // Check public info for latest season
        // Pass both slug and trakt ID to enable DB caching
        const status = await this.checkBingeReady({ trakt: show.ids.trakt, slug: show.ids.slug });
        
        if (status.isReady && status.lastEpisode && status.season) {
          const latestSeasonNumber = status.lastEpisode.season;
          
          // Check if user has watched this season
          const userSeason = watchedSeasons.find((s) => s.number === latestSeasonNumber);
          
          let isFullyWatched = false;
          if (userSeason) {
              // Check if user has watched all episodes in the season
              if (userSeason.episodes.length >= status.season.episode_count) {
                  isFullyWatched = true;
              }
          }

          if (!isFullyWatched) {
              return {
                  show: show,
                  latestSeason: latestSeasonNumber,
                  releaseDate: status.releaseDate,
                  watchedEpisodes: userSeason ? userSeason.episodes.length : 0,
                  totalEpisodes: status.season.episode_count
              };
          }
        }
        return null;
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter(r => r !== null));
    }
    
    // Apply Sorting
    if (sortBy === 'title') {
      results.sort((a, b) => a.show.title.localeCompare(b.show.title));
    } else if (sortBy === 'oldest') {
      results.sort((a, b) => new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime());
    } else {
      // Default: Newest
      results.sort((a, b) => new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime());
    }
    
    return results;
  }

  async getEpisodesLeftShows(
    onProgress?: (message: string, current?: number, total?: number) => void,
    filters?: {
      includeEnded?: boolean;
      includeCanceled?: boolean;
      includeReturning?: boolean;
      sortBy?: 'newest' | 'oldest' | 'title';
      forceRefresh?: boolean;
    }
  ): Promise<TraktEpisodeLeftShow[]> {
    if (onProgress) onProgress('Fetching watched history...');
    const watchedShows = await this.getWatchedShowsRaw(filters?.forceRefresh);
    
    // Default filters
    const includeEnded = filters?.includeEnded ?? true;
    const includeCanceled = filters?.includeCanceled ?? true;
    const includeReturning = filters?.includeReturning ?? true;
    const sortBy = filters?.sortBy ?? 'newest';

    // Filter shows that have episodes left
    // And sort by last_watched_at descending (Newest first)
    const candidates = watchedShows.filter((item) => {
      const show = item.show;
      
      // Status Filter
      if (show.status) {
        const status = show.status.toLowerCase();
        if (status === 'ended' && !includeEnded) return false;
        if (status === 'canceled' && !includeCanceled) return false;
        if ((status === 'returning series' || status === 'in production' || status === 'planned') && !includeReturning) return false;
      }

      const watchedSeasons = item.seasons;
      let watchedCount = 0;
      watchedSeasons.forEach(s => watchedCount += s.episodes.length);
      const totalAired = show.aired_episodes || 0;
      return totalAired > 0 && watchedCount < totalAired;
    }).sort((a, b) => {
      return new Date(b.last_watched_at).getTime() - new Date(a.last_watched_at).getTime();
    });

    if (onProgress) onProgress(`Found ${candidates.length} shows with episodes left...`, 0, candidates.length);

    const results: TraktEpisodeLeftShow[] = [];
    
    // Process in batches to get season details
    const batchSize = 5;
    for (let i = 0; i < candidates.length; i += batchSize) {
      if (onProgress) onProgress(`Analyzing shows...`, i, candidates.length);
      const batch = candidates.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (item) => {
        const show = item.show;
        const watchedSeasons = item.seasons; // User's progress

        try {
            // Fetch all seasons/episodes to know the structure
            const allSeasons = await this.getShowSeasons(show.ids.slug, true);
            
            // Find the first season that is not fully watched
            let targetSeason: number | null = null;
            let watchedCount = 0;

            // Calculate total watched
            watchedSeasons.forEach(s => watchedCount += s.episodes.length);

            // Filter out specials (season 0)
            const regularSeasons = allSeasons.filter(s => s.number > 0);

            for (const season of regularSeasons) {
                const userSeason = watchedSeasons.find(s => s.number === season.number);
                const userWatchedCount = userSeason ? userSeason.episodes.length : 0;
                const seasonEpisodeCount = season.episode_count;

                if (userWatchedCount < seasonEpisodeCount) {
                    targetSeason = season.number;
                    break; 
                }
            }
            
            // If we couldn't find a partial season, maybe they finished the last watched season 
            // and the next one is completely unwatched.
            if (targetSeason === null && regularSeasons.length > 0) {
                 // Find the last season the user touched
                 const lastWatchedSeason = watchedSeasons.length > 0 
                    ? Math.max(...watchedSeasons.map(s => s.number)) 
                    : 0;
                 
                 // Look for the next season
                 const nextSeason = regularSeasons.find(s => s.number > lastWatchedSeason);
                 if (nextSeason) {
                     targetSeason = nextSeason.number;
                 }
            }

            if (targetSeason !== null) {
                 return {
                    show: show,
                    latestSeason: targetSeason, // The season to mark as watched
                    releaseDate: item.last_watched_at, // Using last_watched_at for sorting/display
                    watchedEpisodes: watchedCount,
                    totalEpisodes: show.aired_episodes
                };
            }
        } catch (e) {
            console.error(`Error processing show ${show.title}`, e);
        }
        return null;
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter((r): r is NonNullable<typeof r> => r !== null));
    }
    
    // Apply Sorting
    if (sortBy === 'title') {
      results.sort((a, b) => a.show.title.localeCompare(b.show.title));
    } else if (sortBy === 'oldest') {
      // For episodes left, "oldest" might mean "oldest last watched" or "oldest release date"
      // Let's stick to last watched for now as it's relevant for "continue watching"
      results.sort((a, b) => new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime());
    } else {
      // Default: Newest (Last Watched)
      results.sort((a, b) => new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime());
    }

    return results;
  }

  async markSeasonWatched(showId: string, seasonNumber: number) {
    const body = {
      shows: [
        {
          ids: { slug: showId },
          seasons: [{ number: seasonNumber }]
        }
      ]
    };

    const response = await axios.post(`${TRAKT_API_URL}/sync/history`, body, {
      headers: this.headers
    });
    
    return response.data;
  }

  async markMovieWatched(movieId: string) {
    const body = {
      movies: [
        {
          ids: { slug: movieId }
        }
      ]
    };

    const response = await axios.post(`${TRAKT_API_URL}/sync/history`, body, {
      headers: this.headers
    });
    
    return response.data;
  }

  async removeFromHistory(id: string, type: 'show' | 'movie' = 'show') {
    const body = {
      [type === 'movie' ? 'movies' : 'shows']: [
        {
          ids: { slug: id }
        }
      ]
    };

    const response = await axios.post(`${TRAKT_API_URL}/sync/history/remove`, body, {
      headers: this.headers
    });
    
    return response.data;
  }

  async addToWatchlist(item: { ids: { trakt?: number; slug?: string; imdb?: string; tmdb?: number; tvdb?: number } }, type: 'movie' | 'show' | 'season' | 'episode') {
    const key = type === 'movie' ? 'movies' : (type === 'show' ? 'shows' : (type === 'season' ? 'seasons' : 'episodes'));
    const body = {
      [key]: [item]
    };
    
    // Optimistic Cache Update (if watchlist is cached)
    if (this.profileId) {
        try {
            const cacheKey = `list-items-${this.profileId}-watchlist-me`;
            const cached = await prisma.calendarCache.findUnique({ where: { id: cacheKey } });
            if (cached) {
                // We can't easily construct the full object without fetching it, but we can invalidate the cache
                // so the next fetch gets the fresh list.
                // Or better: we could append a stub if we had the full item structure.
                // For now, invalidation is safer.
                await prisma.calendarCache.delete({ where: { id: cacheKey } });
            }
        } catch (e) {
            logger.warn('Failed to invalidate watchlist cache', e);
        }
    }

    const response = await axios.post(`${TRAKT_API_URL}/sync/watchlist`, body, {
      headers: this.headers
    });
    return response.data;
  }

  async removeFromWatchlist(item: { ids: { trakt?: number; slug?: string; imdb?: string; tmdb?: number; tvdb?: number } }, type: 'movie' | 'show' | 'season' | 'episode') {
    const key = type === 'movie' ? 'movies' : (type === 'show' ? 'shows' : (type === 'season' ? 'seasons' : 'episodes'));
    const body = {
      [key]: [item]
    };

    // Optimistic Cache Update
    if (this.profileId) {
        try {
            const cacheKey = `list-items-${this.profileId}-watchlist-me`;
            await prisma.calendarCache.delete({ where: { id: cacheKey } });
        } catch (e) {
            logger.warn('Failed to invalidate watchlist cache', e);
        }
    }

    const response = await axios.post(`${TRAKT_API_URL}/sync/watchlist/remove`, body, {
      headers: this.headers
    });
    return response.data;
  }
}
