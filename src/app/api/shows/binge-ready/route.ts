import { TraktClient } from '@/lib/trakt';
import { getTraktCredentials } from '@/lib/settings';
import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { cacheImage } from '@/lib/images';
import { logger } from '@/lib/logger';
import { createRequestContext } from '@/lib/request-logging';
import { getAppConfig } from '@/lib/config';

export async function GET(request: NextRequest) {
  const ctx = createRequestContext(request, 'api/shows/binge-ready');
  const searchParams = request.nextUrl.searchParams;
  const forceRefresh = searchParams.get('force') === 'true';

  // Get Filters from Query Params
  const includeEnded = searchParams.get('includeEnded') !== 'false';
  const includeCanceled = searchParams.get('includeCanceled') !== 'false';
  const includeReturning = searchParams.get('includeReturning') !== 'false';
  const sortBy = (searchParams.get('sortBy') as 'newest' | 'oldest' | 'title') || 'newest';
  const profileId = searchParams.get('profileId') || undefined;

  const filters = { includeEnded, includeCanceled, includeReturning, sortBy };
  const cacheKey = `binge-ready-shows-${profileId || 'default'}-${JSON.stringify(filters)}`;

  // Check cache first
  if (!forceRefresh) {
    const cached = await prisma.calendarCache.findUnique({
      where: { id: cacheKey },
    });

    if (cached) {
      const cacheAge = Date.now() - cached.updatedAt.getTime();
      // Cache for 24 hours (matches calendar sync)
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
        try {
          const shows = await trakt.getBingeReadyShows((message, current, total) => {
             const progress = { type: 'progress', message, current, total };
             try {
                controller.enqueue(encoder.encode(JSON.stringify(progress) + '\n'));
             } catch (e) {
                // Controller closed (client hung up), ignore
             }
          }, { ...filters, forceRefresh });
          
          // Calculate API Stats
          const calls = trakt.requestCount;
          // Limit is 1000 calls / 5 mins (300s). Safe limit 900.
          // If calls < 900, we can refresh every 5 mins.
          // If calls > 900, we need (calls / 900) * 5 mins.
          const minIntervalMinutes = Math.ceil(Math.max(15, (calls / 900) * 5));
          
          const stats = { type: 'stats', calls, minIntervalMinutes };
          controller.enqueue(encoder.encode(JSON.stringify(stats) + '\n'));

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
              logger.info(`Starting background image caching for Binge Ready shows`);
              let count = 0;
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
                     await cacheImage(posterUrl);
                     count++;
                   }
                }
              }
              logger.info(`Cached ${count} images for Binge Ready shows`);
            } catch (e) {
              logger.error(`Failed to cache images for Binge Ready shows`, e);
            }
          })();

          const result = { type: 'result', data: shows };
          controller.enqueue(encoder.encode(JSON.stringify(result) + '\n'));
          controller.close();
        } catch (e) {
          console.error('Error in stream:', e);
          controller.error(e);
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
    console.error('Error fetching binge ready shows:', error);
    const response = NextResponse.json({ error: 'Failed to fetch shows' }, { status: 500 });
    ctx.end(response.status);
    return response;
  }
}