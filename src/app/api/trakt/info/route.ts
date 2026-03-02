import { NextResponse } from 'next/server';
import { TraktClient } from '@/lib/trakt';
import { getTraktCredentials } from '@/lib/settings';
import { logger } from '@/lib/logger';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const profileId = searchParams.get('profileId');
  const id = searchParams.get('id');
  const type = searchParams.get('type'); // 'movie' or 'show'

  if (!profileId || !id || !type) {
    return NextResponse.json({ error: 'Missing profileId, id or type' }, { status: 400 });
  }

  try {
    const { clientId, clientSecret, accessToken } = await getTraktCredentials(profileId);

    if (!clientId || !clientSecret || !accessToken) {
      return NextResponse.json({ error: 'Missing Trakt credentials' }, { status: 401 });
    }

    const trakt = new TraktClient(clientId, clientSecret, '', accessToken, profileId);
    
    // We need to fetch the single item with extended info
    const contentType = type === 'movie' ? 'movie' : 'show';
    const [data, watchlistItems] = await Promise.all([
        trakt.getContent(contentType, id),
        trakt.getListItems('watchlist', 'me').catch((e) => {
             logger.error('Failed to check watchlist status', e);
             return [];
        })
    ]);

    // Check if in watchlist
    let inWatchlist = false;
    if (Array.isArray(watchlistItems)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        inWatchlist = watchlistItems.some((item: any) => {
            const itemContent = item.show || item.movie || item;
            if (!itemContent || !itemContent.ids) return false;
            // Check Trakt ID or Slug
            // data.ids might be just the object if getContent returns it directly
            const targetIds = (data as { ids: { trakt: number } }).ids; 
            return itemContent.ids.trakt === targetIds.trakt;
        });
    }

    return NextResponse.json({ ...data, inWatchlist });
  } catch (error) {
    logger.error('Error fetching item info:', error);
    return NextResponse.json({ error: 'Failed to fetch info' }, { status: 500 });
  }
}
