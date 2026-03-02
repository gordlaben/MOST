import { NextRequest, NextResponse } from 'next/server';
import { TraktClient } from '@/lib/trakt';
import { getTraktCredentials, getProfile } from '@/lib/settings';
import { logger } from '@/lib/logger';
import { StremioMeta } from '@/lib/stremio';

interface SelectedList {
    id: string;
    title?: string;
    name?: string;
    placeholder?: {
        enabled: boolean;
        title?: string;
        poster?: string;
    };
}


export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ profileId: string; type: string; id: string }> }
) {
  const { profileId, type, id } = await params;
  
  logger.info(`Stremio Meta Request: ${id} (${type}) | Profile: ${profileId}`);

  if (type !== 'series' && type !== 'movie') {
    return NextResponse.json({ meta: null }, {
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  }

  const contentId = id.replace('.json', '');

  // Handle List Placeholders
  if (contentId.startsWith('tt_bngr_ph_')) {
     const listId = contentId.replace('tt_bngr_ph_', '');
     
     const profile = await getProfile(profileId);
     let meta: StremioMeta | null = null;

     if (profile && profile.selectedLists) {
         try {
             const lists = JSON.parse(profile.selectedLists) as SelectedList[];
             const list = lists.find((l) => l.id === listId);
             if (list && list.placeholder && list.placeholder.enabled) {
                 // Resolve poster URL logic (matching catalog logic)
                 let posterUrl = list.placeholder.poster || 'https://placehold.co/600x900/1a1a1a/ffffff/png?text=List';
                  
                 let origin = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;
                 if (origin.endsWith('/')) {
                     origin = origin.slice(0, -1);
                 }

                 if (posterUrl.startsWith('/')) {
                     posterUrl = `${origin}${posterUrl}`;
                 } else if (posterUrl.includes('/api/image/upload/')) {
                     const relativePath = posterUrl.substring(posterUrl.indexOf('/api/image/upload/'));
                     posterUrl = `${origin}${relativePath}`;
                 } else if (posterUrl.startsWith('http')) {
                     if (!posterUrl.includes('/api/image?url=')) {
                       posterUrl = `${origin}/api/image?url=${encodeURIComponent(posterUrl)}`;
                     }
                 }

                 meta = {
                     id: id,
                     type: type,
                     name: list.placeholder.title || list.title || list.name || 'Unknown List',
                     poster: posterUrl,
                     background: posterUrl,
                     description: `This is a placeholder item for the list: ${list.title || list.name}`,
                     releaseInfo: 'LIST',
                 };
             }
         } catch (e) {
             logger.error('Error fetching placeholder meta', e);
         }
     }

     if (!meta) {
         // Fallback if list not found or logic failed
        meta = {
            id: id,
            type: type,
            name: 'List Placeholder',
            description: 'This is a placeholder item.',
            poster: null,
            releaseInfo: 'Unknown'
        };
     }

     return NextResponse.json({ meta }, {
        headers: { 'Access-Control-Allow-Origin': '*' }
     });
  }

  try {
    const { clientId, clientSecret, accessToken } = await getTraktCredentials(profileId);
    if (!accessToken) {
        return NextResponse.json({ meta: null }, { headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    const trakt = new TraktClient(
        clientId || process.env.TRAKT_CLIENT_ID || '',
        clientSecret || process.env.TRAKT_CLIENT_SECRET || '',
        process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
        accessToken
    );

    const content = await trakt.getContent(type === 'series' ? 'show' : 'movie', contentId);
    
    // Get RPDB Key if available
    let rpdbKey = 't0-free-rpdb';
    const profile = await getProfile(profileId);
    if (profile && profile.rpdbKey) {
        rpdbKey = profile.rpdbKey;
    }

    let poster: string | null = null;
    let background: string | undefined = undefined;
    let logo: string | undefined = undefined;

    // Images
    if (content.images?.poster) {
        if (Array.isArray(content.images.poster) && content.images.poster.length > 0) {
            poster = content.images.poster[0];
        } else if (!Array.isArray(content.images.poster) && typeof content.images.poster === 'object' && content.images.poster?.thumb) {
            poster = content.images.poster.thumb;
        } else if (typeof content.images.poster === 'string') {
            poster = content.images.poster;
        }
    }

    if (content.images?.fanart) {
        if (Array.isArray(content.images.fanart) && content.images.fanart.length > 0) {
            background = content.images.fanart[0];
        } else if (!Array.isArray(content.images.fanart) && typeof content.images.fanart === 'object' && content.images.fanart?.full) {
            background = content.images.fanart.full;
        } else if (typeof content.images.fanart === 'string') {
            background = content.images.fanart;
        }
    }

    if (content.images?.logo) {
        if (Array.isArray(content.images.logo) && content.images.logo.length > 0) {
            logo = content.images.logo[0];
        } else if (!Array.isArray(content.images.logo) && typeof content.images.logo === 'object' && content.images.logo?.full) {
            logo = content.images.logo.full;
        } else if (typeof content.images.logo === 'string') {
            logo = content.images.logo;
        }
    }

    if (poster && !poster.startsWith('http')) poster = `https://${poster}`;
    if (background && !background.startsWith('http')) background = `https://${background}`;
    if (logo && !logo.startsWith('http')) logo = `https://${logo}`;

    // Apply RPDB if available
    if (rpdbKey && rpdbKey !== 'disabled' && content.ids) {
        if (content.ids.imdb) {
            poster = `https://api.ratingposterdb.com/${rpdbKey}/imdb/poster-default/${content.ids.imdb}.jpg`;
        } else if (content.ids.tmdb) {
            poster = `https://api.ratingposterdb.com/${rpdbKey}/tmdb/poster-default/${content.ids.tmdb}.jpg`;
        } else if ('tvdb' in content.ids && content.ids.tvdb) {
            poster = `https://api.ratingposterdb.com/${rpdbKey}/tvdb/poster-default/${content.ids.tvdb}.jpg`;
        }
    }

    // Determine the primary ID to be used for consistency
    const metaId = content.ids.imdb || `tt${content.ids.tmdb}` || `trakt:${content.ids.trakt}`;

    // Fetch Episodes if Series
    const videos: { id: string; title: string; released: string; thumbnail?: string | null; season: number; episode: number; overview?: string }[] = [];
    if (type === 'series' && content.ids.trakt) {
        try {
            // 1. Get List of seasons (basic info)
            const seasons = await trakt.getShowSeasons(content.ids.trakt.toString(), false);
            
            // 2. Fetch episode details with concurrency limit to avoid overloading the API
            const filteredSeasons = seasons.filter(s => s.number > 0);
            const CONCURRENCY = 5;
            const allSeasonsEpisodes: Awaited<ReturnType<typeof trakt.getSeasonEpisodes>>[] = [];
            for (let i = 0; i < filteredSeasons.length; i += CONCURRENCY) {
              const batch = filteredSeasons.slice(i, i + CONCURRENCY);
              const results = await Promise.all(
                batch.map(s => trakt.getSeasonEpisodes(content.ids.trakt.toString(), s.number, true))
              );
              allSeasonsEpisodes.push(...results);
            }
            
            // 3. Flat map all episodes into the videos array
            for (const seasonEpisodes of allSeasonsEpisodes) {
                if (seasonEpisodes && Array.isArray(seasonEpisodes)) {
                     for (const episode of seasonEpisodes) {
                         let thumbnail = null;
                         if (episode.images?.screenshot) {
                                if (Array.isArray(episode.images.screenshot) && episode.images.screenshot.length > 0) {
                                     thumbnail = episode.images.screenshot[0];
                                } else if (!Array.isArray(episode.images.screenshot) && typeof episode.images.screenshot === 'object' && episode.images.screenshot.thumb) {
                                     thumbnail = episode.images.screenshot.thumb; 
                                } else if (typeof episode.images.screenshot === 'string') {
                                     thumbnail = episode.images.screenshot;
                                }
                         }

                         // Ensure thumbnail is HTTPS
                         if (thumbnail && !thumbnail.startsWith('http')) {
                             thumbnail = `https://${thumbnail}`;
                         }

                         // Log the first thumbnail to help debugging
                         if (thumbnail && videos.length === 0) {
                             logger.info(`Sample Episode Thumbnail: ${thumbnail}`);
                         }
 
                         videos.push({
                            id: `${metaId}:${episode.season}:${episode.number}`,
                            title: episode.title || `Episode ${episode.number}`,
                            released: episode.first_aired || new Date().toISOString(),
                            season: episode.season,
                            episode: episode.number,
                            thumbnail: thumbnail, 
                            overview: episode.overview 
                         });
                     }
                }
            }
            
            // Sort by season and episode
            videos.sort((a, b) => {
                if (a.season !== b.season) return a.season - b.season;
                return a.episode - b.episode;
            });
        } catch (e) {
            logger.warn(`Failed to fetch episodes for ${content.title}`, e);
        }
    }

    const meta: StremioMeta = {
        id: metaId,
        type: type,
        name: content.title,
        poster: poster,
        background: background,
        logo: logo,
        description: content.overview || '',
        releaseInfo: content.year ? `${content.year}` : '',
        imdbRating: content.rating ? content.rating.toFixed(1) : undefined,
        genres: content.genres,
        runtime: content.runtime ? `${content.runtime} min` : undefined,
        videos: videos.length > 0 ? videos : undefined
    };

    return NextResponse.json({ meta }, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': '*',
            'Cache-Control': 'max-age=86400' // Cache meta for 24 hours
        }
    });

  } catch (e) {
      logger.error('Meta fetch failed', e);
      return NextResponse.json({ meta: null }, { headers: { 'Access-Control-Allow-Origin': '*' } });
  }
}
