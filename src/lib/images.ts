import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import { logger } from './logger';

const IMAGES_DIR = path.join(process.cwd(), 'data', 'images');
const pendingDownloads = new Map<string, Promise<string | null>>();
const URL_CACHE_LIMIT = 2000;
const META_CACHE_LIMIT = 2000;
const MAX_CONCURRENT_DOWNLOADS = 8;
let activeDownloads = 0;
const downloadQueue: Array<() => void> = [];
const urlToPathCache = new Map<string, string>();
const pathMetaCache = new Map<string, CachedImageMeta>();

interface CachedImageMeta {
  filePath: string;
  contentType: string;
  etag: string;
  lastModified: string;
  size: number;
  mtimeMs: number;
}

// Ensure directory exists
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
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

function touchMap<T>(map: Map<string, T>, key: string, value: T, limit: number) {
  if (map.has(key)) {
    map.delete(key);
  }
  map.set(key, value);
  if (map.size > limit) {
    const firstKey = map.keys().next().value;
    if (firstKey) {
      map.delete(firstKey);
    }
  }
}

function getContentTypeFromPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

async function withDownloadSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (activeDownloads >= MAX_CONCURRENT_DOWNLOADS) {
    await new Promise<void>((resolve) => downloadQueue.push(resolve));
  }
  activeDownloads++;
  try {
    return await fn();
  } finally {
    activeDownloads--;
    const next = downloadQueue.shift();
    if (next) next();
  }
}

async function getCachedMetaByPath(filePath: string): Promise<CachedImageMeta | null> {
  const cached = pathMetaCache.get(filePath);
  if (cached) {
    touchMap(pathMetaCache, filePath, cached, META_CACHE_LIMIT);
    return cached;
  }

  try {
    const stat = await fs.promises.stat(filePath);
    const meta: CachedImageMeta = {
      filePath,
      contentType: getContentTypeFromPath(filePath),
      etag: `W/\"${stat.size}-${stat.mtimeMs}\"`,
      lastModified: stat.mtime.toUTCString(),
      size: stat.size,
      mtimeMs: stat.mtimeMs
    };
    touchMap(pathMetaCache, filePath, meta, META_CACHE_LIMIT);
    return meta;
  } catch {
    return null;
  }
}

export async function cacheImage(url: string): Promise<string | null> {
  if (!url) return null;

  url = normalizeUrl(url);

  const existingPromise = pendingDownloads.get(url);
  if (existingPromise) {
    return existingPromise;
  }

  const promise = (async () => {
    try {
      // Create a hash of the URL to use as filename
      const hash = crypto.createHash('md5').update(url).digest('hex');

      // Check if file exists with any common extension
      for (const ext of ['.jpg', '.png', '.webp', '.jpeg']) {
        const existingFilename = `${hash}${ext}`;
        const existingPath = path.join(IMAGES_DIR, existingFilename);
        try {
          await fs.promises.access(existingPath);
          touchMap(urlToPathCache, url, existingPath, URL_CACHE_LIMIT);
          return existingFilename;
        } catch {
          // Continue checking
        }
      }

      // File does not exist, proceed to download
      const filename = `${hash}.jpg`;
      const filePath = path.join(IMAGES_DIR, filename);

      let written = false;
      await withDownloadSlot(async () => {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
          }
        });
        if (!response.ok) {
          logger.warn(`Failed to fetch image: ${url} (${response.status})`);
          return;
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        try {
          const optimized = await sharp(buffer)
            .resize({ width: 600, height: 900, fit: 'cover', withoutEnlargement: true })
            .jpeg({ quality: 82 })
            .toBuffer();
          await fs.promises.writeFile(filePath, optimized);
          written = true;
        } catch (e) {
          logger.warn(`Sharp optimization failed for ${url}, saving original`, e);
          await fs.promises.writeFile(filePath, buffer);
          written = true;
        }
      });

      if (!written) {
        return null;
      }

      touchMap(urlToPathCache, url, filePath, URL_CACHE_LIMIT);
      void getCachedMetaByPath(filePath); // warm meta cache
      return filename;
    } catch (error) {
      logger.error(`Error caching image ${url}:`, error);
      return null;
    } finally {
      pendingDownloads.delete(url);
    }
  })();

  pendingDownloads.set(url, promise);
  return promise;
}

export function getCachedImagePath(filename: string): string | null {
  const filePath = path.join(IMAGES_DIR, filename);
  if (fs.existsSync(filePath)) {
    return filePath;
  }
  return null;
}

export async function getImagePathIfCached(url: string): Promise<string | null> {
  if (!url) return null;

  url = normalizeUrl(url);

  const cachedPath = urlToPathCache.get(url);
  if (cachedPath) {
    touchMap(urlToPathCache, url, cachedPath, URL_CACHE_LIMIT);
    return cachedPath;
  }

  const hash = crypto.createHash('md5').update(url).digest('hex');

  for (const ext of ['.jpg', '.png', '.webp', '.jpeg']) {
    const filename = `${hash}${ext}`;
    const filePath = path.join(IMAGES_DIR, filename);
    try {
      await fs.promises.access(filePath);
      touchMap(urlToPathCache, url, filePath, URL_CACHE_LIMIT);
      return filePath;
    } catch {
      continue;
    }
  }
  return null;
}

export async function getImageMetaIfCached(url: string): Promise<CachedImageMeta | null> {
  const filePath = await getImagePathIfCached(url);
  if (!filePath) return null;
  return getCachedMetaByPath(filePath);
}
