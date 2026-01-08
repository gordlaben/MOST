import { NextResponse } from 'next/server';
import { getTraktCredentials } from '@/lib/settings';
import { TraktClient } from '@/lib/trakt';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const profileId = searchParams.get('profileId') || undefined;
  const cacheKey = `user-stats-${profileId || 'default'}`;

  // Check cache first (1 hour TTL)
  const cached = await prisma.calendarCache.findUnique({
    where: { id: cacheKey },
  });

  if (cached) {
    const cacheAge = Date.now() - cached.updatedAt.getTime();
    if (cacheAge < 60 * 60 * 1000) { // 1 hour
      try {
        return NextResponse.json(JSON.parse(cached.data));
      } catch {
        // Ignore cache error
      }
    }
  }

  const { clientId, clientSecret, accessToken } = await getTraktCredentials(profileId);

  if (!accessToken) {
    return NextResponse.json({ error: 'Not connected' }, { status: 401 });
  }

  const trakt = new TraktClient(
    clientId || '',
    clientSecret || '',
    process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
    accessToken
  );

  try {
    const [profile, stats, lastWatchedItem] = await Promise.all([
      trakt.getUserProfile(),
      trakt.getUserStats() as Promise<{ shows: { watched: number } }>,
      trakt.getLastWatchedShow()
    ]);

    const totalShows = stats.shows.watched;
    const lastWatched = lastWatchedItem ? lastWatchedItem.show.title : 'None';

    const result = {
      username: profile.username,
      avatar: profile.images?.avatar?.full 
        ? `/api/image?url=${encodeURIComponent(profile.images.avatar.full)}` 
        : undefined,
      totalShows,
      lastWatched
    };

    // Cache the results
    await prisma.calendarCache.upsert({
      where: { id: cacheKey },
      update: { data: JSON.stringify(result) },
      create: { id: cacheKey, data: JSON.stringify(result) },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
