import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST() {
  try {
    // Remove Trakt tokens
    await prisma.setting.deleteMany({
      where: {
        key: {
          in: ['TRAKT_ACCESS_TOKEN', 'TRAKT_REFRESH_TOKEN']
        }
      }
    });

    // Clear cache as it belongs to the user
    await prisma.calendarCache.deleteMany({});

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logout failed:', error);
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 });
  }
}
