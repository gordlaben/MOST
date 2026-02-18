import { NextRequest, NextResponse } from 'next/server';
import { getTraktCredentials } from '@/lib/settings';
import { TraktClient } from '@/lib/trakt';
import { createRequestContext } from '@/lib/request-logging';
import { z } from 'zod';
import { createServerTiming } from '@/lib/server-timing';
import { parseAndValidateJson } from '@/lib/request-validation';
import { finalizeApiResponse } from '@/lib/route-response';

const bodySchema = z.object({
  profileId: z.string().min(1),
  items: z.object({
    movies: z.array(z.object({ ids: z.object({ slug: z.string().min(1) }) })).optional(),
    shows: z.array(z.object({ ids: z.object({ slug: z.string().min(1) }) })).optional()
  }),
  action: z.enum(['add', 'remove']).optional()
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = createRequestContext(request, 'api/trakt/lists/[id]/items');
  const timing = createServerTiming();
  try {
    const { id } = await params;
    const parsedBody = await parseAndValidateJson(request, bodySchema);
    if (!parsedBody.success) {
      return finalizeApiResponse(parsedBody.errorResponse, { ctx, timing, metricName: 'trakt_list_items_update' });
    }

    const { profileId, items, action } = parsedBody.data; // action: 'add' or 'remove'

    if (!profileId || !items || !id) {
      const response = NextResponse.json({ error: 'Profile ID, List ID and Items required' }, { status: 400 });
      return finalizeApiResponse(response, { ctx, timing, metricName: 'trakt_list_items_update' });
    }

    const { clientId, clientSecret, accessToken } = await getTraktCredentials(profileId);
    if (!accessToken) {
      const response = NextResponse.json({ error: 'Not connected to Trakt' }, { status: 401 });
      return finalizeApiResponse(response, { ctx, timing, metricName: 'trakt_list_items_update' });
    }

    const trakt = new TraktClient(clientId || '', clientSecret || '', '', accessToken);
    
    let response;
    if (action === 'remove') {
        response = await trakt.removeItemsFromList(id, items);
    } else {
        response = await trakt.addItemsToList(id, items);
    }
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = NextResponse.json((response as any).data);
    return finalizeApiResponse(result, { ctx, timing, metricName: 'trakt_list_items_update' });
  } catch (error) {
    ctx.log.error('Failed to update list items', error);
    const response = NextResponse.json({ error: 'Failed to update list items' }, { status: 500 });
    return finalizeApiResponse(response, { ctx, timing, metricName: 'trakt_list_items_update' });
  }
}
