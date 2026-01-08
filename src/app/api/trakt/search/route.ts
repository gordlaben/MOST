import { NextRequest, NextResponse } from 'next/server';
import { getTraktCredentials } from '@/lib/settings';
import { TraktClient } from '@/lib/trakt';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const profileId = searchParams.get('profileId');
  const query = searchParams.get('query');

  if (!profileId) {
    return NextResponse.json({ error: 'Profile ID required' }, { status: 400 });
  }

  if (!query) {
      return NextResponse.json({ results: [] });
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

    // Search both movies and shows
    const [movieResults, showResults] = await Promise.all([
        trakt.search(query, 'movie'),
        trakt.search(query, 'show')
    ]);

    // Combine and sort by score or popularity if available, but Trakt usually returns sorted results.
    // We'll just interleave or concat. Let's concat for now.
    // The previous implementation might have just searched both.
    // Actually the TraktClient.search returns any[];
    
    // Let's just return them. The client side can handle display.
    // We'll combine them. 
    const results = [...(movieResults || []), ...(showResults || [])];

    return NextResponse.json({ results });
  } catch (error) {
    logger.error('Failed to search trakt', error);
    return NextResponse.json({ error: 'Failed to search' }, { status: 500 });
  }
}
