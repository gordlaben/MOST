import { NextRequest, NextResponse } from 'next/server';
import { getTraktCredentials } from '@/lib/settings';
import { TraktClient } from '@/lib/trakt';
import { createRequestContext } from '@/lib/request-logging';
import { getAppConfig } from '@/lib/config';

export async function GET(request: NextRequest) {
  const ctx = createRequestContext(request, 'api/auth/login');
  ctx.log.info('Initiating Trakt login');
  const searchParams = request.nextUrl.searchParams;
  const profileId = searchParams.get('profileId');

  const { clientId, clientSecret } = await getTraktCredentials();
  
  if (!clientId || !clientSecret) {
    ctx.log.error('Trakt credentials missing during login initiation');
    const response = NextResponse.json({ error: 'Trakt credentials not configured' }, { status: 400 });
    ctx.end(response.status);
    return response;
  }

  const { nextPublicBaseUrl } = getAppConfig();
  const redirectUri = `${nextPublicBaseUrl}/api/auth/callback`;
  const trakt = new TraktClient(clientId, clientSecret, redirectUri);

  const response = NextResponse.redirect(trakt.getAuthUrl(profileId || undefined));
  ctx.end(response.status);
  return response;
}
