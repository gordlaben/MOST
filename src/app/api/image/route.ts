import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { cacheImage, getImagePathIfCached } from '@/lib/images';

// Helper to convert Node stream to Web stream
function nodeStreamToWeb(nodeStream: fs.ReadStream): ReadableStream {
  return new ReadableStream({
    start(controller) {
      nodeStream.on('data', (chunk) => controller.enqueue(chunk));
      nodeStream.on('end', () => controller.close());
      nodeStream.on('error', (err) => controller.error(err));
    },
    cancel() {
      nodeStream.destroy();
    },
  });
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get('url');
  const fallback = searchParams.get('fallback');

  if (!url) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  try {
    // 1. Check if we have it locally
    const existingPath = await getImagePathIfCached(url);

    if (existingPath) {
        // Serve local file using stream to save memory
        const stream = fs.createReadStream(existingPath);
        const webStream = nodeStreamToWeb(stream);
        
        const ext = path.extname(existingPath);
        const contentType = ext === '.png' ? 'image/png' : 'image/jpeg'; // naive but works
        
        return new NextResponse(webStream as unknown as BodyInit, {
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000, immutable',
            'Access-Control-Allow-Origin': '*',
          },
        });
    }

    // 2. Not cached? Trigger background download and Redirect immediately
    // Don't await this! Fire and forget.
    void cacheImage(url);

    // Redirect to the fallback (if available) or original URL so the user sees the image NOW
    // Using fallback prevents hitting API limits on the provider (e.g. RPDB) from the client
    // while the server downloads it in the background.
    return NextResponse.redirect(fallback || url, 307); 

  } catch (error) {
    console.error('Error proxying image:', error);
    // Fallback to strict redirect if anything blows up
    return NextResponse.redirect(fallback || url, 307);
  }
}
