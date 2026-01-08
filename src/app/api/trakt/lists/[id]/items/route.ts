import { NextRequest, NextResponse } from 'next/server';
import { getTraktCredentials } from '@/lib/settings';
import { TraktClient } from '@/lib/trakt';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { profileId, items, action } = body; // action: 'add' or 'remove'

    if (!profileId || !items || !id) {
      return NextResponse.json({ error: 'Profile ID, List ID and Items required' }, { status: 400 });
    }

    const { clientId, clientSecret, accessToken } = await getTraktCredentials(profileId);
    if (!accessToken) {
        return NextResponse.json({ error: 'Not connected to Trakt' }, { status: 401 });
    }

    const trakt = new TraktClient(clientId || '', clientSecret || '', '', accessToken);
    
    let response;
    if (action === 'remove') {
        response = await trakt.removeItemsFromList(id, items);
    } else {
        response = await trakt.addItemsToList(id, items);
    }
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return NextResponse.json((response as any).data);
  } catch (error) {
    logger.error('Failed to update list items', error);
    return NextResponse.json({ error: 'Failed to update list items' }, { status: 500 });
  }
}
