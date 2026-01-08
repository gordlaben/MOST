import { NextRequest, NextResponse } from 'next/server';
import { getTraktCredentials, setSetting } from '@/lib/settings';
import { TraktClient } from '@/lib/trakt';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // This contains the profileId if present

  if (!code) {
    logger.warn('Auth callback received without code');
    return NextResponse.json({ error: 'No code provided' }, { status: 400 });
  }

  logger.info('Received auth callback with code');

  const { clientId, clientSecret } = await getTraktCredentials();
  
  if (!clientId || !clientSecret) {
    logger.error('Trakt credentials missing during callback');
    return NextResponse.json({ error: 'Trakt credentials not configured' }, { status: 400 });
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/auth/callback`;
  const trakt = new TraktClient(clientId, clientSecret, redirectUri);

  try {
    const tokenData = await trakt.exchangeCodeForToken(code);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    if (state) {
      // Profile-specific auth
      const profileId = decodeURIComponent(state);
      logger.info(`Saving tokens for profile ${profileId}`);
      
      // Generate version based on date and time (YYYY.MM.DD.HHMMSS)
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      const newVersion = `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())}.${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

      await prisma.profile.update({
        where: { id: profileId },
        data: {
          traktAccessToken: tokenData.access_token,
          traktRefreshToken: tokenData.refresh_token,
          traktExpiresAt: (Date.now() + tokenData.expires_in * 1000).toString(),
          manifestVersion: newVersion
        }
      });

      return NextResponse.redirect(new URL(`/stremio/${profileId}/configure?connected=true`, baseUrl));
    } else {
      // Global auth (legacy)
      await setSetting('TRAKT_ACCESS_TOKEN', tokenData.access_token);
      await setSetting('TRAKT_REFRESH_TOKEN', tokenData.refresh_token);
      await setSetting('TRAKT_TOKEN_EXPIRES', (Date.now() + tokenData.expires_in * 1000).toString());

      logger.info('Successfully exchanged token and saved to global settings');
      return NextResponse.redirect(new URL('/?connected=true', baseUrl));
    }
  } catch (error) {
    logger.error('Error exchanging token:', error);
    return NextResponse.json({ error: 'Failed to exchange token' }, { status: 500 });
  }
}
