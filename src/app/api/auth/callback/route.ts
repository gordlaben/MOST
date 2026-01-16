import { NextRequest, NextResponse } from 'next/server';
import { getTraktCredentials, setSetting } from '@/lib/settings';
import { TraktClient } from '@/lib/trakt';
import { createRequestContext } from '@/lib/request-logging';
import { prisma } from '@/lib/db';
import { getAppConfig } from '@/lib/config';

export async function GET(request: NextRequest) {
  const ctx = createRequestContext(request, 'api/auth/callback');
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // This contains the profileId if present

  if (!code) {
    ctx.log.warn('Auth callback received without code');
    const response = NextResponse.json({ error: 'No code provided' }, { status: 400 });
    ctx.end(response.status);
    return response;
  }

  ctx.log.info('Received auth callback with code');

  const { clientId, clientSecret } = await getTraktCredentials();
  
  if (!clientId || !clientSecret) {
    ctx.log.error('Trakt credentials missing during callback');
    const response = NextResponse.json({ error: 'Trakt credentials not configured' }, { status: 400 });
    ctx.end(response.status);
    return response;
  }

  const { nextPublicBaseUrl } = getAppConfig();
  const redirectUri = `${nextPublicBaseUrl}/api/auth/callback`;
  const trakt = new TraktClient(clientId, clientSecret, redirectUri);

  try {
    const tokenData = await trakt.exchangeCodeForToken(code);
    const baseUrl = nextPublicBaseUrl;

    if (state) {
      // Profile-specific auth
      const profileId = decodeURIComponent(state);
      ctx.log.info(`Saving tokens for profile ${profileId}`);
      
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

      const response = NextResponse.redirect(new URL(`/stremio/${profileId}/configure?connected=true`, baseUrl));
      ctx.end(response.status);
      return response;
    } else {
      // Global auth (legacy)
      await setSetting('TRAKT_ACCESS_TOKEN', tokenData.access_token);
      await setSetting('TRAKT_REFRESH_TOKEN', tokenData.refresh_token);
      await setSetting('TRAKT_TOKEN_EXPIRES', (Date.now() + tokenData.expires_in * 1000).toString());

      ctx.log.info('Successfully exchanged token and saved to global settings');
      const response = NextResponse.redirect(new URL('/?connected=true', baseUrl));
      ctx.end(response.status);
      return response;
    }
  } catch (error) {
    ctx.log.error('Error exchanging token:', error);
    const response = NextResponse.json({ error: 'Failed to exchange token' }, { status: 500 });
    ctx.end(response.status);
    return response;
  }
}
