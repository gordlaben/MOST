import { TraktClient, TraktShow } from '@/lib/trakt';
import { getTraktCredentials } from '@/lib/settings';
import { prisma } from '@/lib/db';
import ical from 'ical-generator';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const forceRefresh = searchParams.get('force') === 'true';

  // Check cache first
  if (!forceRefresh) {
    const cached = await prisma.calendarCache.findUnique({
      where: { id: 'default' },
    });

    if (cached) {
      const cacheAge = Date.now() - cached.updatedAt.getTime();
      // Cache for 24 hours (daily sync)
      if (cacheAge < 24 * 60 * 60 * 1000) {
        return new NextResponse(cached.data, {
          headers: {
            'Content-Type': 'text/calendar; charset=utf-8',
            'Content-Disposition': 'attachment; filename="most.ics"',
            'X-Cache': 'HIT',
          },
        });
      }
    }
  }

  const { clientId, clientSecret, accessToken } = await getTraktCredentials();

  try {
    const trakt = new TraktClient(
      clientId || process.env.TRAKT_CLIENT_ID || '',
      clientSecret || process.env.TRAKT_CLIENT_SECRET || '',
      process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
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

    return new NextResponse(calendarData, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="most.ics"',
        'X-Cache': 'MISS',
      },
    });
  } catch (error) {
     console.error('Error generating calendar:', error);
    
     // Attempt to return stale cache
     const cached = await prisma.calendarCache.findUnique({
       where: { id: 'default' },
     });
     
     if (cached) {
        return new NextResponse(cached.data, {
           headers: {
             'Content-Type': 'text/calendar; charset=utf-8',
             'Content-Disposition': 'attachment; filename="most.ics"',
             'X-Cache': 'STALE-ERROR',
           },
        });
     }

     return new NextResponse('Error generating calendar', { status: 500 });
  }
}
