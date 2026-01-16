import { TraktEpisode, TraktSeason } from './trakt';

export function getBingeReadyStatusFromSeasons(
  seasons: TraktSeason[]
): { isReady: boolean; releaseDate: Date | null; lastEpisode: TraktEpisode | null; season: TraktSeason | null } {
  // Filter out specials (season 0)
  const regularSeasons = seasons.filter((s) => s.number > 0);

  if (regularSeasons.length === 0) {
    return { isReady: false, releaseDate: null, lastEpisode: null, season: null };
  }

  const lastSeason = regularSeasons[regularSeasons.length - 1];
  const episodes = lastSeason.episodes || [];

  if (episodes.length === 0) {
    return { isReady: false, releaseDate: null, lastEpisode: null, season: lastSeason };
  }

  const lastEpisode = episodes[episodes.length - 1];

  if (!lastEpisode.first_aired) {
    return { isReady: false, releaseDate: null, lastEpisode: null, season: null };
  }

  const airDate = new Date(lastEpisode.first_aired);

  if (isNaN(airDate.getTime()) || airDate.getFullYear() === 1970) {
    return { isReady: false, releaseDate: null, lastEpisode: null, season: null };
  }

  const now = new Date();

  return {
    isReady: now >= airDate,
    releaseDate: airDate,
    lastEpisode,
    season: lastSeason
  };
}
