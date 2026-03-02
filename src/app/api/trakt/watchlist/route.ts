
import { NextResponse } from 'next/server';
import { getAuthorizedTraktClient } from '@/lib/route-auth';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { parseAndValidateJson } from '@/lib/request-validation';

const bodySchema = z.object({
  profileId: z.string().min(1),
  item: z.object({ ids: z.record(z.unknown()) }).passthrough(),
  type: z.enum(['show', 'movie']),
  action: z.enum(['add', 'remove']),
});

export async function POST(request: Request) {
  try {
    const parsed = await parseAndValidateJson(request, bodySchema);
    if (!parsed.success) return parsed.errorResponse;
    const { profileId, item, type, action } = parsed.data;

    const authResult = await getAuthorizedTraktClient(profileId, {
      requireClientCredentials: true,
      notConnectedMessage: 'Missing Trakt credentials',
      missingCredentialsMessage: 'Missing Trakt credentials',
      includeProfileId: true,
    });
    if ('errorResponse' in authResult) {
      return authResult.errorResponse;
    }

    const trakt = authResult.client;

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
    logger.error('Watchlist API error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
