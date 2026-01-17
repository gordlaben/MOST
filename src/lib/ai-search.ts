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

const geminiCooldownUntil: Record<string, number> = {};

function getCooldownKey(profileId?: string) {
  return profileId || 'global';
}

function parseRetryDelayMs(message?: string) {
  if (!message) return 60_000;
  const match = message.match(/retry\s+in\s+([0-9.]+)s/i);
  if (!match?.[1]) return 60_000;
  const seconds = Number(match[1]);
  return Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds * 1000) : 60_000;
}

function isRateLimitError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('429') || message.toLowerCase().includes('too many requests') || message.toLowerCase().includes('rate limit');
}

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
  modelOverride?: string | null,
  limit = 20
): Promise<AISearchItem[]> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const modelName = (modelOverride || process.env.GEMINI_MODEL || 'gemini-flash-latest').replace(/^models\//, '');
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: { responseMimeType: 'application/json' }
  });

  const clampedLimit = Math.max(1, Math.min(100, limit));
  const typeLine = type ? `Only return items of type '${type}'.` : 'Return both movies and shows only if clearly relevant.';
  const prompt = `You are a media search assistant. Convert the user query into a JSON array of up to ${clampedLimit} items with fields: type ('movie'|'show'), title, year (optional).
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
      .slice(0, clampedLimit);
  } catch (e) {
    try {
      const match = text.match(/\[[\s\S]*\]/);
      if (match?.[0]) {
        const recovered = JSON.parse(match[0]) as AISearchItem[];
        if (Array.isArray(recovered)) {
          return recovered
            .filter((item) => item && (item.type === 'movie' || item.type === 'show') && typeof item.title === 'string')
            .slice(0, clampedLimit);
        }
      }
    } catch {
      // ignore fallback parse errors
    }
    logger.warn('Gemini returned non-JSON response', e);
    return [];
  }
}

async function callGeminiListName(
  prompt: string,
  apiKey: string,
  modelOverride?: string | null,
  type?: 'movie' | 'show',
  size?: number
): Promise<string | null> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const modelName = (modelOverride || process.env.GEMINI_MODEL || 'gemini-flash-latest').replace(/^models\//, '');
  const model = genAI.getGenerativeModel({ model: modelName });

  const typeLabel = type ? (type === 'movie' ? 'movies' : 'series') : 'titles';
  const sizeLabel = size ? `${size} ${typeLabel}` : typeLabel;
  const namePrompt = `Create a short, catchy list name (max 60 characters) for a list of ${sizeLabel}.
Base it on this prompt: ${prompt}
Return ONLY the name as plain text. No quotes, no markdown.`;

  const result = await model.generateContent(namePrompt);
  const text = result.response.text().trim();
  if (!text) return null;
  return text.replace(/^"|"$/g, '').trim().slice(0, 60);
}

export async function aiSuggestListName(
  prompt: string,
  profileId?: string,
  type?: 'movie' | 'show',
  size?: number
) {
  const apiKey = await getGeminiKey(profileId);
  if (!apiKey) {
    return { name: null, usedAI: false };
  }

  try {
    const model = await getGeminiModel(profileId);
    const name = await callGeminiListName(prompt, apiKey, model, type, size);
    return { name, usedAI: true };
  } catch (e) {
    logger.error('Gemini list name failed', e);
    return { name: null, usedAI: false };
  }
}

export async function aiSearch(
  query: string,
  trakt: TraktClient,
  profileId?: string,
  type?: 'movie' | 'show',
  limit = 20
) {
  const apiKey = await getGeminiKey(profileId);
  if (!apiKey) {
    return { results: [], usedAI: false };
  }

  const cooldownKey = getCooldownKey(profileId);
  const cooldownUntil = geminiCooldownUntil[cooldownKey];
  if (cooldownUntil && Date.now() < cooldownUntil) {
    return { results: [], usedAI: false };
  }

  try {
    const model = await getGeminiModel(profileId);
    const items = await callGemini(query, apiKey, type, model, limit);
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
    if (isRateLimitError(e)) {
      const message = e instanceof Error ? e.message : String(e);
      const retryMs = parseRetryDelayMs(message);
      geminiCooldownUntil[cooldownKey] = Date.now() + retryMs;
      logger.warn('Gemini rate limited; falling back to Trakt search', { retryMs });
      return { results: [], usedAI: false };
    }
    logger.error('Gemini search failed', e);
    return { results: [], usedAI: false };
  }
}
