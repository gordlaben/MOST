import { NextResponse } from 'next/server';
import { TraktClient } from '@/lib/trakt';
import { getTraktCredentials } from '@/lib/settings';
import { logger } from '@/lib/logger';

export async function GET(request: Request) {
  const start = performance.now();
  const { searchParams } = new URL(request.url);
  const profileId = searchParams.get('profileId');
  const listId = searchParams.get('listId');
  const username = searchParams.get('username') || undefined;
  const limitParam = searchParams.get('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : undefined;
  const sortBy = (searchParams.get('sortBy') as 'newest' | 'oldest' | 'title') || undefined;
  
  const includeEnded = searchParams.get('includeEnded') !== 'false';
  const includeCanceled = searchParams.get('includeCanceled') !== 'false';
  const includeReturning = searchParams.get('includeReturning') !== 'false';
  const filters = { includeEnded, includeCanceled, includeReturning };

  if (!profileId || !listId) {
    return NextResponse.json({ error: 'Missing profileId or listId' }, { status: 400 });
  }

  try {
    const { clientId, clientSecret, accessToken } = await getTraktCredentials(profileId);

    if (!clientId || !clientSecret || !accessToken) {
      return NextResponse.json({ error: 'Missing Trakt credentials' }, { status: 401 });
    }

    const trakt = new TraktClient(clientId, clientSecret, '', accessToken, profileId);
    
    // Pass sortBy and filters to getListItems
    const items = await trakt.getListItems(listId, username, false, limit, sortBy, filters);
    
    const duration = Math.round(performance.now() - start);
    // Log meaningful info for the admin
    logger.info(`List Loaded: ${listId}`, {
        profileId,
        listId,
        itemsCount: Array.isArray(items) ? items.length : 0,
        durationMs: duration,
        source: 'api-route'
    });

    return NextResponse.json(items, {
        headers: {
            'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
        }
    });
  } catch (error) {
    const duration = Math.round(performance.now() - start);
    logger.error(`List Load Failed: ${listId} (${duration}ms)`, error);
    return NextResponse.json({ error: 'Failed to fetch list items' }, { status: 500 });
  }
}

