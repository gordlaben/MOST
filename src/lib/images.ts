import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { logger } from './logger';

const IMAGES_DIR = path.join(process.cwd(), 'data', 'images');
const pendingDownloads = new Set<string>();

// Ensure directory exists
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

export async function cacheImage(url: string): Promise<string | null> {
  if (!url) return null;

  // Check if we already have a pending download for this URL
  if (pendingDownloads.has(url)) {
      return null; // Let the existing download finish
  }

  try {
    pendingDownloads.add(url);

    // Create a hash of the URL to use as filename
    const hash = crypto.createHash('md5').update(url).digest('hex');
    
    // Check if file exists with any common extension
    for (const ext of ['.jpg', '.png', '.webp', '.jpeg']) {
      const existingFilename = `${hash}${ext}`;
      const existingPath = path.join(IMAGES_DIR, existingFilename);
      try {
        await fs.promises.access(existingPath);
        return existingFilename;
      } catch {
        // Continue checking
      }
    }

    // File does not exist, proceed to download
    const response = await fetch(url);
    if (!response.ok) {
      logger.warn(`Failed to fetch image: ${url} (${response.status})`);
      return null;
    }

    // Determine extension from content-type
    let finalExt = '.jpg'; // Default
    const contentType = response.headers.get('content-type');
    if (contentType) {
        if (contentType.includes('image/png')) finalExt = '.png';
        else if (contentType.includes('image/jpeg')) finalExt = '.jpg';
        else if (contentType.includes('image/webp')) finalExt = '.webp';
    } else {
        // Fallback to URL extension
        const urlObj = new URL(url);
        const urlExt = path.extname(urlObj.pathname);
        if (urlExt) finalExt = urlExt;
    }

    const filename = `${hash}${finalExt}`;
    const filePath = path.join(IMAGES_DIR, filename);

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Save to disk asynchronously
    await fs.promises.writeFile(filePath, buffer);
    
    return filename;
  } catch (error) {
    logger.error(`Error caching image ${url}:`, error);
    return null;
  } finally {
    pendingDownloads.delete(url);
  }
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
    const hash = crypto.createHash('md5').update(url).digest('hex');
    
    for (const ext of ['.jpg', '.png', '.webp', '.jpeg']) {
      const filename = `${hash}${ext}`;
      const filePath = path.join(IMAGES_DIR, filename);
      try {
        await fs.promises.access(filePath);
        return filePath;
      } catch {
        continue;
      }
    }
    return null;
}
