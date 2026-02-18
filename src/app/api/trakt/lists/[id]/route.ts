import { NextRequest, NextResponse } from 'next/server';
import { getTraktCredentials } from '@/lib/settings';
import { TraktClient } from '@/lib/trakt';
import { createRequestContext } from '@/lib/request-logging';
import { z } from 'zod';
import { createServerTiming } from '@/lib/server-timing';
import { parseAndValidateJson } from '@/lib/request-validation';
import { finalizeApiResponse } from '@/lib/route-response';

const updateBodySchema = z.object({
  profileId: z.string().min(1),
  name: z.string().min(1)
});

const deleteBodySchema = z.object({
  profileId: z.string().min(1)
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = createRequestContext(request, 'api/trakt/lists/[id]');
  const timing = createServerTiming();

  try {
    const { id } = await params;
    const parsedBody = await parseAndValidateJson(request, updateBodySchema);
    if (!parsedBody.success) {
      return finalizeApiResponse(parsedBody.errorResponse, { ctx, timing, metricName: 'trakt_list_update' });
    }

    const { profileId, name } = parsedBody.data;

    if (!profileId || !id) {
      const response = NextResponse.json({ error: 'Profile ID and List ID required' }, { status: 400 });
      return finalizeApiResponse(response, { ctx, timing, metricName: 'trakt_list_update' });
    }

    const { clientId, clientSecret, accessToken } = await getTraktCredentials(profileId);
    if (!accessToken) {
      const response = NextResponse.json({ error: 'Not connected to Trakt' }, { status: 401 });
      return finalizeApiResponse(response, { ctx, timing, metricName: 'trakt_list_update' });
    }

    const trakt = new TraktClient(clientId || '', clientSecret || '', '', accessToken);

    let resolvedListId = id;
    let description = '';
    let privacy = 'private';

    try {
      const details = await trakt.getListDetails('me', id);
      const typed = details as { description?: string; privacy?: string } | null;
      description = typed?.description || '';
      privacy = typed?.privacy || 'private';
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 400 || status === 404) {
        const lists = await trakt.getUserLists(true);
        const match = Array.isArray(lists)
          ? lists.find((list) => list?.ids?.slug === id || String(list?.ids?.trakt) === id)
          : null;

        if (!match?.ids?.slug) {
          const response = NextResponse.json({ error: 'List not found on Trakt' }, { status: 404 });
          return finalizeApiResponse(response, { ctx, timing, metricName: 'trakt_list_update' });
        }

        resolvedListId = match.ids.slug;
        description = match.description || '';
        privacy = match.privacy || 'private';
      } else {
        throw error;
      }
    }

    const list = await trakt.updateList(resolvedListId, name, description, privacy);

    const response = NextResponse.json(list);
    return finalizeApiResponse(response, { ctx, timing, metricName: 'trakt_list_update' });
  } catch (error) {
    ctx.log.error('Failed to update list', error);
    const response = NextResponse.json({ error: 'Failed to update list' }, { status: 500 });
    return finalizeApiResponse(response, { ctx, timing, metricName: 'trakt_list_update' });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = createRequestContext(request, 'api/trakt/lists/[id]');
  const timing = createServerTiming();

  try {
    const { id } = await params;
    const parsedBody = await parseAndValidateJson(request, deleteBodySchema);
    if (!parsedBody.success) {
      return finalizeApiResponse(parsedBody.errorResponse, { ctx, timing, metricName: 'trakt_list_delete' });
    }

    const { profileId } = parsedBody.data;

    if (!profileId || !id) {
      const response = NextResponse.json({ error: 'Profile ID and List ID required' }, { status: 400 });
      return finalizeApiResponse(response, { ctx, timing, metricName: 'trakt_list_delete' });
    }

    const { clientId, clientSecret, accessToken } = await getTraktCredentials(profileId);
    if (!accessToken) {
      const response = NextResponse.json({ error: 'Not connected to Trakt' }, { status: 401 });
      return finalizeApiResponse(response, { ctx, timing, metricName: 'trakt_list_delete' });
    }

    const trakt = new TraktClient(clientId || '', clientSecret || '', '', accessToken);
    try {
      await trakt.deleteList(id);
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 400 || status === 404) {
        const lists = await trakt.getUserLists(true);
        const match = Array.isArray(lists)
          ? lists.find((list) => list?.ids?.slug === id || String(list?.ids?.trakt) === id)
          : null;

        if (match?.ids?.trakt) {
          await trakt.deleteList(String(match.ids.trakt));
        } else {
          const response = NextResponse.json({ error: 'List not found on Trakt' }, { status: 404 });
          return finalizeApiResponse(response, { ctx, timing, metricName: 'trakt_list_delete' });
        }
      } else {
        throw error;
      }
    }

    const response = NextResponse.json({ success: true });
    return finalizeApiResponse(response, { ctx, timing, metricName: 'trakt_list_delete' });
  } catch (error) {
    ctx.log.error('Failed to delete list', error);
    const response = NextResponse.json({ error: 'Failed to delete list' }, { status: 500 });
    return finalizeApiResponse(response, { ctx, timing, metricName: 'trakt_list_delete' });
  }
}
