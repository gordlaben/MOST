
import { NextResponse } from 'next/server';
import { TraktClient } from '@/lib/trakt';
import { getTraktCredentials } from '@/lib/settings';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { profileId, item, type, action } = body;

    if (!profileId || !item || !type || !action) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const { clientId, clientSecret, accessToken } = await getTraktCredentials(profileId);
    if (!clientId || !clientSecret || !accessToken) {
      return NextResponse.json({ error: 'Missing Trakt credentials' }, { status: 401 });
    }

    const trakt = new TraktClient(clientId, clientSecret, '', accessToken, profileId);

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
