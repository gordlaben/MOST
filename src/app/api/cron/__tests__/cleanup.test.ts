import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({
  prisma: {
    calendarCache: {
      deleteMany: vi.fn(() => Promise.resolve({ count: 0 })),
      findMany: vi.fn(() => Promise.resolve([])),
    },
  },
}));

vi.mock('@/lib/request-logging', () => ({
  createRequestContext: vi.fn(() => ({
    requestId: 'test-id',
    startTime: Date.now(),
    log: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    end: vi.fn(),
  })),
}));

vi.mock('@/lib/route-response', () => ({
  finalizeApiResponse: vi.fn((response: Response) => response),
}));

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(() => false),
    promises: {
      readdir: vi.fn(() => Promise.resolve([])),
      unlink: vi.fn(() => Promise.resolve()),
    },
  },
  existsSync: vi.fn(() => false),
  promises: {
    readdir: vi.fn(() => Promise.resolve([])),
    unlink: vi.fn(() => Promise.resolve()),
  },
}));

import { GET } from '@/app/api/cron/cleanup/route';

function makeRequest(authHeader?: string): Request {
  const headers: Record<string, string> = {};
  if (authHeader) {
    headers['authorization'] = authHeader;
  }
  return new Request('http://localhost/api/cron/cleanup', {
    method: 'GET',
    headers,
  });
}

describe('GET /api/cron/cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_PASSWORD = 'cron-secret';
  });

  afterEach(() => {
    delete process.env.ADMIN_PASSWORD;
  });

  it('returns 401 without authorization header', async () => {
    const response = await GET(makeRequest());

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ error: 'Unauthorized' });
  });

  it('returns 401 with wrong authorization header', async () => {
    const response = await GET(makeRequest('wrong-password'));

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ error: 'Unauthorized' });
  });

  it('returns success with valid authorization', async () => {
    const response = await GET(makeRequest('cron-secret'));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ success: true, message: 'Cleanup completed' });
  });

  it('returns 401 when ADMIN_PASSWORD is not set', async () => {
    delete process.env.ADMIN_PASSWORD;

    const response = await GET(makeRequest('any-password'));

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ error: 'Unauthorized' });
  });
});
