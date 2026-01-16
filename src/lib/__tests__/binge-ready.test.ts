import { describe, expect, it } from 'vitest';
import { getBingeReadyStatusFromSeasons } from '@/lib/binge-ready';

const baseSeason = {
  number: 1,
  ids: { trakt: 1, tvdb: 1, tmdb: 1 },
  episode_count: 2,
  episodes: []
};

describe('getBingeReadyStatusFromSeasons', () => {
  it('returns not ready when no regular seasons', () => {
    const result = getBingeReadyStatusFromSeasons([{ ...baseSeason, number: 0 }]);
    expect(result.isReady).toBe(false);
    expect(result.season).toBeNull();
  });

  it('returns ready when last episode aired in past', () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    const result = getBingeReadyStatusFromSeasons([
      {
        ...baseSeason,
        episodes: [
          { season: 1, number: 1, title: 'Ep1', ids: { trakt: 1, tvdb: 1, imdb: 'tt1', tmdb: 1 }, first_aired: pastDate }
        ]
      }
    ]);

    expect(result.isReady).toBe(true);
    expect(result.releaseDate).not.toBeNull();
  });

  it('returns not ready when last episode is in future', () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    const result = getBingeReadyStatusFromSeasons([
      {
        ...baseSeason,
        episodes: [
          { season: 1, number: 1, title: 'Ep1', ids: { trakt: 1, tvdb: 1, imdb: 'tt1', tmdb: 1 }, first_aired: futureDate }
        ]
      }
    ]);

    expect(result.isReady).toBe(false);
  });
});
