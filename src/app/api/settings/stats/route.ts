
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { CatalogItem } from '@/lib/catalog';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const profileId = searchParams.get('profileId');

  if (!profileId) {
    return NextResponse.json({ error: 'Profile ID is required' }, { status: 400 });
  }

  // Get all cache entries for this profile
  // Cache keys follow the pattern: `list-${catalogId}-${profileId}-...` or `binge-ready-shows-${profileId}-...`
  // Since we can't do wildcard matching easily with findMany on IDs in SQLite without raw query or iterating,
  // we'll fetch all and filter in memory or try to construct known keys if possible.
  // Given keys contain JSON stringified filters, it's hard to predict exact keys.
  // Using `contains` is safer.

  const cacheEntries = await prisma.calendarCache.findMany({
    where: {
      id: {
        contains: profileId
      }
    }
  });

  let totalItems = 0;
  let movies = 0;
  let shows = 0;
  let oldestUpdate: Date | null = null;

  for (const entry of cacheEntries) {
    try {
      // Exclude user-stats cache
      if (entry.id.startsWith('user-stats')) continue;

      const items: CatalogItem[] = JSON.parse(entry.data);
      if (Array.isArray(items)) {
        totalItems += items.length;
        
        items.forEach(item => {
           if (('show' in item && item.show) || ('season' in item)) {
               shows++;
           } else if ('movie' in item && item.movie) {
               movies++;
           }
        });
      }

      if (!oldestUpdate || entry.updatedAt < oldestUpdate) {
        oldestUpdate = entry.updatedAt;
      }
    } catch {
      // ignore parse errors
    }
  }

  // Calculate Next Sync (assuming 24h interval)
  let nextSync: Date | null = null;
  if (oldestUpdate) {
      nextSync = new Date(oldestUpdate.getTime() + 24 * 60 * 60 * 1000);
      // If next sync is in the past, it's "Now" or "Pending"
      if (nextSync < new Date()) {
          // It's due
      }
  }

  return NextResponse.json({
    totalItems,
    movies,
    shows,
    lastSync: oldestUpdate ? oldestUpdate.toISOString() : null,
    nextSync: nextSync ? nextSync.toISOString() : null
  });
}
