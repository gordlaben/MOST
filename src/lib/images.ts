import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import { logger } from './logger';

const BASE_IMAGES_DIR = path.join(process.cwd(), 'data', 'images');
const ERROR_LOG_PATH = path.join(BASE_IMAGES_DIR, '_errors.json');
const pendingDownloads = new Map<string, Promise<string | null>>();
const URL_CACHE_LIMIT = 2000;
const META_CACHE_LIMIT = 2000;
const MAX_CONCURRENT_DOWNLOADS = 8;
let activeDownloads = 0;
const downloadQueue: Array<() => void> = [];
const urlToPathCache = new Map<string, string>();
const pathMetaCache = new Map<string, CachedImageMeta>();
let errorLogWrite = Promise.resolve();
let indexWrite = Promise.resolve();

interface CachedImageMeta {
  filePath: string;
  contentType: string;
  etag: string;
  lastModified: string;
  size: number;
  mtimeMs: number;
}

// Ensure base directory exists
if (!fs.existsSync(BASE_IMAGES_DIR)) {
  fs.mkdirSync(BASE_IMAGES_DIR, { recursive: true });
}

function getImagesDir(profileId?: string): string {
  if (!profileId) return BASE_IMAGES_DIR;
  const dir = path.join(BASE_IMAGES_DIR, profileId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getCacheKey(url: string, profileId?: string) {
  return `${profileId || 'global'}|${url}`;
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

async function recordCacheError(url: string, reason: string) {
  const entry = { url, reason, at: new Date().toISOString() };
  errorLogWrite = errorLogWrite.then(async () => {
    try {
      let existing: Array<{ url: string; reason: string; at: string }> = [];
      if (fs.existsSync(ERROR_LOG_PATH)) {
        const raw = await fs.promises.readFile(ERROR_LOG_PATH, 'utf-8');
        existing = JSON.parse(raw) || [];
      }
      existing.unshift(entry);
      if (existing.length > 25) {
        existing = existing.slice(0, 25);
      }
      await fs.promises.writeFile(ERROR_LOG_PATH, JSON.stringify(existing, null, 2), 'utf-8');
    } catch (e) {
      logger.warn('Failed to write cache error log', e);
    }
  });
  await errorLogWrite;
}

async function updateIndex(imagesDir: string, hash: string, size: number, file: string) {
  const indexPath = path.join(imagesDir, '_index.json');
  indexWrite = indexWrite.then(async () => {
    try {
      let existing: Record<string, { size: number; file: string }> = {};
      if (fs.existsSync(indexPath)) {
        const raw = await fs.promises.readFile(indexPath, 'utf-8');
        existing = JSON.parse(raw) || {};
      }
      existing[hash] = { size, file };
      await fs.promises.writeFile(indexPath, JSON.stringify(existing, null, 2), 'utf-8');
    } catch (e) {
      logger.warn('Failed to update cache index', e);
    }
  });
  await indexWrite;
}

export async function cacheImage(url: string, profileId?: string): Promise<string | null> {
  if (!url) return null;

  url = normalizeUrl(url);

  const cacheKey = getCacheKey(url, profileId);
  const existingPromise = pendingDownloads.get(cacheKey);
  if (existingPromise) {
    return existingPromise;
  }

  const promise = (async () => {
    try {
      const imagesDir = getImagesDir(profileId);
      // Create a hash of the URL to use as filename
      const hash = crypto.createHash('md5').update(url).digest('hex');

      // Check if file exists with any common extension
      for (const ext of ['.jpg', '.png', '.webp', '.jpeg']) {
        const existingFilename = `${hash}${ext}`;
        const existingPath = path.join(imagesDir, existingFilename);
        try {
          await fs.promises.access(existingPath);
          touchMap(urlToPathCache, cacheKey, existingPath, URL_CACHE_LIMIT);
          return existingFilename;
        } catch {
          // Continue checking
        }
      }

      // File does not exist, proceed to download
      const filename = `${hash}.jpg`;
      const filePath = path.join(imagesDir, filename);

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
          await recordCacheError(url, `HTTP ${response.status}`);
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

      touchMap(urlToPathCache, cacheKey, filePath, URL_CACHE_LIMIT);
      void getCachedMetaByPath(filePath); // warm meta cache
      const stat = await fs.promises.stat(filePath);
      void updateIndex(imagesDir, hash, stat.size, path.basename(filePath));
      return filename;
    } catch (error) {
      logger.error(`Error caching image ${url}:`, error);
      await recordCacheError(url, 'Exception during cacheImage');
      return null;
    } finally {
      pendingDownloads.delete(cacheKey);
    }
  })();

  pendingDownloads.set(cacheKey, promise);
  return promise;
}

export function getCachedImagePath(filename: string): string | null {
  const filePath = path.join(BASE_IMAGES_DIR, filename);
  if (fs.existsSync(filePath)) {
    return filePath;
  }
  return null;
}

export async function getImagePathIfCached(url: string, profileId?: string): Promise<string | null> {
  if (!url) return null;

  url = normalizeUrl(url);

  const cacheKey = getCacheKey(url, profileId);
  const cachedPath = urlToPathCache.get(cacheKey);
  if (cachedPath) {
    touchMap(urlToPathCache, cacheKey, cachedPath, URL_CACHE_LIMIT);
    return cachedPath;
  }

  const hash = crypto.createHash('md5').update(url).digest('hex');

  const dirs = profileId ? [getImagesDir(profileId), BASE_IMAGES_DIR] : [BASE_IMAGES_DIR];
  for (const dir of dirs) {
    for (const ext of ['.jpg', '.png', '.webp', '.jpeg']) {
      const filename = `${hash}${ext}`;
      const filePath = path.join(dir, filename);
      try {
        await fs.promises.access(filePath);
        touchMap(urlToPathCache, cacheKey, filePath, URL_CACHE_LIMIT);
        return filePath;
      } catch {
        continue;
      }
    }
  }
  return null;
}

export async function getImageMetaIfCached(url: string, profileId?: string): Promise<CachedImageMeta | null> {
  const filePath = await getImagePathIfCached(url, profileId);
  if (!filePath) return null;
  return getCachedMetaByPath(filePath);
}

export async function prefetchImages(urls: string[], profileId?: string, delayMs: number = 15, maxItems: number = 800) {
  if (!urls || urls.length === 0) return;
  const unique = Array.from(new Set(urls.filter(Boolean)));
  const capped = unique.slice(0, maxItems);
  for (const url of capped) {
    void cacheImage(url, profileId);
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
