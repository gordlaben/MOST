import { describe, expect, it } from 'vitest';
import { mapTraktItemToMeta } from '@/lib/stremio';

const origin = 'http://localhost:3000';

describe('mapTraktItemToMeta', () => {
  it('uses Trakt poster and proxies locally', () => {
    const item = {
      show: {
        title: 'Sample Show',
        year: 2020,
        overview: 'Overview',
        ids: { trakt: 1, slug: 'sample-show', tvdb: 2, imdb: 'tt123', tmdb: 3 },
        images: { poster: ['https://image.tmdb.org/t/p/w500/poster.jpg'] }
      }
    };

    const meta = mapTraktItemToMeta(item, 'series', undefined, origin, undefined, true);

    expect(meta.name).toBe('Sample Show');
    expect(meta.poster).toBe(
      `${origin}/api/image?url=${encodeURIComponent('https://image.tmdb.org/t/p/w500/poster.jpg')}`
    );
  });

  it('uses RPDB poster when key provided', () => {
    const item = {
      show: {
        title: 'Sample Show',
        year: 2020,
        ids: { trakt: 1, slug: 'sample-show', tvdb: 2, imdb: 'tt123', tmdb: 3 }
      }
    };

    const meta = mapTraktItemToMeta(item, 'series', 'rpdb-key', origin, undefined, true);

    expect(meta.poster).toBe(
      `${origin}/api/image?url=${encodeURIComponent('https://api.ratingposterdb.com/rpdb-key/imdb/poster-default/tt123.jpg')}`
    );
  });

  it('creates binge-ready description', () => {
    const item = {
      show: {
        title: 'Sample Show',
        year: 2020,
        ids: { trakt: 1, slug: 'sample-show', tvdb: 2, imdb: 'tt123', tmdb: 3 }
      },
      latestSeason: 3,
      totalEpisodes: 12
    };

    const meta = mapTraktItemToMeta(item, 'series', undefined, origin, 'binge_ready', false);

    expect(meta.description).toContain('Season 3 is ready to binge');
    expect(meta.poster).toBeNull();
  });
});
