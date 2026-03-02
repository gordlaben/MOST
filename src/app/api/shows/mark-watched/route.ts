import { removeShowSlugFromSystemCaches } from '@/lib/show-cache';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizedTraktClient } from '@/lib/route-auth';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { parseAndValidateJson } from '@/lib/request-validation';

const bodySchema = z.object({
  showId: z.string().min(1),
  seasonNumber: z.number().int().optional(),
  profileId: z.string().min(1),
  type: z.enum(['show', 'movie']).optional(),
});

export async function POST(request: NextRequest) {
  const parsed = await parseAndValidateJson(request, bodySchema);
  if (!parsed.success) return parsed.errorResponse;
  const { showId, seasonNumber, profileId, type } = parsed.data;

  const authResult = await getAuthorizedTraktClient(profileId, {
    notConnectedMessage: 'Not connected to Trakt'
  });
  if ('errorResponse' in authResult) {
    return authResult.errorResponse;
  }

  try {
    const trakt = authResult.client;

    let result;
    if (type === 'movie') {
      result = await trakt.markMovieWatched(showId);
    } else {
      if (seasonNumber === undefined) {
        return NextResponse.json({ error: 'Missing season number' }, { status: 400 });
      }
      result = await trakt.markSeasonWatched(showId, seasonNumber);
    }

    await removeShowSlugFromSystemCaches(showId);

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Error marking watched:', error);
    return NextResponse.json({ error: 'Failed to mark as watched' }, { status: 500 });
  }
}
