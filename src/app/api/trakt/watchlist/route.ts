
import { NextResponse } from 'next/server';
import { getAuthorizedTraktClient } from '@/lib/route-auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { profileId, item, type, action } = body;

    if (!profileId || !item || !type || !action) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const authResult = await getAuthorizedTraktClient(profileId, {
      requireClientCredentials: true,
      notConnectedMessage: 'Missing Trakt credentials',
      missingCredentialsMessage: 'Missing Trakt credentials',
      includeProfileId: true,
    });
    if ('errorResponse' in authResult) {
      return authResult.errorResponse;
    }

    const trakt = authResult.client;

    let result;
    if (action === 'add') {
      result = await trakt.addToWatchlist(item, type);
    } else if (action === 'remove') {
      result = await trakt.removeFromWatchlist(item, type);
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Watchlist API error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
