import { NextRequest, NextResponse } from 'next/server';
import { getTraktCredentials } from '@/lib/settings';
import { TraktClient } from '@/lib/trakt';
import { createRequestContext } from '@/lib/request-logging';
import { z } from 'zod';
import { createServerTiming } from '@/lib/server-timing';

export async function GET(request: NextRequest) {
  const ctx = createRequestContext(request, 'api/trakt/lists');
  const timing = createServerTiming();
  const searchParams = request.nextUrl.searchParams;
  const profileId = searchParams.get('profileId');

  const querySchema = z.object({
    profileId: z.string().min(1)
  });

  const parsed = querySchema.safeParse({ profileId });
  if (!parsed.success) {
    const response = NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
    timing.appendTo(response, 'trakt_lists');
    ctx.end(response.status);
    return response;
  }

  if (!profileId) {
    const response = NextResponse.json({ error: 'Profile ID required' }, { status: 400 });
    ctx.end(response.status);
    return response;
  }

  try {
    const { clientId, clientSecret, accessToken } = await getTraktCredentials(profileId);

    if (!accessToken) {
      const response = NextResponse.json({ error: 'Not connected to Trakt' }, { status: 401 });
      timing.appendTo(response, 'trakt_lists');
      ctx.end(response.status);
      return response;
    }

    const trakt = new TraktClient(
      clientId || '',
      clientSecret || '',
      '',
      accessToken
    );

    const lists = await trakt.getUserLists();
    const response = NextResponse.json(lists);
    timing.appendTo(response, 'trakt_lists');
    ctx.end(response.status);
    return response;
  } catch (error) {
    ctx.log.error('Failed to fetch user lists', error);
    const response = NextResponse.json({ error: 'Failed to fetch lists' }, { status: 500 });
    timing.appendTo(response, 'trakt_lists');
    ctx.end(response.status);
    return response;
  }
}

export async function POST(request: NextRequest) {
  const ctx = createRequestContext(request, 'api/trakt/lists');
  const timing = createServerTiming();
  try {
    const body = await request.json();
    const bodySchema = z.object({
      profileId: z.string().min(1),
      name: z.string().min(1),
      description: z.string().optional(),
      privacy: z.enum(['private', 'friends', 'public']).optional()
    });

    const parsedBody = bodySchema.safeParse(body);
    if (!parsedBody.success) {
      const response = NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
      timing.appendTo(response, 'trakt_lists');
      ctx.end(response.status);
      return response;
    }

    const { profileId, name, description, privacy } = parsedBody.data;

    if (!profileId || !name) {
      const response = NextResponse.json({ error: 'Profile ID and Name required' }, { status: 400 });
      timing.appendTo(response, 'trakt_lists');
      ctx.end(response.status);
      return response;
    }

    const { clientId, clientSecret, accessToken } = await getTraktCredentials(profileId);
    if (!accessToken) {
      const response = NextResponse.json({ error: 'Not connected to Trakt' }, { status: 401 });
      timing.appendTo(response, 'trakt_lists');
      ctx.end(response.status);
      return response;
    }

    const trakt = new TraktClient(clientId || '', clientSecret || '', '', accessToken);
    const list = await trakt.createList(name, description || '', privacy || 'private');
    
    const response = NextResponse.json(list);
    timing.appendTo(response, 'trakt_lists');
    ctx.end(response.status);
    return response;
  } catch (error) {
    ctx.log.error('Failed to create list', error);
    const response = NextResponse.json({ error: 'Failed to create list' }, { status: 500 });
    timing.appendTo(response, 'trakt_lists');
    ctx.end(response.status);
    return response;
  }
}
