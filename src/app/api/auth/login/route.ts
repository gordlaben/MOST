import { NextRequest, NextResponse } from 'next/server';
import { getTraktCredentials } from '@/lib/settings';
import { TraktClient } from '@/lib/trakt';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  logger.info('Initiating Trakt login');
  const searchParams = request.nextUrl.searchParams;
  const profileId = searchParams.get('profileId');

  const { clientId, clientSecret } = await getTraktCredentials();
  
  if (!clientId || !clientSecret) {
    logger.error('Trakt credentials missing during login initiation');
    return NextResponse.json({ error: 'Trakt credentials not configured' }, { status: 400 });
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/auth/callback`;
  const trakt = new TraktClient(clientId, clientSecret, redirectUri);

  return NextResponse.redirect(trakt.getAuthUrl(profileId || undefined));
}
