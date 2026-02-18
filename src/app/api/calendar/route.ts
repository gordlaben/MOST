import { TraktClient, TraktShow } from '@/lib/trakt';
import { getTraktCredentials } from '@/lib/settings';
import { prisma } from '@/lib/db';
import ical from 'ical-generator';
import { NextRequest, NextResponse } from 'next/server';
import { createRequestContext } from '@/lib/request-logging';
import { z } from 'zod';
import { getAppConfig } from '@/lib/config';
import { createServerTiming } from '@/lib/server-timing';
import { CACHE_TTL, getCalendarHeaders, isCacheFresh } from '@/lib/cache-policy';
import { finalizeApiResponse } from '@/lib/route-response';

export async function GET(request: NextRequest) {
  const ctx = createRequestContext(request, 'api/calendar');
  const timing = createServerTiming();
  const searchParams = request.nextUrl.searchParams;
  const forceParam = searchParams.get('force');
  const querySchema = z.object({
    force: z.enum(['true', 'false']).optional()
  });

  const parsed = querySchema.safeParse({ force: forceParam || undefined });
  if (!parsed.success) {
    const response = NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
    return finalizeApiResponse(response, { ctx });
  }

  const forceRefresh = forceParam === 'true';

  // Check cache first
  if (!forceRefresh) {
    const cached = await prisma.calendarCache.findUnique({
      where: { id: 'default' },
    });

    if (cached) {
      if (isCacheFresh(cached.updatedAt, CACHE_TTL.calendarMs)) {
        const response = new NextResponse(cached.data, {
          headers: getCalendarHeaders('HIT'),
        });
        return finalizeApiResponse(response, { ctx, timing, metricName: 'calendar' });
      }
    }
  }

  const { clientId, clientSecret, accessToken } = await getTraktCredentials();
  const { traktClientId, traktClientSecret, nextPublicBaseUrl } = getAppConfig();

  try {
    const trakt = new TraktClient(
      clientId || traktClientId || '',
      clientSecret || traktClientSecret || '',
      nextPublicBaseUrl,
      accessToken || undefined
    );

    const calendar = ical({ name: 'Most Binge Calendar' });

    let showsToCheck: TraktShow[] = [];

    if (accessToken) {
      // If connected, fetch the user's actual active shows
      showsToCheck = await trakt.getUserWatching();
    } else {
      // Fallback to trending if not connected (or return empty)
      showsToCheck = await trakt.getTrendingShows();
      showsToCheck = showsToCheck.slice(0, 5);
    }

    // Process in batches
    const BATCH_SIZE = 5;
    for (let i = 0; i < showsToCheck.length; i += BATCH_SIZE) {
        const batch = showsToCheck.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (show: TraktShow) => {
            try {
                // Pass both slug and trakt ID to enable DB caching
                const status = await trakt.checkBingeReady({ trakt: show.ids.trakt, slug: show.ids.slug });
                
                // Only add event if the release date is in the future
                if (status.releaseDate && status.lastEpisode && status.releaseDate > new Date()) {
                  calendar.createEvent({
                    start: status.releaseDate,
                    end: status.releaseDate, // All day event or specific time
                    allDay: true,
                    summary: `Binge Ready: ${show.title} Season ${status.lastEpisode.season}`,
                    description: `The final episode "${status.lastEpisode.title}" of ${show.title} Season ${status.lastEpisode.season} has aired! The season is now ready to binge.`,
                    url: `https://trakt.tv/shows/${show.ids.slug}`,
                  });
                }
            } catch (e) {
                console.error(`Error processing show ${show.title}:`, e);
            }
        }));
    }

    const calendarData = calendar.toString();

    // Update cache
    await prisma.calendarCache.upsert({
      where: { id: 'default' },
      update: { data: calendarData },
      create: { id: 'default', data: calendarData },
    });

    const response = new NextResponse(calendarData, {
      headers: getCalendarHeaders('MISS'),
    });
    return finalizeApiResponse(response, { ctx, timing, metricName: 'calendar' });
  } catch (error) {
     console.error('Error generating calendar:', error);
    
     // Attempt to return stale cache
     const cached = await prisma.calendarCache.findUnique({
       where: { id: 'default' },
     });
     
     if (cached) {
        const response = new NextResponse(cached.data, {
            headers: getCalendarHeaders('STALE-ERROR'),
        });
        return finalizeApiResponse(response, { ctx, timing, metricName: 'calendar' });
     }

      const response = new NextResponse('Error generating calendar', { status: 500 });
      return finalizeApiResponse(response, { ctx, timing, metricName: 'calendar' });
  }
}
