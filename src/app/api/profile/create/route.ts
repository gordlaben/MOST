import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { getSetting } from '@/lib/settings';

export async function POST(request: Request) {
  try {
    // Check if registration is enabled
    if (process.env.ENABLE_REGISTRATION === 'false') {
      return NextResponse.json({ error: 'Registration is disabled' }, { status: 403 });
    }

    const { password } = await request.json();

    if (!password) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    // Fetch current global settings to copy
    const traktAccessToken = await getSetting('TRAKT_ACCESS_TOKEN');
    const traktRefreshToken = await getSetting('TRAKT_REFRESH_TOKEN');
    const traktExpiresAt = await getSetting('TRAKT_TOKEN_EXPIRES');
    const rpdbKey = await getSetting('RPDB_API_KEY');
    
    const includeEnded = await getSetting('FILTER_INCLUDE_ENDED');
    const includeCanceled = await getSetting('FILTER_INCLUDE_CANCELED');
    const includeReturning = await getSetting('FILTER_INCLUDE_RETURNING');
    const sortBy = await getSetting('FILTER_SORT_BY');

    const filters = JSON.stringify({
      includeEnded: includeEnded !== 'false',
      includeCanceled: includeCanceled !== 'false',
      includeReturning: includeReturning !== 'false',
      sortBy: sortBy || 'newest'
    });

    const hashedPassword = await hashPassword(password);

    const profile = await prisma.profile.create({
      data: {
        password: hashedPassword,
        traktAccessToken,
        traktRefreshToken,
        traktExpiresAt,
        rpdbKey,
        filters
      }
    });

    return NextResponse.json({ id: profile.id });
  } catch (error) {
    console.error('Error creating profile:', error);
    return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 });
  }
}
