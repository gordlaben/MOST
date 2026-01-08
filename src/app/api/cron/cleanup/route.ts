import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const IMAGES_DIR = path.join(process.cwd(), 'data', 'images');

export async function GET() {
  try {
    logger.info('Starting cleanup job');

    // 1. Clean old cache entries (older than 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const deletedCache = await prisma.calendarCache.deleteMany({
      where: {
        updatedAt: {
          lt: sevenDaysAgo
        }
      }
    });
    logger.info(`Deleted ${deletedCache.count} old cache entries`);

    // 2. Clean unused images
    if (fs.existsSync(IMAGES_DIR)) {
      // Get all active cache entries
      const allCache = await prisma.calendarCache.findMany();
      const activeFilenames = new Set<string>();

      for (const entry of allCache) {
        try {
          const items = JSON.parse(entry.data);
          if (Array.isArray(items)) {
            for (const item of items) {
              const content = item.show || item.movie || item;
              let posterUrl = null;
              
              if (content?.images?.poster) {
                 if (Array.isArray(content.images.poster) && content.images.poster.length > 0) {
                    posterUrl = content.images.poster[0];
                 } else if (typeof content.images.poster === 'object' && content.images.poster.thumb) {
                    posterUrl = content.images.poster.thumb;
                 } else if (typeof content.images.poster === 'string') {
                    posterUrl = content.images.poster;
                 }
              }

              if (posterUrl) {
                const hash = crypto.createHash('md5').update(posterUrl).digest('hex');
                const urlObj = new URL(posterUrl);
                const ext = path.extname(urlObj.pathname) || '.jpg';
                activeFilenames.add(`${hash}${ext}`);
              }
            }
          }
        } catch {
          // Ignore parse errors
        }
      }

      // Scan directory
      const files = await fs.promises.readdir(IMAGES_DIR);
      let deletedImages = 0;

      for (const file of files) {
        if (!activeFilenames.has(file)) {
          await fs.promises.unlink(path.join(IMAGES_DIR, file));
          deletedImages++;
        }
      }
      logger.info(`Deleted ${deletedImages} unused images`);
    }

    return NextResponse.json({ success: true, message: 'Cleanup completed' });
  } catch (error) {
    logger.error('Cleanup job failed', error);
    return NextResponse.json({ error: 'Cleanup failed' }, { status: 500 });
  }
}
