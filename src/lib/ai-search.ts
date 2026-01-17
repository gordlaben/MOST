import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/db';
import { getSetting } from '@/lib/settings';
import type { TraktClient } from '@/lib/trakt';

export type AISearchItem = {
  type: 'movie' | 'show';
  title: string;
  year?: number;
};

type TraktIds = { trakt?: number; imdb?: string; tmdb?: number };
type TraktSearchResult = { movie?: { ids?: TraktIds }; show?: { ids?: TraktIds }; ids?: TraktIds };

async function getGeminiKey(profileId?: string): Promise<string | null> {
  if (profileId) {
    const profile = (await prisma.profile.findUnique({ where: { id: profileId } })) as
      | { geminiKey?: string | null }
      | null;
    if (profile?.geminiKey) return profile.geminiKey;
  }

  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;

  const settingKey = await getSetting('GEMINI_API_KEY');
  return settingKey || null;
}

async function getGeminiModel(profileId?: string): Promise<string | null> {
  if (profileId) {
    const profile = (await prisma.profile.findUnique({ where: { id: profileId } })) as
      | { filters?: string | null }
      | null;
    if (profile?.filters) {
      try {
        const filters = JSON.parse(profile.filters) as { geminiModel?: string };
        if (filters.geminiModel) return filters.geminiModel;
      } catch {
        // ignore invalid filters
      }
    }
  }

  if (process.env.GEMINI_MODEL) return process.env.GEMINI_MODEL;

  const settingModel = await getSetting('GEMINI_MODEL');
  return settingModel || null;
}

async function callGemini(
  query: string,
  apiKey: string,
  type?: 'movie' | 'show',
  modelOverride?: string | null
): Promise<AISearchItem[]> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const modelName = (modelOverride || process.env.GEMINI_MODEL || 'gemini-flash-latest').replace(/^models\//, '');
  const model = genAI.getGenerativeModel({ model: modelName });

  const typeLine = type ? `Only return items of type '${type}'.` : 'Return both movies and shows only if clearly relevant.';
  const prompt = `You are a media search assistant. Convert the user query into a JSON array of up to 20 items with fields: type ('movie'|'show'), title, year (optional).
${typeLine}
Return ONLY valid JSON. No markdown.
Query: ${query}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  try {
    const parsed = JSON.parse(text) as AISearchItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && (item.type === 'movie' || item.type === 'show') && typeof item.title === 'string')
      .slice(0, 20);
  } catch (e) {
    logger.warn('Gemini returned non-JSON response', e);
    return [];
  }
}

export async function aiSearch(
  query: string,
  trakt: TraktClient,
  profileId?: string,
  type?: 'movie' | 'show'
) {
  const apiKey = await getGeminiKey(profileId);
  if (!apiKey) {
    return { results: [], usedAI: false };
  }

  try {
    const model = await getGeminiModel(profileId);
    const items = await callGemini(query, apiKey, type, model);
    const filtered = type ? items.filter((item) => item.type === type) : items;
    if (filtered.length === 0) {
      return { results: [], usedAI: true };
    }

    const searches = await Promise.all(
      filtered.map(async (item) => {
        const searchQuery = item.year ? `${item.title} ${item.year}` : item.title;
        const results = await trakt.search(searchQuery, item.type);
        return Array.isArray(results) ? results[0] : null;
      })
    );

    const deduped: TraktSearchResult[] = [];
    const seen = new Set<string>();

    for (const result of searches) {
      if (!result) continue;
      const typed = result as TraktSearchResult;
      const content = typed.movie || typed.show || typed;
      const ids = content?.ids;
      const key = ids?.trakt ? `trakt:${ids.trakt}` : ids?.imdb ? `imdb:${ids.imdb}` : ids?.tmdb ? `tmdb:${ids.tmdb}` : null;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      deduped.push(result);
    }

    return { results: deduped, usedAI: true };
  } catch (e) {
    logger.error('Gemini search failed', e);
    return { results: [], usedAI: false };
  }
}
