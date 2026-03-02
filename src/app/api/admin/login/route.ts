import { jsonError, jsonSuccess } from '@/lib/http-response';
import { isAdminPasswordConfigured, isAdminPasswordValid } from '@/lib/route-auth';
import { z } from 'zod';
import { parseAndValidateJson } from '@/lib/request-validation';
import { rateLimit, getRateLimitKey } from '@/lib/rate-limit';

const bodySchema = z.object({
  password: z.string().min(1)
});

export async function POST(request: Request) {
  const rl = rateLimit(getRateLimitKey(request, 'admin-login'), { limit: 5, windowMs: 60_000 });
  if (!rl.allowed) {
    return jsonError('Too many attempts. Try again later.', 429);
  }

  try {
    const parsedBody = await parseAndValidateJson(request, bodySchema);
    if (!parsedBody.success) {
      return parsedBody.errorResponse;
    }

    const { password } = parsedBody.data;

    if (!isAdminPasswordConfigured()) {
      return jsonError('Admin password not configured', 500);
    }

    if (isAdminPasswordValid(password)) {
      return jsonSuccess({ success: true });
    }

    return jsonError('Invalid password', 401);
  } catch {
    return jsonError('Invalid request', 400);
  }
}
