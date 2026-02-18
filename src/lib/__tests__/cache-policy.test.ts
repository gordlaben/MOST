import { describe, expect, it } from 'vitest';
import { CACHE_TTL, getCalendarHeaders, isCacheFresh } from '@/lib/cache-policy';

describe('cache policy utilities', () => {
  it('checks freshness by ttl', () => {
    const freshDate = new Date(Date.now() - 1000);
    const staleDate = new Date(Date.now() - CACHE_TTL.calendarMs - 1000);

    expect(isCacheFresh(freshDate, CACHE_TTL.calendarMs)).toBe(true);
    expect(isCacheFresh(staleDate, CACHE_TTL.calendarMs)).toBe(false);
  });

  it('returns calendar headers with cache marker', () => {
    const headers = getCalendarHeaders('HIT');

    expect(headers['Content-Type']).toBe('text/calendar; charset=utf-8');
    expect(headers['Content-Disposition']).toContain('most.ics');
    expect(headers['X-Cache']).toBe('HIT');
  });
});
