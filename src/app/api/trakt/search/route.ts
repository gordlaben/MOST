import { NextRequest, NextResponse } from 'next/server';
import { getTraktCredentials } from '@/lib/settings';
import { TraktClient } from '@/lib/trakt';
import { createRequestContext } from '@/lib/request-logging';
import { z } from 'zod';
import { createServerTiming } from '@/lib/server-timing';
import { aiSearch } from '@/lib/ai-search';

function inferSearchType(query: string): 'movie' | 'show' | undefined {
  const q = query.toLowerCase();
  if (/(\bmovie\b|\bmovies\b|\bfilm\b|\bfilms\b)/.test(q)) return 'movie';
  if (/(\bshow\b|\bshows\b|\btv\b|\bseries\b)/.test(q)) return 'show';
  return undefined;
}

function matchesType(result: unknown, type: 'movie' | 'show') {
  if (!result || typeof result !== 'object') return false;
  const typed = result as { movie?: unknown; show?: unknown };
  return type === 'movie' ? !!typed.movie : !!typed.show;
}

function getResultTitle(result: unknown) {
  if (!result || typeof result !== 'object') return '';
  const typed = result as { movie?: { title?: string }; show?: { title?: string }; title?: string };
  return typed.movie?.title || typed.show?.title || typed.title || '';
}

function getResultKey(result: unknown) {
  if (!result || typeof result !== 'object') return null;
  const typed = result as { movie?: { ids?: { trakt?: number; imdb?: string; tmdb?: number } }; show?: { ids?: { trakt?: number; imdb?: string; tmdb?: number } }; ids?: { trakt?: number; imdb?: string; tmdb?: number } };
  const content = typed.movie || typed.show || typed;
  const ids = content?.ids;
  if (!ids) return null;
  if (ids.trakt) return `trakt:${ids.trakt}`;
  if (ids.imdb) return `imdb:${ids.imdb}`;
  if (ids.tmdb) return `tmdb:${ids.tmdb}`;
  return null;
}

function mergeResults(results: unknown[]) {
  const merged: unknown[] = [];
  const seen = new Set<string>();

  for (const result of results) {
    const key = getResultKey(result);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(result);
  }

  return merged;
}

export async function GET(request: NextRequest) {
  const ctx = createRequestContext(request, 'api/trakt/search');
  const timing = createServerTiming();
  const searchParams = request.nextUrl.searchParams;
  const profileId = searchParams.get('profileId');
  const query = searchParams.get('query');

  const querySchema = z.object({
    profileId: z.string().min(1),
    query: z.string().optional()
  });

  const parsed = querySchema.safeParse({ profileId, query });
  if (!parsed.success) {
    const response = NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
    timing.appendTo(response, 'trakt_search');
    ctx.end(response.status);
    return response;
  }

  if (!profileId) {
    const response = NextResponse.json({ error: 'Profile ID required' }, { status: 400 });
    ctx.end(response.status);
    return response;
  }

  if (!query) {
      const response = NextResponse.json({ results: [] });
      ctx.end(response.status);
      return response;
  }

  try {
    const { clientId, clientSecret, accessToken } = await getTraktCredentials(profileId);

    if (!accessToken) {
      const response = NextResponse.json({ error: 'Not connected to Trakt' }, { status: 401 });
      timing.appendTo(response, 'trakt_search');
      ctx.end(response.status);
      return response;
    }

    const trakt = new TraktClient(
      clientId || '',
      clientSecret || '',
      '',
      accessToken
    );

    const inferredType = inferSearchType(query);
    const normalizedQuery = query.trim().toLowerCase();

    let traktResults: unknown[] = [];
    if (inferredType) {
      traktResults = await trakt.search(query, inferredType);
    } else {
      const [movieResults, showResults] = await Promise.all([
        trakt.search(query, 'movie'),
        trakt.search(query, 'show')
      ]);
      traktResults = [...(movieResults || []), ...(showResults || [])];
    }

    const hasExactMatch = traktResults.some((item) =>
      getResultTitle(item).toLowerCase() === normalizedQuery
    );

    let results = traktResults;

    if (!hasExactMatch) {
      const ai = await aiSearch(query, trakt, profileId || undefined, inferredType);
      const aiResults = ai.results || [];

      if (aiResults.length > 0) {
        if (!inferredType) {
          const hasMovie = aiResults.some((item) => matchesType(item, 'movie'));
          const hasShow = aiResults.some((item) => matchesType(item, 'show'));
          const supplemental = traktResults.filter((item) =>
            (hasMovie ? false : matchesType(item, 'movie')) || (hasShow ? false : matchesType(item, 'show'))
          );
          results = mergeResults([...aiResults, ...supplemental]);
        } else {
          results = aiResults;
        }
      }
    }

    if (inferredType) {
      results = (results || []).filter((item) => matchesType(item, inferredType));
    }

    const response = NextResponse.json({ results });
    timing.appendTo(response, 'trakt_search');
    ctx.end(response.status);
    return response;
  } catch (error) {
    ctx.log.error('Failed to search trakt', error);
    const response = NextResponse.json({ error: 'Failed to search' }, { status: 500 });
    timing.appendTo(response, 'trakt_search');
    ctx.end(response.status);
    return response;
  }
}
