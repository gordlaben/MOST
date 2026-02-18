import { getTraktCredentials } from '@/lib/settings';
import { TraktClient } from '@/lib/trakt';
import { jsonError } from '@/lib/http-response';

interface TraktClientOptions {
  requireClientCredentials?: boolean;
  notConnectedMessage?: string;
  missingCredentialsMessage?: string;
  redirectUri?: string;
  includeProfileId?: boolean;
}

export async function getAuthorizedTraktClient(
  profileId: string | undefined,
  options: TraktClientOptions = {}
) {
  const { clientId, clientSecret, accessToken } = await getTraktCredentials(profileId);

  if (!accessToken) {
    return {
      errorResponse: jsonError(options.notConnectedMessage || 'Not connected to Trakt', 401)
    };
  }

  if (options.requireClientCredentials && (!clientId || !clientSecret)) {
    return {
      errorResponse: jsonError(options.missingCredentialsMessage || 'Missing Trakt credentials', 401)
    };
  }

  return {
    client: new TraktClient(
      clientId || '',
      clientSecret || '',
      options.redirectUri || '',
      accessToken,
      options.includeProfileId ? profileId : undefined
    )
  };
}

export function isAdminPasswordConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD);
}

export function isAdminPasswordValid(password: string | undefined | null) {
  if (!password || !process.env.ADMIN_PASSWORD) return false;
  return password === process.env.ADMIN_PASSWORD;
}

export function isAdminRequestAuthorized(request: Request) {
  return isAdminPasswordValid(request.headers.get('authorization'));
}
