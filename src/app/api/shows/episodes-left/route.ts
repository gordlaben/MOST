import { TraktClient } from '@/lib/trakt';
import { getTraktCredentials } from '@/lib/settings';
import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { prefetchImages } from '@/lib/images';
import { logger } from '@/lib/logger';
import { createRequestContext } from '@/lib/request-logging';
import { getAppConfig } from '@/lib/config';

export async function GET(request: NextRequest) {
  const ctx = createRequestContext(request, 'api/shows/episodes-left');
  const searchParams = request.nextUrl.searchParams;
  const forceRefresh = searchParams.get('force') === 'true';

  // Get Filters from Query Params
  const includeEnded = searchParams.get('includeEnded') !== 'false';
  const includeCanceled = searchParams.get('includeCanceled') !== 'false';
  const includeReturning = searchParams.get('includeReturning') !== 'false';
  const sortBy = (searchParams.get('sortBy') as 'newest' | 'oldest' | 'title' | 'title_z_a' | 'rating_desc' | 'rating_asc' | 'random') || 'newest';
  const profileId = searchParams.get('profileId') || undefined;

  const filters = { includeEnded, includeCanceled, includeReturning, sortBy };
  const cacheKey = `episodes-left-shows-${profileId || 'default'}-${JSON.stringify(filters)}`;

  // Check cache first
  if (!forceRefresh) {
    const cached = await prisma.calendarCache.findUnique({
      where: { id: cacheKey },
    });

    if (cached) {
      const cacheAge = Date.now() - cached.updatedAt.getTime();
      // Cache for 24 hours
      if (cacheAge < 24 * 60 * 60 * 1000) {
        try {
          const data = JSON.parse(cached.data);
          const response = NextResponse.json(data, {
            headers: { 'X-Cache': 'HIT' }
          });
          ctx.end(response.status);
          return response;
        } catch {
          // If JSON parse fails, ignore cache
        }
      }
    }
  }

  const { clientId, clientSecret, accessToken } = await getTraktCredentials(profileId);

  if (!accessToken) {
    const response = NextResponse.json({ error: 'Not connected to Trakt' }, { status: 401 });
    ctx.end(response.status);
    return response;
  }

  const { traktClientId, traktClientSecret, nextPublicBaseUrl } = getAppConfig();

  const trakt = new TraktClient(
    clientId || traktClientId || '',
    clientSecret || traktClientSecret || '',
    nextPublicBaseUrl,
    accessToken,
    profileId
  );

  try {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let closed = false;
        const isAborted = () => request.signal.aborted;
        const safeEnqueue = (data: string) => {
          if (closed || isAborted()) {
            return;
          }
          try {
            controller.enqueue(encoder.encode(data));
          } catch {
            // Controller closed (client hung up), ignore
          }
        };
        const safeClose = () => {
          if (closed) {
            return;
          }
          closed = true;
          try {
            controller.close();
          } catch {
            // Ignore double-close
          }
        };
        const safeError = (error: unknown) => {
          if (closed || isAborted()) {
            return;
          }
          closed = true;
          try {
            controller.error(error);
          } catch {
            // Ignore if already closed
          }
        };
        try {
          const shows = await trakt.getEpisodesLeftShows((message, current, total) => {
             const progress = { type: 'progress', message, current, total };
             safeEnqueue(JSON.stringify(progress) + '\n');
          }, { ...filters, forceRefresh });
          
          // Calculate API Stats
          const calls = trakt.requestCount;
          const minIntervalMinutes = Math.ceil(Math.max(15, (calls / 900) * 5));
          
          const stats = { type: 'stats', calls, minIntervalMinutes };
          safeEnqueue(JSON.stringify(stats) + '\n');

          // Update cache
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

          // Cache images in background
          (async () => {
            try {
              logger.info(`Starting background image caching for Episodes Left shows`);
              const posterUrls: string[] = [];
              for (const item of shows) {
                const content = item.show;
                if (content?.images?.poster) {
                   let posterUrl = '';
                   if (Array.isArray(content.images.poster) && content.images.poster.length > 0) {
                      posterUrl = content.images.poster[0];
                   } else if (!Array.isArray(content.images.poster) && typeof content.images.poster === 'object' && content.images.poster?.thumb) {
                      posterUrl = content.images.poster.thumb;
                   } else if (typeof content.images.poster === 'string') {
                      posterUrl = content.images.poster;
                   }
      
                   if (posterUrl) {
                     posterUrls.push(posterUrl);
                   }
                }
              }
              await prefetchImages(posterUrls, profileId, 20);
              logger.info(`Queued ${posterUrls.length} images for Episodes Left shows`);
            } catch (e) {
              logger.error(`Failed to cache images for Episodes Left shows`, e);
            }
          })();

          const result = { type: 'result', data: shows };
          safeEnqueue(JSON.stringify(result) + '\n');
          safeClose();
        } catch (e) {
          console.error('Error in stream:', e);
          safeError(e);
        }
      }
    });

    const response = new Response(stream, {
      headers: { 
        'Content-Type': 'application/x-ndjson',
        'X-Cache': 'MISS'
      }
    });
    ctx.end(response.status);
    return response;
  } catch (error) {
    console.error('Failed to fetch episodes left shows:', error);
    const response = NextResponse.json({ error: 'Failed to fetch shows' }, { status: 500 });
    ctx.end(response.status);
    return response;
  }
}
