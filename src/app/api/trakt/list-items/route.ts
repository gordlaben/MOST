import { NextResponse } from 'next/server';
import { TraktClient } from '@/lib/trakt';
import { getTraktCredentials } from '@/lib/settings';
import { createRequestContext } from '@/lib/request-logging';
import { z } from 'zod';
import { createServerTiming } from '@/lib/server-timing';

export async function GET(request: Request) {
  const ctx = createRequestContext(request, 'api/trakt/list-items');
  const timing = createServerTiming();
  const start = Date.now();
  const { searchParams } = new URL(request.url);
  const profileId = searchParams.get('profileId');
  const listId = searchParams.get('listId');
  const username = searchParams.get('username') || undefined;
  const limitParam = searchParams.get('limit');
  const sortByParam = searchParams.get('sortBy');
  const typeParam = searchParams.get('type');
  const includeEndedParam = searchParams.get('includeEnded');
  const includeCanceledParam = searchParams.get('includeCanceled');
  const includeReturningParam = searchParams.get('includeReturning');

  const querySchema = z.object({
    profileId: z.string().min(1),
    listId: z.string().min(1),
    username: z.string().optional(),
    limit: z.string().regex(/^\d+$/).optional(),
    sortBy: z.enum(['newest', 'oldest', 'title', 'title_z_a', 'random']).optional(),
    type: z.enum(['movie', 'show']).optional(),
    includeEnded: z.enum(['true', 'false']).optional(),
    includeCanceled: z.enum(['true', 'false']).optional(),
    includeReturning: z.enum(['true', 'false']).optional()
  });

  const parsed = querySchema.safeParse({
    profileId,
    listId,
    username,
    limit: limitParam || undefined,
    sortBy: sortByParam || undefined,
    type: typeParam || undefined,
    includeEnded: includeEndedParam || undefined,
    includeCanceled: includeCanceledParam || undefined,
    includeReturning: includeReturningParam || undefined
  });

  if (!parsed.success) {
    const response = NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
    timing.appendTo(response, 'trakt_list_items');
    ctx.end(response.status);
    return response;
  }

  const limit = limitParam ? parseInt(limitParam, 10) : undefined;
  const sortBy = (sortByParam as 'newest' | 'oldest' | 'title' | 'title_z_a' | 'random') || undefined;
  const type = (typeParam as 'movie' | 'show') || undefined;
  
  const includeEnded = includeEndedParam !== 'false';
  const includeCanceled = includeCanceledParam !== 'false';
  const includeReturning = includeReturningParam !== 'false';
  const filters = { includeEnded, includeCanceled, includeReturning, type };

  if (!profileId || !listId) {
    const response = NextResponse.json({ error: 'Missing profileId or listId' }, { status: 400 });
    timing.appendTo(response, 'trakt_list_items');
    ctx.end(response.status);
    return response;
  }

  try {
    const { clientId, clientSecret, accessToken } = await getTraktCredentials(profileId);

    if (!clientId || !clientSecret || !accessToken) {
      const response = NextResponse.json({ error: 'Missing Trakt credentials' }, { status: 401 });
      timing.appendTo(response, 'trakt_list_items');
      ctx.end(response.status);
      return response;
    }

    const trakt = new TraktClient(clientId, clientSecret, '', accessToken, profileId);
    
    // Pass sortBy and filters to getListItems
    const items = await trakt.getListItems(listId, username, false, limit, sortBy, filters);
    
    const duration = Date.now() - start;
    // Log meaningful info for the admin
    ctx.log.info(`List Loaded: ${listId}`, {
        profileId,
        listId,
        itemsCount: Array.isArray(items) ? items.length : 0,
        durationMs: duration,
        source: 'api-route'
    });

    const response = NextResponse.json(items, {
        headers: {
            'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
        }
    });
    timing.appendTo(response, 'trakt_list_items');
    ctx.end(response.status);
    return response;
  } catch (error) {
    const duration = Date.now() - start;
    ctx.log.error(`List Load Failed: ${listId} (${duration}ms)`, error);
    const response = NextResponse.json({ error: 'Failed to fetch list items' }, { status: 500 });
    timing.appendTo(response, 'trakt_list_items');
    ctx.end(response.status);
    return response;
  }
}

