
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { CatalogItem } from '@/lib/catalog';

type ContentIds = { trakt?: number; imdb?: string; tmdb?: number };
type ContentWithIds = { ids?: ContentIds; type?: 'movie' | 'show' };

function getContentFromItem(item: CatalogItem): { content: ContentWithIds | null; kind: 'movie' | 'show' | null } {
  if ('show' in item && item.show) {
    const showContent = item.show as ContentWithIds;
    if (showContent.type === 'movie') {
      return { content: showContent, kind: 'movie' };
    }
    return { content: showContent, kind: 'show' };
  }

  if ('movie' in item && item.movie) {
    const movieContent = item.movie as ContentWithIds;
    return { content: movieContent, kind: 'movie' };
  }

  return { content: null, kind: null };
}

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

  const showIds = new Set<string>();
  const movieIds = new Set<string>();
  let oldestUpdate: Date | null = null;

  for (const entry of cacheEntries) {
    try {
      // Exclude user-stats cache
      if (entry.id.startsWith('user-stats')) continue;

      const items: CatalogItem[] = JSON.parse(entry.data);
      if (Array.isArray(items)) {
        items.forEach(item => {
          const { content, kind } = getContentFromItem(item);
          const ids = content?.ids;

          if (kind === 'movie') {
            const movieKey = ids?.trakt ? `trakt:${ids.trakt}` : (ids?.imdb ? `imdb:${ids.imdb}` : (ids?.tmdb ? `tmdb:${ids.tmdb}` : null));
            if (movieKey) movieIds.add(movieKey);
          } else if (kind === 'show') {
            const showKey = ids?.trakt ? `trakt:${ids.trakt}` : (ids?.imdb ? `imdb:${ids.imdb}` : (ids?.tmdb ? `tmdb:${ids.tmdb}` : null));
            if (showKey) showIds.add(showKey);
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
    totalItems: showIds.size + movieIds.size,
    movies: movieIds.size,
    shows: showIds.size,
    lastSync: oldestUpdate ? oldestUpdate.toISOString() : null,
    nextSync: nextSync ? nextSync.toISOString() : null
  });
}
