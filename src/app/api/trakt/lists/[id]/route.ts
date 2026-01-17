import { NextRequest, NextResponse } from 'next/server';
import { getTraktCredentials } from '@/lib/settings';
import { TraktClient } from '@/lib/trakt';
import { createRequestContext } from '@/lib/request-logging';
import { z } from 'zod';
import { createServerTiming } from '@/lib/server-timing';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = createRequestContext(request, 'api/trakt/lists/[id]');
  const timing = createServerTiming();

  try {
    const { id } = await params;
    const body = await request.json();
    const bodySchema = z.object({
      profileId: z.string().min(1),
      name: z.string().min(1)
    });

    const parsedBody = bodySchema.safeParse(body);
    if (!parsedBody.success) {
      const response = NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
      timing.appendTo(response, 'trakt_list_update');
      ctx.end(response.status);
      return response;
    }

    const { profileId, name } = parsedBody.data;

    if (!profileId || !id) {
      const response = NextResponse.json({ error: 'Profile ID and List ID required' }, { status: 400 });
      timing.appendTo(response, 'trakt_list_update');
      ctx.end(response.status);
      return response;
    }

    const { clientId, clientSecret, accessToken } = await getTraktCredentials(profileId);
    if (!accessToken) {
      const response = NextResponse.json({ error: 'Not connected to Trakt' }, { status: 401 });
      timing.appendTo(response, 'trakt_list_update');
      ctx.end(response.status);
      return response;
    }

    const trakt = new TraktClient(clientId || '', clientSecret || '', '', accessToken);

    const details = await trakt.getListDetails('me', id);
    const typed = details as { description?: string; privacy?: string } | null;

    const description = typed?.description || '';
    const privacy = typed?.privacy || 'private';

    const list = await trakt.updateList(id, name, description, privacy);

    const response = NextResponse.json(list);
    timing.appendTo(response, 'trakt_list_update');
    ctx.end(response.status);
    return response;
  } catch (error) {
    ctx.log.error('Failed to update list', error);
    const response = NextResponse.json({ error: 'Failed to update list' }, { status: 500 });
    timing.appendTo(response, 'trakt_list_update');
    ctx.end(response.status);
    return response;
  }
}
