import { TraktClient, TraktBingeReadyShow, TraktEpisodeLeftShow } from '@/lib/trakt';
import { getTraktCredentials } from '@/lib/settings';
import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { showId, seasonNumber, profileId, type } = body;

  const { clientId, clientSecret, accessToken } = await getTraktCredentials(profileId);

  if (!accessToken) {
    return NextResponse.json({ error: 'Not connected to Trakt' }, { status: 401 });
  }

  try {
    if (!showId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const trakt = new TraktClient(
      clientId || '',
      clientSecret || '',
      '', // redirectUri not needed for this call
      accessToken
    );

    let result;
    if (type === 'movie') {
      result = await trakt.markMovieWatched(showId);
    } else {
      if (seasonNumber === undefined) {
        return NextResponse.json({ error: 'Missing season number' }, { status: 400 });
      }
      result = await trakt.markSeasonWatched(showId, seasonNumber);
    }

    // Update caches
    const cacheKeys = ['binge-ready-shows', 'episodes-left-shows'];

    for (const key of cacheKeys) {
      const cached = await prisma.calendarCache.findUnique({
        where: { id: key },
      });

      if (cached) {
        try {
          const shows = JSON.parse(cached.data);
          // Remove the item that was just marked as watched
          const updatedShows = shows.filter((s: TraktBingeReadyShow | TraktEpisodeLeftShow) => {
            const content = s.show;
            return content?.ids?.slug !== showId;
          });
          
          await prisma.calendarCache.update({
            where: { id: key },
            data: { data: JSON.stringify(updatedShows) },
          });
        } catch {
          // If parsing fails, just delete the cache
          await prisma.calendarCache.delete({
            where: { id: key }
          }).catch(() => {});
        }
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error marking watched:', error);
    return NextResponse.json({ error: 'Failed to mark as watched' }, { status: 500 });
  }
}
