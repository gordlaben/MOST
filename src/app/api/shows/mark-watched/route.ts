import { removeShowSlugFromSystemCaches } from '@/lib/show-cache';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizedTraktClient } from '@/lib/route-auth';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { showId, seasonNumber, profileId, type } = body;

  const authResult = await getAuthorizedTraktClient(profileId, {
    notConnectedMessage: 'Not connected to Trakt'
  });
  if ('errorResponse' in authResult) {
    return authResult.errorResponse;
  }

  try {
    if (!showId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const trakt = authResult.client;

    let result;
    if (type === 'movie') {
      result = await trakt.markMovieWatched(showId);
    } else {
      if (seasonNumber === undefined) {
        return NextResponse.json({ error: 'Missing season number' }, { status: 400 });
      }
      result = await trakt.markSeasonWatched(showId, seasonNumber);
    }

    await removeShowSlugFromSystemCaches(showId);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error marking watched:', error);
    return NextResponse.json({ error: 'Failed to mark as watched' }, { status: 500 });
  }
}
