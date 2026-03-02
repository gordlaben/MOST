import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { getSetting } from '@/lib/settings';
import { z } from 'zod';
import { jsonError, jsonSuccess } from '@/lib/http-response';
import { logRouteError } from '@/lib/route-error';
import { parseAndValidateJson } from '@/lib/request-validation';
import { rateLimit, getRateLimitKey } from '@/lib/rate-limit';

const bodySchema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters').max(128)
});

export async function POST(request: Request) {
  const rl = rateLimit(getRateLimitKey(request, 'profile-create'), { limit: 5, windowMs: 60_000 });
  if (!rl.allowed) {
    return jsonError('Too many registration attempts. Try again later.', 429);
  }

  try {
    // Check if registration is enabled
    if (process.env.ENABLE_REGISTRATION === 'false') {
      return jsonError('Registration is disabled', 403);
    }

    const parsedBody = await parseAndValidateJson(request, bodySchema);
    if (!parsedBody.success) {
      return parsedBody.errorResponse;
    }

    const { password } = parsedBody.data;

    if (!password) {
      return jsonError('Password is required', 400);
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

    return jsonSuccess({ id: profile.id });
  } catch (error) {
    logRouteError('api/profile/create', 'Profile creation failed', error);
    return jsonError('Failed to create profile', 500);
  }
}
