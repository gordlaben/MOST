import { prisma } from '@/lib/db';
import { jsonError, jsonSuccess } from '@/lib/http-response';
import { logRouteError } from '@/lib/route-error';

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

    return jsonSuccess({ success: true });
  } catch (error) {
    logRouteError('api/auth/logout', 'Logout failed', error);
    return jsonError('Logout failed', 500);
  }
}
