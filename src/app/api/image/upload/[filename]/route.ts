
import { NextRequest, NextResponse } from 'next/server';
import { readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  
  try {
    const filePath = join(process.cwd(), 'data/uploads', filename);

    if (!existsSync(filePath)) {
      return new NextResponse('Image not found', { status: 404 });
    }

    const fileBuffer = await readFile(filePath);
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
    console.error('Error serving uploaded image:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  try {
    // Prevent directory traversal
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '');
    const uploadsDir = join(process.cwd(), 'data/uploads');
    const filePath = join(uploadsDir, safeFilename);

    if (existsSync(filePath)) {
      await unlink(filePath);
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ success: false, message: 'File not found' }, { status: 404 });
    }

  } catch (error) {
    console.error('Error deleting uploaded image:', error);
    return NextResponse.json({ success: false, message: 'Delete failed' }, { status: 500 });
  }
}
