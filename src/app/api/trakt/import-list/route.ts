import { NextResponse } from 'next/server';
import { TraktClient } from '@/lib/trakt';
import { getTraktCredentials } from '@/lib/settings';
import { prefetchImages } from '@/lib/images';
import { logger } from '@/lib/logger';
import { createRequestContext } from '@/lib/request-logging';
import { z } from 'zod';
import { createServerTiming } from '@/lib/server-timing';

export async function POST(request: Request) {
  const ctx = createRequestContext(request, 'api/trakt/import-list');
  const timing = createServerTiming();
  try {
    const body = await request.json();
    const bodySchema = z.object({
      profileId: z.string().min(1),
      url: z.string().url()
    });

    const parsedBody = bodySchema.safeParse(body);
    if (!parsedBody.success) {
      const response = NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
      timing.appendTo(response, 'trakt_import_list');
      ctx.end(response.status);
      return response;
    }

    const { profileId, url } = parsedBody.data;

    if (!profileId || !url) {
      const response = NextResponse.json({ error: 'Missing profileId or url' }, { status: 400 });
      timing.appendTo(response, 'trakt_import_list');
      ctx.end(response.status);
      return response;
    }

    // Parse URL
    // Expected format: https://trakt.tv/users/<username>/lists/<list_id>
    const regex = /trakt\.tv\/users\/([^\/]+)\/lists\/([^\/]+)/;
    const match = url.match(regex);

    if (!match) {
      const response = NextResponse.json({ error: 'Invalid Trakt list URL' }, { status: 400 });
      timing.appendTo(response, 'trakt_import_list');
      ctx.end(response.status);
      return response;
    }

    const username = match[1];
    // Remove any query parameters or trailing slashes from listId
    const listId = match[2].split('?')[0].replace(/\/$/, '');

    const { clientId, clientSecret, accessToken } = await getTraktCredentials(profileId);

    if (!clientId || !clientSecret || !accessToken) {
      const response = NextResponse.json({ error: 'Missing Trakt credentials' }, { status: 401 });
      timing.appendTo(response, 'trakt_import_list');
      ctx.end(response.status);
      return response;
    }

    const trakt = new TraktClient(clientId, clientSecret, '', accessToken);
    const listDetails = await trakt.getListDetails(username, listId) as { name: string; item_count: number };
    
    // Fetch items to determine content type and cache images
    const items = await trakt.getListItems(listId, username);

    if (!Array.isArray(items)) {
      ctx.log.error(`getListItems returned non-array for ${listId}`, items);
      const response = NextResponse.json({ error: 'Failed to retrieve list items from Trakt. The list might be empty or inaccessible.' }, { status: 500 });
      timing.appendTo(response, 'trakt_import_list');
      ctx.end(response.status);
      return response;
    }

    let hasMovies = false;
    let hasShows = false;

    for (const item of items) {
        if (item.movie) hasMovies = true;
        if (item.show) hasShows = true;
        if (hasMovies && hasShows) break;
    }

    let contentType = 'mixed';
    if (hasMovies && !hasShows) contentType = 'movie';
    if (!hasMovies && hasShows) contentType = 'series';

    // Trigger background image caching
    (async () => {
      try {
        logger.info(`Starting background image caching for list ${listId}`);
        const posterUrls: string[] = [];
        for (const item of items) {
          const content = item.show || item.movie;
          if (content?.images?.poster) {
             let posterUrl = '';
             if (Array.isArray(content.images.poster) && content.images.poster.length > 0) {
                posterUrl = content.images.poster[0];
             } else if (typeof content.images.poster === 'object' && content.images.poster.thumb) {
                posterUrl = content.images.poster.thumb;
             } else if (typeof content.images.poster === 'string') {
                posterUrl = content.images.poster;
             }

             if (posterUrl) {
               posterUrls.push(posterUrl);
             }
          }
        }
        await prefetchImages(posterUrls, profileId, 20);
        logger.info(`Queued ${posterUrls.length} images for list ${listId}`);
      } catch (e) {
        logger.error(`Failed to cache images for list ${listId}`, e);
      }
    })();

    const response = NextResponse.json({
      ...listDetails,
      username, // Return username so we can store it
      content_type: contentType
    });
    timing.appendTo(response, 'trakt_import_list');
    ctx.end(response.status);
    return response;

  } catch (error) {
    console.error('Error importing list:', error);
    const response = NextResponse.json({ error: 'Failed to import list' }, { status: 500 });
    timing.appendTo(response, 'trakt_import_list');
    ctx.end(response.status);
    return response;
  }
}
