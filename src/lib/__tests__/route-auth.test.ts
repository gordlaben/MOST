import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/settings', () => ({
  getTraktCredentials: vi.fn(),
}));

import { getTraktCredentials } from '@/lib/settings';
import {
  getAuthorizedTraktClient,
  isAdminPasswordConfigured,
  isAdminPasswordValid,
  isAdminRequestAuthorized,
} from '@/lib/route-auth';

const mockedGetTraktCredentials = vi.mocked(getTraktCredentials);

describe('route auth helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ADMIN_PASSWORD;
  });

  it('returns not connected error when access token is missing', async () => {
    mockedGetTraktCredentials.mockResolvedValue({
      clientId: 'id',
      clientSecret: 'secret',
      accessToken: null,
    });

    const result = await getAuthorizedTraktClient('profile-1');

    expect('errorResponse' in result).toBe(true);
    if ('errorResponse' in result) {
      expect(result.errorResponse.status).toBe(401);
      await expect(result.errorResponse.json()).resolves.toEqual({ error: 'Not connected to Trakt' });
    }
  });

  it('returns client when credentials are valid', async () => {
    mockedGetTraktCredentials.mockResolvedValue({
      clientId: 'id',
      clientSecret: 'secret',
      accessToken: 'token',
    });

    const result = await getAuthorizedTraktClient('profile-1', { includeProfileId: true });

    expect('client' in result).toBe(true);
    if ('client' in result) {
      expect(result.client).toBeDefined();
    }
  });

  it('validates admin password and request authorization', () => {
    process.env.ADMIN_PASSWORD = 'top-secret';

    expect(isAdminPasswordConfigured()).toBe(true);
    expect(isAdminPasswordValid('top-secret')).toBe(true);
    expect(isAdminPasswordValid('wrong')).toBe(false);

    const request = new Request('http://localhost/admin', {
      headers: { authorization: 'top-secret' },
    });

    expect(isAdminRequestAuthorized(request)).toBe(true);
  });
});
