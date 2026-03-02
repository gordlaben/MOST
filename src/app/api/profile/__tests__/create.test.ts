import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock all external dependencies before imports
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => ({
    allowed: true,
    remaining: 4,
    resetAt: Date.now() + 60_000,
  })),
  getRateLimitKey: vi.fn((_req: Request, prefix: string) => `${prefix}:test-ip`),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    profile: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/settings', () => ({
  getSetting: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('@/lib/auth', () => ({
  hashPassword: vi.fn(() => Promise.resolve('hashed-password')),
}));

vi.mock('@/lib/route-error', () => ({
  logRouteError: vi.fn(),
}));

import { POST } from '@/app/api/profile/create/route';
import { rateLimit } from '@/lib/rate-limit';
import { prisma } from '@/lib/db';

const mockedRateLimit = vi.mocked(rateLimit);
const mockedPrismaProfileCreate = vi.mocked(prisma.profile.create);

function makeRequest(body?: unknown): Request {
  return new Request('http://localhost/api/profile/create', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe('POST /api/profile/create', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRateLimit.mockReturnValue({
      allowed: true,
      remaining: 4,
      resetAt: Date.now() + 60_000,
    });
    mockedPrismaProfileCreate.mockResolvedValue({
      id: 'new-profile-id',
      password: 'hashed',
      traktAccessToken: null,
      traktRefreshToken: null,
      traktExpiresAt: null,
      rpdbKey: null,
      filters: '{}',
    } as never);
    // Ensure registration is enabled by default
    delete process.env.ENABLE_REGISTRATION;
  });

  afterEach(() => {
    delete process.env.ENABLE_REGISTRATION;
  });

  it('creates a profile with a valid password', async () => {
    const response = await POST(makeRequest({ password: 'validpass' }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ id: 'new-profile-id' });
    expect(mockedPrismaProfileCreate).toHaveBeenCalledTimes(1);
  });

  it('returns 400 for a password shorter than 6 characters', async () => {
    const response = await POST(makeRequest({ password: 'short' }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ error: 'Invalid request body' });
    expect(mockedPrismaProfileCreate).not.toHaveBeenCalled();
  });

  it('returns 400 for an empty password', async () => {
    const response = await POST(makeRequest({ password: '' }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ error: 'Invalid request body' });
  });

  it('returns 400 when password field is missing', async () => {
    const response = await POST(makeRequest({}));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ error: 'Invalid request body' });
  });

  it('returns 403 when registration is disabled', async () => {
    process.env.ENABLE_REGISTRATION = 'false';

    const response = await POST(makeRequest({ password: 'validpass' }));

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body).toEqual({ error: 'Registration is disabled' });
    expect(mockedPrismaProfileCreate).not.toHaveBeenCalled();
  });

  it('returns 429 when rate limit is exceeded', async () => {
    mockedRateLimit.mockReturnValue({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 60_000,
    });

    const response = await POST(makeRequest({ password: 'validpass' }));

    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body).toEqual({ error: 'Too many registration attempts. Try again later.' });
  });

  it('returns 500 when prisma create fails', async () => {
    mockedPrismaProfileCreate.mockRejectedValue(new Error('DB error'));

    const response = await POST(makeRequest({ password: 'validpass' }));

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ error: 'Failed to create profile' });
  });

  it('allows registration when ENABLE_REGISTRATION is not set', async () => {
    delete process.env.ENABLE_REGISTRATION;

    const response = await POST(makeRequest({ password: 'validpass' }));

    expect(response.status).toBe(200);
  });

  it('allows registration when ENABLE_REGISTRATION is true', async () => {
    process.env.ENABLE_REGISTRATION = 'true';

    const response = await POST(makeRequest({ password: 'validpass' }));

    expect(response.status).toBe(200);
  });
});
