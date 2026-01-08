import { NextRequest, NextResponse } from 'next/server';
import { getTraktCredentials } from '@/lib/settings';
import { TraktClient } from '@/lib/trakt';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const profileId = searchParams.get('profileId');

  if (!profileId) {
    return NextResponse.json({ error: 'Profile ID required' }, { status: 400 });
  }

  try {
    const { clientId, clientSecret, accessToken } = await getTraktCredentials(profileId);

    if (!accessToken) {
      return NextResponse.json({ error: 'Not connected to Trakt' }, { status: 401 });
    }

    const trakt = new TraktClient(
      clientId || '',
      clientSecret || '',
      '',
      accessToken
    );

    const lists = await trakt.getUserLists();
    return NextResponse.json(lists);
  } catch (error) {
    logger.error('Failed to fetch user lists', error);
    return NextResponse.json({ error: 'Failed to fetch lists' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { profileId, name, description, privacy } = body;

    if (!profileId || !name) {
      return NextResponse.json({ error: 'Profile ID and Name required' }, { status: 400 });
    }

    const { clientId, clientSecret, accessToken } = await getTraktCredentials(profileId);
    if (!accessToken) {
        return NextResponse.json({ error: 'Not connected to Trakt' }, { status: 401 });
    }

    const trakt = new TraktClient(clientId || '', clientSecret || '', '', accessToken);
    const list = await trakt.createList(name, description || '', privacy || 'private');
    
    return NextResponse.json(list);
  } catch (error) {
    logger.error('Failed to create list', error);
    return NextResponse.json({ error: 'Failed to create list' }, { status: 500 });
  }
}
