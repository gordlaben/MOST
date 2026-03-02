import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock rate-limit before importing the route
vi.mock('@/lib/rate-limit', () => {
  let callCount = 0;
  return {
    rateLimit: vi.fn((_key: string, opts: { limit: number }) => {
      callCount++;
      if (callCount > opts.limit) {
        return { allowed: false, remaining: 0, resetAt: Date.now() + 60_000 };
      }
      return { allowed: true, remaining: opts.limit - callCount, resetAt: Date.now() + 60_000 };
    }),
    getRateLimitKey: vi.fn((_req: Request, prefix: string) => `${prefix}:test-ip`),
    _resetCallCount: () => { callCount = 0; },
  };
});

import { POST } from '@/app/api/admin/login/route';
import { rateLimit } from '@/lib/rate-limit';

const mockedRateLimit = vi.mocked(rateLimit);

function makeRequest(body?: unknown): Request {
  return new Request('http://localhost/api/admin/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe('POST /api/admin/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: rate limit allows
    mockedRateLimit.mockReturnValue({
      allowed: true,
      remaining: 4,
      resetAt: Date.now() + 60_000,
    });
    process.env.ADMIN_PASSWORD = 'correct-password';
  });

  afterEach(() => {
    delete process.env.ADMIN_PASSWORD;
  });

  it('returns success for a valid password', async () => {
    const response = await POST(makeRequest({ password: 'correct-password' }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ success: true });
  });

  it('returns 401 for an invalid password', async () => {
    const response = await POST(makeRequest({ password: 'wrong-password' }));

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ error: 'Invalid password' });
  });

  it('returns 400 for a missing password field', async () => {
    const response = await POST(makeRequest({}));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ error: 'Invalid request body' });
  });

  it('returns 400 for an empty password string', async () => {
    const response = await POST(makeRequest({ password: '' }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ error: 'Invalid request body' });
  });

  it('returns 500 when ADMIN_PASSWORD is not configured', async () => {
    delete process.env.ADMIN_PASSWORD;

    const response = await POST(makeRequest({ password: 'anything' }));

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ error: 'Admin password not configured' });
  });

  it('returns 429 when rate limit is exceeded', async () => {
    mockedRateLimit.mockReturnValue({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 60_000,
    });

    const response = await POST(makeRequest({ password: 'correct-password' }));

    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body).toEqual({ error: 'Too many attempts. Try again later.' });
  });

  it('rate limits after 5 attempts by passing correct params', async () => {
    // Verify rateLimit is called with limit: 5 and windowMs: 60000
    await POST(makeRequest({ password: 'test' }));

    expect(rateLimit).toHaveBeenCalledWith(
      expect.any(String),
      { limit: 5, windowMs: 60_000 }
    );
  });

  it('returns 400 for invalid JSON body', async () => {
    const request = new Request('http://localhost/api/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json',
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });
});
