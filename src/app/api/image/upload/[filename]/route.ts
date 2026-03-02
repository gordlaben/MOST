
import { NextRequest, NextResponse } from 'next/server';
import { readFile, unlink } from 'fs/promises';
import { resolve, relative } from 'path';
import { existsSync } from 'fs';
import { logger } from '@/lib/logger';

function getSafePath(filename: string): { filePath: string; uploadsDir: string } | null {
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '');
  const uploadsDir = resolve(process.cwd(), 'data/uploads');
  const filePath = resolve(uploadsDir, safeFilename);
  // Ensure resolved path is still within uploadsDir
  const rel = relative(uploadsDir, filePath);
  if (rel.startsWith('..') || resolve(uploadsDir, rel) !== filePath) {
    return null;
  }
  return { filePath, uploadsDir };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  try {
    const safe = getSafePath(filename);
    if (!safe) {
      return new NextResponse('Invalid filename', { status: 400 });
    }

    if (!existsSync(safe.filePath)) {
      return new NextResponse('Image not found', { status: 404 });
    }

    const fileBuffer = await readFile(safe.filePath);
    const ext = filename.split('.').pop()?.toLowerCase();
    const contentType = ext === 'png' ? 'image/png' : (ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'application/octet-stream');

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD',
      },
    });

  } catch (error) {
    logger.error('Error serving uploaded image:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  try {
    const safe = getSafePath(filename);
    if (!safe) {
      return NextResponse.json({ success: false, message: 'Invalid filename' }, { status: 400 });
    }

    if (existsSync(safe.filePath)) {
      await unlink(safe.filePath);
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ success: false, message: 'File not found' }, { status: 404 });
    }

  } catch (error) {
    logger.error('Error deleting uploaded image:', error);
    return NextResponse.json({ success: false, message: 'Delete failed' }, { status: 500 });
  }
}
