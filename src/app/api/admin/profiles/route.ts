import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { TraktClient } from '@/lib/trakt';
import { getTraktCredentials } from '@/lib/settings';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

function isAuthenticated(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !ADMIN_PASSWORD) return false;
  return authHeader === ADMIN_PASSWORD;
}

export async function GET(request: Request) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
          console.error(`Failed to fetch username for profile ${profile.id}`, e);
          username = 'Error fetching';
        }
      }
      
      return {
        id: profile.id,
        createdAt: profile.createdAt,
        username
      };
    }));

    return NextResponse.json(profilesWithUsernames);
  } catch (error) {
    console.error('Admin profiles error:', error);
    return NextResponse.json({ error: 'Failed to fetch profiles' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await request.json();
    
    if (!id) {
      return NextResponse.json({ error: 'Profile ID required' }, { status: 400 });
    }

    await prisma.profile.delete({
      where: { id }
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete profile error:', error);
    return NextResponse.json({ error: 'Failed to delete profile' }, { status: 500 });
  }
}
