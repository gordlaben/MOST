import { prisma } from './db';
import { logger } from './logger';
import { TraktClient } from './trakt';

const settingsCache: Record<string, { value: string | null; expiry: number }> = {};
const CACHE_TTL = 60 * 1000; // 1 Minute Memory Cache

export async function getSetting(key: string): Promise<string | null> {
  const now = Date.now();
  if (settingsCache[key] && now < settingsCache[key].expiry) {
      return settingsCache[key].value;
  }

  const setting = await prisma.setting.findUnique({
    where: { key },
  });
  
  let result: string | null = null;

  if (setting?.value) {
    result = setting.value;
  } else {
    // Fallback to environment variables
    const envValue = process.env[key];
    if (envValue) {
      // Don't debug log every time if we cache it
      // logger.debug(`Setting ${key} not found in DB, using environment variable`); 
      result = envValue;
    }
  }

  // Update Cache
  settingsCache[key] = { value: result, expiry: now + CACHE_TTL };
  return result;
}

export async function setSetting(key: string, value: string): Promise<void> {
  // Invalidate Cache
  if (settingsCache[key]) delete settingsCache[key];

  await prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

export async function getTraktCredentials(profileId?: string) {
  const clientId = await getSetting('TRAKT_CLIENT_ID');
  const clientSecret = await getSetting('TRAKT_CLIENT_SECRET');
  
  let accessToken: string | null = null;

  if (profileId) {
    const profile = await prisma.profile.findUnique({ where: { id: profileId } });
    if (profile) {
      accessToken = profile.traktAccessToken;

      // Check for expiration and refresh if needed
      if (profile.traktExpiresAt && profile.traktRefreshToken && clientId && clientSecret) {
        const expiresAt = parseInt(profile.traktExpiresAt);
        // Refresh if expiring in less than 2 days (172800 seconds) or already expired
        const now = Math.floor(Date.now() / 1000);
        if (expiresAt - now < 172800) {
             try {
                 const trakt = new TraktClient(clientId, clientSecret, '');
                 const newTokens = await trakt.refreshAccessToken(profile.traktRefreshToken);
                 
                 if (newTokens.access_token) {
                     accessToken = newTokens.access_token;
                     const newExpiresAt = (now + newTokens.expires_in).toString();
                     
                     await prisma.profile.update({
                         where: { id: profileId },
                         data: {
                             traktAccessToken: newTokens.access_token,
                             traktRefreshToken: newTokens.refresh_token,
                             traktExpiresAt: newExpiresAt
                         }
                     });
                     logger.info(`Refreshed token for profile ${profileId}`);
                 }
             } catch (e) {
                 logger.error(`Failed to refresh token for profile ${profileId}`, e);
             }
        }
      }
    }
  }

  // Default global token is disabled to ensure clean state for guests
  // if (!accessToken) {
  //   accessToken = await getSetting('TRAKT_ACCESS_TOKEN');
  // }

  return { clientId, clientSecret, accessToken };
}

export async function getProfile(profileId: string) {
  return await prisma.profile.findUnique({ where: { id: profileId } });
}
