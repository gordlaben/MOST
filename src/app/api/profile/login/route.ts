import { prisma } from '@/lib/db';
import { verifyPassword, createSessionToken } from '@/lib/auth';
import { z } from 'zod';
import { jsonError, jsonSuccess } from '@/lib/http-response';
import { logRouteError } from '@/lib/route-error';
import { parseAndValidateJson } from '@/lib/request-validation';

const bodySchema = z.object({
  id: z.string().min(1),
  password: z.string().min(1)
});

export async function POST(request: Request) {
  try {
    const parsedBody = await parseAndValidateJson(request, bodySchema);
    if (!parsedBody.success) {
      return parsedBody.errorResponse;
    }

    const { id, password } = parsedBody.data;

    if (!id || !password) {
      return jsonError('ID and password are required', 400);
    }

    const profile = await prisma.profile.findUnique({ where: { id } });

    if (!profile || !(await verifyPassword(password, profile.password))) {
      return jsonError('Invalid credentials', 401);
    }

    const token = await createSessionToken(profile.id);

    return jsonSuccess({ token });
  } catch (error) {
    logRouteError('api/profile/login', 'Login failed', error);
    return jsonError('Login failed', 500);
  }
}
