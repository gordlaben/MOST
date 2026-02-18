const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const CACHE_TTL = {
  calendarMs: ONE_DAY_MS,
  catalogMs: ONE_DAY_MS,
} as const;

export function isCacheFresh(updatedAt: Date, ttlMs: number): boolean {
  return Date.now() - updatedAt.getTime() < ttlMs;
}

export function getCalendarHeaders(cacheStatus: 'HIT' | 'MISS' | 'STALE-ERROR') {
  return {
    'Content-Type': 'text/calendar; charset=utf-8',
    'Content-Disposition': 'attachment; filename="most.ics"',
    'X-Cache': cacheStatus,
  };
}
