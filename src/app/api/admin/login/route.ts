import { jsonError, jsonSuccess } from '@/lib/http-response';
import { isAdminPasswordConfigured, isAdminPasswordValid } from '@/lib/route-auth';

export async function POST(request: Request) {
  try {
    const { password } = await request.json();

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
