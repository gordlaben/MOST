export interface StremioMeta {
  id: string;
  type: string;
  name: string;
  poster: string | null;
  description: string;
  releaseInfo: string;
  background?: string;
  logo?: string;
  imdbRating?: string;
  genres?: string[];
  runtime?: string;
  videos?: {
      id: string;
      title: string;
      released: string;
      thumbnail?: string | null;
      season: number;
      episode: number;
      overview?: string;
  }[];
}

export function mapTraktItemToMeta(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  item: any, 
  type: string, 
  rpdbKey: string | undefined, 
  origin: string, 
  catalogId?: string,
  useLocalCache: boolean = true,
  profileId?: string
): StremioMeta {
  const content = item.show || item.movie || item;
  let poster = null;
  let originalPoster: string | null = null;

  // 1. Try to get poster from Trakt response
  if (content.images?.poster) {
    if (Array.isArray(content.images.poster) && content.images.poster.length > 0) {
      poster = content.images.poster[0];
    } else if (typeof content.images.poster === 'object' && content.images.poster.thumb) {
      poster = content.images.poster.thumb;
    } else if (typeof content.images.poster === 'string') {
      poster = content.images.poster;
    }
  }

  if (poster && !poster.startsWith('http')) {
    poster = `https://${poster}`;
  }
  originalPoster = poster;

  // 2. Override with RPDB if available
  if (rpdbKey && rpdbKey !== 'disabled' && content.ids) {
    if (content.ids.imdb) {
      poster = `https://api.ratingposterdb.com/${rpdbKey}/imdb/poster-default/${content.ids.imdb}.jpg`;
    } else if (content.ids.tmdb) {
      poster = `https://api.ratingposterdb.com/${rpdbKey}/tmdb/poster-default/${content.ids.tmdb}.jpg`;
    } else if (content.ids.tvdb) {
      poster = `https://api.ratingposterdb.com/${rpdbKey}/tvdb/poster-default/${content.ids.tvdb}.jpg`;
    }
  }

  // 3. Use local proxy for caching (if enabled)
  if (poster && useLocalCache) {
    const fallbackParam = originalPoster && poster.includes('ratingposterdb.com')
      ? `&fallback=${encodeURIComponent(originalPoster)}`
      : '';
    const profileParam = profileId ? `&profileId=${encodeURIComponent(profileId)}` : '';
    poster = `${origin}/api/image?url=${encodeURIComponent(poster)}${fallbackParam}${profileParam}`;
  }

  // 4. Generate Description
  let description = '';
  if (catalogId === 'binge_ready') {
    description = `Season ${item.latestSeason} is ready to binge! (${item.totalEpisodes} episodes)`;
  } else if (catalogId === 'episodes_left') {
    description = `${item.totalEpisodes - item.watchedEpisodes} episodes left to watch. Last watched: ${new Date(item.releaseDate).toLocaleDateString('de-DE')}`;
  } else {
    description = content.overview || (content.year ? `${content.year}` : '');
  }

  // 5. Generate Release Info
  let releaseInfo = '';
  if (catalogId === 'binge_ready' || catalogId === 'episodes_left') {
      releaseInfo = `${item.latestSeason}`;
  } else {
      releaseInfo = content.year ? `${content.year}` : '';
  }

  return {
    id: content.ids.imdb || `tt${content.ids.tmdb}` || `trakt:${content.ids.trakt}`,
    type: type,
    name: content.title,
    poster: poster,
    description: description,
    releaseInfo: releaseInfo,
  };
}
