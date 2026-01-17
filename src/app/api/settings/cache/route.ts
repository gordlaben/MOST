import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { getSetting } from '@/lib/settings';
import type { CatalogItem } from '@/lib/catalog';

const IMAGES_DIR = path.join(process.cwd(), 'data', 'images');

function normalizeUrl(url: string): string {
  if (url.startsWith('//')) {
    return `https:${url}`;
  }
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return `https://${url}`;
  }
  return url;
}

function getPosterUrlFromItem(item: CatalogItem): string | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content = (item as any).show || (item as any).movie || item;
  const poster = content?.images?.poster;

  if (!poster) return null;

  if (Array.isArray(poster) && poster.length > 0) {
    return poster[0];
  }
  if (!Array.isArray(poster) && typeof poster === 'object' && poster.thumb) {
    return poster.thumb;
  }
  if (typeof poster === 'string') {
    return poster;
  }

  return null;
}

function getRpdbUrl(ids: { imdb?: string; tmdb?: number; tvdb?: number } | undefined, rpdbKey: string): string | null {
  if (!ids) return null;
  if (ids.imdb) return `https://api.ratingposterdb.com/${rpdbKey}/imdb/poster-default/${ids.imdb}.jpg`;
  if (ids.tmdb) return `https://api.ratingposterdb.com/${rpdbKey}/tmdb/poster-default/${ids.tmdb}.jpg`;
  if (ids.tvdb) return `https://api.ratingposterdb.com/${rpdbKey}/tvdb/poster-default/${ids.tvdb}.jpg`;
  return null;
}

async function getUsedPosterHashes(profileId: string): Promise<Set<string>> {
  const used = new Set<string>();

  const profile = await prisma.profile.findUnique({ where: { id: profileId } });
  let rpdbKey = profile?.rpdbKey || '';
  if (!rpdbKey) {
    rpdbKey = (await getSetting('RPDB_API_KEY')) || 't0-free-rpdb';
  }
  const rpdbEnabled = rpdbKey && rpdbKey !== 'disabled';

  const cacheEntries = await prisma.calendarCache.findMany({
    where: {
      id: {
        contains: profileId
      }
    }
  });

  for (const entry of cacheEntries) {
    try {
      if (entry.id.startsWith('user-stats')) continue;
      const items: CatalogItem[] = JSON.parse(entry.data);
      if (!Array.isArray(items)) continue;

      for (const item of items) {
        const posterUrl = getPosterUrlFromItem(item);
        if (posterUrl) {
          const normalized = normalizeUrl(posterUrl);
          const hash = crypto.createHash('md5').update(normalized).digest('hex');
          used.add(hash);
        }

        if (rpdbEnabled) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const content = (item as any).show || (item as any).movie || item;
          const rpdbUrl = getRpdbUrl(content?.ids, rpdbKey);
          if (rpdbUrl) {
            const rpdbHash = crypto.createHash('md5').update(rpdbUrl).digest('hex');
            used.add(rpdbHash);
          }
        }
      }
    } catch {
      // ignore parse errors
    }
  }

  return used;
}

async function getCacheStats(profileId: string) {
  const usedHashes = await getUsedPosterHashes(profileId);

  let totalCount = 0;
  let totalBytes = 0;
  let unusedCount = 0;
  let unusedBytes = 0;

  if (!fs.existsSync(IMAGES_DIR)) {
    return { totalCount, totalBytes, unusedCount, unusedBytes, usedCount: 0, usedBytes: 0 };
  }

  const files = await fs.promises.readdir(IMAGES_DIR);
  for (const file of files) {
    const filePath = path.join(IMAGES_DIR, file);
    let stat: fs.Stats;
    try {
      stat = await fs.promises.stat(filePath);
    } catch {
      continue;
    }

    if (!stat.isFile()) continue;

    totalCount++;
    totalBytes += stat.size;

    const hash = path.parse(file).name;
    if (!usedHashes.has(hash)) {
      unusedCount++;
      unusedBytes += stat.size;
    }
  }

  const usedCount = totalCount - unusedCount;
  const usedBytes = totalBytes - unusedBytes;

  return { totalCount, totalBytes, unusedCount, unusedBytes, usedCount, usedBytes };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const profileId = searchParams.get('profileId');

  if (!profileId) {
    return NextResponse.json({ error: 'Profile ID is required' }, { status: 400 });
  }

  const stats = await getCacheStats(profileId);
  return NextResponse.json(stats);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { profileId, action } = body as { profileId?: string; action?: string };

  if (!profileId) {
    return NextResponse.json({ error: 'Profile ID is required' }, { status: 400 });
  }

  if (action !== 'clear-unused') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const usedHashes = await getUsedPosterHashes(profileId);

  let removedCount = 0;
  let removedBytes = 0;

  if (fs.existsSync(IMAGES_DIR)) {
    const files = await fs.promises.readdir(IMAGES_DIR);
    for (const file of files) {
      const filePath = path.join(IMAGES_DIR, file);
      let stat: fs.Stats;
      try {
        stat = await fs.promises.stat(filePath);
      } catch {
        continue;
      }

      if (!stat.isFile()) continue;

      const hash = path.parse(file).name;
      if (!usedHashes.has(hash)) {
        try {
          await fs.promises.unlink(filePath);
          removedCount++;
          removedBytes += stat.size;
        } catch {
          // ignore delete errors
        }
      }
    }
  }

  const stats = await getCacheStats(profileId);

  return NextResponse.json({
    removedCount,
    removedBytes,
    ...stats
  });
}
