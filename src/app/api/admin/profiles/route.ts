import { prisma } from '@/lib/db';
import { TraktClient } from '@/lib/trakt';
import { getTraktCredentials } from '@/lib/settings';
import { jsonError, jsonSuccess } from '@/lib/http-response';
import { logRouteError } from '@/lib/route-error';
import { isAdminRequestAuthorized } from '@/lib/route-auth';

export async function GET(request: Request) {
  if (!isAdminRequestAuthorized(request)) {
    return jsonError('Unauthorized', 401);
  }

  try {
    const profiles = await prisma.profile.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        traktAccessToken: true,
      }
    });

    // Fetch usernames in parallel
    const profilesWithUsernames = await Promise.all(profiles.map(async (profile) => {
      let username = 'Not Connected';
      
      if (profile.traktAccessToken) {
        try {
           const { clientId, clientSecret } = await getTraktCredentials();
           if (clientId && clientSecret) {
             // We create a client with the user's access token
             const trakt = new TraktClient(clientId, clientSecret, '', profile.traktAccessToken);
             const userProfile = await trakt.getUserProfile();
             username = userProfile.username;
           }
        } catch (e) {
          logRouteError('api/admin/profiles', 'Failed to fetch profile username', e, { profileId: profile.id });
          username = 'Error fetching';
        }
      }
      
      return {
        id: profile.id,
        createdAt: profile.createdAt,
        username
      };
    }));

    return jsonSuccess(profilesWithUsernames);
  } catch (error) {
    logRouteError('api/admin/profiles', 'Failed to fetch profiles', error);
    return jsonError('Failed to fetch profiles', 500);
  }
}

export async function DELETE(request: Request) {
  if (!isAdminRequestAuthorized(request)) {
    return jsonError('Unauthorized', 401);
  }

  try {
    const { id } = await request.json();
    
    if (!id) {
      return jsonError('Profile ID required', 400);
    }

    await prisma.profile.delete({
      where: { id }
    });
    
    return jsonSuccess({ success: true });
  } catch (error) {
    logRouteError('api/admin/profiles', 'Failed to delete profile', error);
    return jsonError('Failed to delete profile', 500);
  }
}
