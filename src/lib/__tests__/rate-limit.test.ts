import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// We need to isolate the module between tests so the internal rateMap resets.
// We also need to stop the setInterval from leaking.
let rateLimit: typeof import('@/lib/rate-limit').rateLimit;
let getRateLimitKey: typeof import('@/lib/rate-limit').getRateLimitKey;

describe('rateLimit', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    // Re-import the module each time so the internal Map is fresh
    vi.resetModules();
    const mod = await import('@/lib/rate-limit');
    rateLimit = mod.rateLimit;
    getRateLimitKey = mod.getRateLimitKey;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows requests within the limit', () => {
    const opts = { limit: 3, windowMs: 60_000 };

    const r1 = rateLimit('test-key', opts);
    const r2 = rateLimit('test-key', opts);
    const r3 = rateLimit('test-key', opts);

    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);

    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);

    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it('blocks requests over the limit', () => {
    const opts = { limit: 2, windowMs: 60_000 };

    rateLimit('over-key', opts);
    rateLimit('over-key', opts);
    const r3 = rateLimit('over-key', opts);

    expect(r3.allowed).toBe(false);
    expect(r3.remaining).toBe(0);
  });

  it('resets after the window expires', () => {
    const opts = { limit: 1, windowMs: 10_000 };

    const r1 = rateLimit('reset-key', opts);
    expect(r1.allowed).toBe(true);

    const r2 = rateLimit('reset-key', opts);
    expect(r2.allowed).toBe(false);

    // Advance past the window
    vi.advanceTimersByTime(10_001);

    const r3 = rateLimit('reset-key', opts);
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it('tracks different keys independently', () => {
    const opts = { limit: 1, windowMs: 60_000 };

    const rA = rateLimit('key-a', opts);
    const rB = rateLimit('key-b', opts);

    expect(rA.allowed).toBe(true);
    expect(rB.allowed).toBe(true);

    // Both are now at their limit
    expect(rateLimit('key-a', opts).allowed).toBe(false);
    expect(rateLimit('key-b', opts).allowed).toBe(false);
  });

  it('returns a resetAt timestamp in the future', () => {
    const now = Date.now();
    const opts = { limit: 5, windowMs: 30_000 };
    const result = rateLimit('ts-key', opts);

    expect(result.resetAt).toBeGreaterThanOrEqual(now + 30_000);
  });
});

describe('getRateLimitKey', () => {
  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('@/lib/rate-limit');
    getRateLimitKey = mod.getRateLimitKey;
  });

  it('uses x-forwarded-for header when present', () => {
    const request = new Request('http://localhost/api/test', {
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
    });

    const key = getRateLimitKey(request, 'login');
    expect(key).toBe('login:1.2.3.4');
  });

  it('falls back to unknown when no forwarded header', () => {
    const request = new Request('http://localhost/api/test');

    const key = getRateLimitKey(request, 'register');
    expect(key).toBe('register:unknown');
  });
});
