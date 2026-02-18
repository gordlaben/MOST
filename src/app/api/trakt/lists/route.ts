import { NextRequest, NextResponse } from 'next/server';
import { getTraktCredentials } from '@/lib/settings';
import { TraktClient } from '@/lib/trakt';
import { createRequestContext } from '@/lib/request-logging';
import { z } from 'zod';
import { createServerTiming } from '@/lib/server-timing';
import { parseAndValidateJson, validateQuery } from '@/lib/request-validation';
import { finalizeApiResponse } from '@/lib/route-response';

const bodySchema = z.object({
  profileId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  privacy: z.enum(['private', 'friends', 'public']).optional()
});

export async function GET(request: NextRequest) {
  const ctx = createRequestContext(request, 'api/trakt/lists');
  const timing = createServerTiming();
  const searchParams = request.nextUrl.searchParams;
  const profileId = searchParams.get('profileId');

  const querySchema = z.object({
    profileId: z.string().min(1)
  });

  const parsed = validateQuery(querySchema, { profileId });
  if (!parsed.success) {
    return finalizeApiResponse(parsed.errorResponse, { ctx, timing, metricName: 'trakt_lists' });
  }

  if (!profileId) {
    const response = NextResponse.json({ error: 'Profile ID required' }, { status: 400 });
    return finalizeApiResponse(response, { ctx });
  }

  try {
    const { clientId, clientSecret, accessToken } = await getTraktCredentials(profileId);

    if (!accessToken) {
      const response = NextResponse.json({ error: 'Not connected to Trakt' }, { status: 401 });
      return finalizeApiResponse(response, { ctx, timing, metricName: 'trakt_lists' });
    }

    const trakt = new TraktClient(
      clientId || '',
      clientSecret || '',
      '',
      accessToken
    );

    const lists = await trakt.getUserLists();
    const response = NextResponse.json(lists);
    return finalizeApiResponse(response, { ctx, timing, metricName: 'trakt_lists' });
  } catch (error) {
    ctx.log.error('Failed to fetch user lists', error);
    const response = NextResponse.json({ error: 'Failed to fetch lists' }, { status: 500 });
    return finalizeApiResponse(response, { ctx, timing, metricName: 'trakt_lists' });
  }
}

export async function POST(request: NextRequest) {
  const ctx = createRequestContext(request, 'api/trakt/lists');
  const timing = createServerTiming();
  try {
    const parsedBody = await parseAndValidateJson(request, bodySchema);
    if (!parsedBody.success) {
      return finalizeApiResponse(parsedBody.errorResponse, { ctx, timing, metricName: 'trakt_lists' });
    }

    const { profileId, name, description, privacy } = parsedBody.data;

    if (!profileId || !name) {
      const response = NextResponse.json({ error: 'Profile ID and Name required' }, { status: 400 });
      return finalizeApiResponse(response, { ctx, timing, metricName: 'trakt_lists' });
    }

    const { clientId, clientSecret, accessToken } = await getTraktCredentials(profileId);
    if (!accessToken) {
      const response = NextResponse.json({ error: 'Not connected to Trakt' }, { status: 401 });
      return finalizeApiResponse(response, { ctx, timing, metricName: 'trakt_lists' });
    }

    const trakt = new TraktClient(clientId || '', clientSecret || '', '', accessToken);
    const list = await trakt.createList(name, description || '', privacy || 'private');
    
    const response = NextResponse.json(list);
    return finalizeApiResponse(response, { ctx, timing, metricName: 'trakt_lists' });
  } catch (error) {
    ctx.log.error('Failed to create list', error);
    const response = NextResponse.json({ error: 'Failed to create list' }, { status: 500 });
    return finalizeApiResponse(response, { ctx, timing, metricName: 'trakt_lists' });
  }
}
