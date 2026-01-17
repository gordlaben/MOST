import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getTraktCredentials } from '@/lib/settings';
import { TraktClient } from '@/lib/trakt';
import { createRequestContext } from '@/lib/request-logging';
import { createServerTiming } from '@/lib/server-timing';
import { aiSearch, aiSuggestListName } from '@/lib/ai-search';

function clampSize(size: number) {
  const allowed = [10, 20, 50, 100];
  if (allowed.includes(size)) return size;
  return 20;
}

export async function POST(request: NextRequest) {
  const ctx = createRequestContext(request, 'api/trakt/lists/ai');
  const timing = createServerTiming();

  try {
    const body = await request.json();
    const bodySchema = z.object({
      profileId: z.string().min(1),
      prompt: z.string().min(3),
      type: z.enum(['movie', 'show']),
      size: z.number().int().min(1).max(100).optional(),
      privacy: z.enum(['private', 'friends', 'public']).optional()
    });

    const parsedBody = bodySchema.safeParse(body);
    if (!parsedBody.success) {
      const response = NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
      timing.appendTo(response, 'trakt_ai_list');
      ctx.end(response.status);
      return response;
    }

    const { profileId, prompt, type, size, privacy } = parsedBody.data;

    const { clientId, clientSecret, accessToken } = await getTraktCredentials(profileId);
    if (!accessToken) {
      const response = NextResponse.json({ error: 'Not connected to Trakt' }, { status: 401 });
      timing.appendTo(response, 'trakt_ai_list');
      ctx.end(response.status);
      return response;
    }

    const trakt = new TraktClient(clientId || '', clientSecret || '', '', accessToken);

    const listSize = clampSize(size || 20);
    const nameResult = await aiSuggestListName(prompt, profileId, type, listSize);
    if (!nameResult.usedAI || !nameResult.name) {
      const response = NextResponse.json({ error: 'AI is not configured for list creation' }, { status: 400 });
      timing.appendTo(response, 'trakt_ai_list');
      ctx.end(response.status);
      return response;
    }

    const ai = await aiSearch(prompt, trakt, profileId, type, listSize);
    if (!ai.usedAI) {
      const response = NextResponse.json({ error: 'AI is not configured for list creation' }, { status: 400 });
      timing.appendTo(response, 'trakt_ai_list');
      ctx.end(response.status);
      return response;
    }

    const items = (ai.results || [])
      .map((result) => {
        const content = type === 'movie' ? (result as { movie?: { ids?: { slug?: string } } }).movie : (result as { show?: { ids?: { slug?: string } } }).show;
        const slug = content?.ids?.slug;
        return slug ? { ids: { slug } } : null;
      })
      .filter(Boolean) as Array<{ ids: { slug: string } }>;

    if (items.length === 0) {
      const response = NextResponse.json({ error: 'AI returned no valid items' }, { status: 400 });
      timing.appendTo(response, 'trakt_ai_list');
      ctx.end(response.status);
      return response;
    }

    const description = `AI Made · ${prompt}`;
    const list = await trakt.createList(nameResult.name, description, privacy || 'private');

    if (type === 'movie') {
      await trakt.addItemsToList(list.ids.slug, { movies: items });
    } else {
      await trakt.addItemsToList(list.ids.slug, { shows: items });
    }

    const response = NextResponse.json({
      list,
      itemCount: items.length
    });
    timing.appendTo(response, 'trakt_ai_list');
    ctx.end(response.status);
    return response;
  } catch (error) {
    ctx.log.error('Failed to create AI list', error);
    const response = NextResponse.json({ error: 'Failed to create AI list' }, { status: 500 });
    timing.appendTo(response, 'trakt_ai_list');
    ctx.end(response.status);
    return response;
  }
}
