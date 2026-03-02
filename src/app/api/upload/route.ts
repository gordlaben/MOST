
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import crypto from 'crypto';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const data = await request.formData();
    const file: File | null = data.get('file') as unknown as File;

    if (!file) {
      return NextResponse.json({ success: false, message: 'No file uploaded' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create unique filename
    const hash = crypto.randomBytes(16).toString('hex');
    const ext = file.name.split('.').pop() || 'jpg';
    const filename = `${hash}.${ext}`;
    
    // Ensure uploads directory exists
    const uploadDir = join(process.cwd(), 'data/uploads');
    await mkdir(uploadDir, { recursive: true });

    // Save file
    const path = join(uploadDir, filename);
    await writeFile(path, buffer);

    // Return relative URL to store in DB
    // This allows the domain to change without breaking the image
    const url = `/api/image/upload/${filename}`;

    return NextResponse.json({ success: true, url });
  } catch (error) {
    logger.error('Upload failed:', error);
    return NextResponse.json({ success: false, message: 'Upload failed' }, { status: 500 });
  }
}
