import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { getSetting } from '@/lib/settings';
import type { CatalogItem } from '@/lib/catalog';

const BASE_IMAGES_DIR = path.join(process.cwd(), 'data', 'images');
const INDEX_FILENAME = '_index.json';
const ERROR_LOG_PATH = path.join(BASE_IMAGES_DIR, '_errors.json');

function getImagesDir(profileId: string): string {
  const profileDir = path.join(BASE_IMAGES_DIR, profileId);
  if (fs.existsSync(profileDir)) {
    return profileDir;
  }
  return BASE_IMAGES_DIR;
}

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

async function readIndex(imagesDir: string): Promise<Map<string, { size: number; file: string }>> {
  const indexPath = path.join(imagesDir, INDEX_FILENAME);
  if (fs.existsSync(indexPath)) {
    try {
      const raw = await fs.promises.readFile(indexPath, 'utf-8');
      const data = JSON.parse(raw) as Record<string, { size: number; file: string }>;
      return new Map(Object.entries(data));
    } catch {
      // fall through to rebuild
    }
  }

  const indexMap = new Map<string, { size: number; file: string }>();
  if (!fs.existsSync(imagesDir)) {
    return indexMap;
  }

  const files = await fs.promises.readdir(imagesDir);
  for (const file of files) {
    if (file === INDEX_FILENAME) continue;
    const filePath = path.join(imagesDir, file);
    let stat: fs.Stats;
    try {
      stat = await fs.promises.stat(filePath);
    } catch {
      continue;
    }
    if (!stat.isFile()) continue;
    const hash = path.parse(file).name;
    indexMap.set(hash, { size: stat.size, file });
  }

  try {
    const obj = Object.fromEntries(indexMap.entries());
    await fs.promises.writeFile(indexPath, JSON.stringify(obj, null, 2), 'utf-8');
  } catch {
    // ignore index write errors
  }

  return indexMap;
}

async function writeIndex(imagesDir: string, indexMap: Map<string, { size: number; file: string }>) {
  const indexPath = path.join(imagesDir, INDEX_FILENAME);
  try {
    const obj = Object.fromEntries(indexMap.entries());
    await fs.promises.writeFile(indexPath, JSON.stringify(obj, null, 2), 'utf-8');
  } catch {
    // ignore index write errors
  }
}

async function readLastError() {
  if (!fs.existsSync(ERROR_LOG_PATH)) {
    return { errorCount: 0, lastError: null as null | { url: string; reason: string; at: string } };
  }
  try {
    const raw = await fs.promises.readFile(ERROR_LOG_PATH, 'utf-8');
    const data = JSON.parse(raw) as Array<{ url: string; reason: string; at: string }>;
    return { errorCount: data.length || 0, lastError: data[0] || null };
  } catch {
    return { errorCount: 0, lastError: null as null | { url: string; reason: string; at: string } };
  }
}

async function getCacheStats(profileId: string) {
  const usedHashes = await getUsedPosterHashes(profileId);

  const imagesDir = getImagesDir(profileId);
  const indexMap = await readIndex(imagesDir);

  let totalCount = 0;
  let totalBytes = 0;
  let unusedCount = 0;
  let unusedBytes = 0;
  let missingCount = 0;

  for (const [hash, entry] of indexMap.entries()) {
    totalCount++;
    totalBytes += entry.size;
    if (!usedHashes.has(hash)) {
      unusedCount++;
      unusedBytes += entry.size;
    }
  }

  for (const hash of usedHashes) {
    if (!indexMap.has(hash)) {
      missingCount++;
    }
  }

  const usedCount = totalCount - unusedCount;
  const usedBytes = totalBytes - unusedBytes;
  const { errorCount, lastError } = await readLastError();

  return { totalCount, totalBytes, unusedCount, unusedBytes, usedCount, usedBytes, missingCount, errorCount, lastError };
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
  const imagesDir = getImagesDir(profileId);
  const indexMap = await readIndex(imagesDir);

  let removedCount = 0;
  let removedBytes = 0;

  for (const [hash, entry] of indexMap.entries()) {
    if (!usedHashes.has(hash)) {
      const filePath = path.join(imagesDir, entry.file);
      try {
        await fs.promises.unlink(filePath);
        removedCount++;
        removedBytes += entry.size;
        indexMap.delete(hash);
      } catch {
        // ignore delete errors
      }
    }
  }

  await writeIndex(imagesDir, indexMap);

  const stats = await getCacheStats(profileId);

  return NextResponse.json({
    removedCount,
    removedBytes,
    ...stats
  });
}
