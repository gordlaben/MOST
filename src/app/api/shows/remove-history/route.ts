import { removeShowSlugFromSystemCaches } from '@/lib/show-cache';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizedTraktClient } from '@/lib/route-auth';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { showId, profileId, type } = body;

  const authResult = await getAuthorizedTraktClient(profileId, {
    notConnectedMessage: 'Not connected to Trakt'
  });
  if ('errorResponse' in authResult) {
    return authResult.errorResponse;
  }

  try {
    if (!showId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const trakt = authResult.client;

    const result = await trakt.removeFromHistory(showId, type);

    await removeShowSlugFromSystemCaches(showId);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error removing from history:', error);
    return NextResponse.json({ error: 'Failed to remove from history' }, { status: 500 });
  }
}
