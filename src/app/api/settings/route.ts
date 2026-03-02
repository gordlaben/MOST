import { NextResponse } from 'next/server';
import { getSetting, setSetting, getTraktCredentials } from '@/lib/settings';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { jsonError, jsonSuccess } from '@/lib/http-response';
import { parseAndValidateJson } from '@/lib/request-validation';
import { logger } from '@/lib/logger';

const filtersSchema = z.object({
  includeEnded: z.boolean().optional(),
  includeCanceled: z.boolean().optional(),
  includeReturning: z.boolean().optional(),
  sortBy: z.string().optional(),
  dateFormat: z.enum(['mdy', 'dmy', 'ymd']).optional(),
  geminiModel: z.string().optional(),
}).partial();

const settingsBodySchema = z.object({
  profileId: z.string().min(1).optional(),
  rpdbKey: z.string().optional(),
  geminiKey: z.string().optional(),
  filters: filtersSchema.optional(),
  selectedLists: z.array(z.unknown()).optional(),
  FILTER_INCLUDE_ENDED: z.union([z.string(), z.boolean()]).optional(),
  FILTER_INCLUDE_CANCELED: z.union([z.string(), z.boolean()]).optional(),
  FILTER_INCLUDE_RETURNING: z.union([z.string(), z.boolean()]).optional(),
  FILTER_SORT_BY: z.string().optional(),
  listId: z.string().optional(),
  DATE_FORMAT: z.enum(['mdy', 'dmy', 'ymd']).optional(),
  GEMINI_MODEL: z.string().optional(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const profileId = searchParams.get('profileId') || undefined;

  const { clientId, clientSecret, accessToken } = await getTraktCredentials(profileId);
  
  let rpdbKey = (await getSetting('RPDB_API_KEY')) || 't0-free-rpdb';
  let geminiKey = (await getSetting('GEMINI_API_KEY')) || '';
  let includeEnded = (await getSetting('FILTER_INCLUDE_ENDED')) !== 'false';
  let includeCanceled = (await getSetting('FILTER_INCLUDE_CANCELED')) !== 'false';
  let includeReturning = (await getSetting('FILTER_INCLUDE_RETURNING')) !== 'false';
  let sortBy = (await getSetting('FILTER_SORT_BY')) || 'newest';
  let sortPreferences: Record<string, string> = {};
  let dateFormat = (await getSetting('DATE_FORMAT')) || 'mdy';
  let geminiModel = (await getSetting('GEMINI_MODEL')) || '';
  let selectedLists: unknown[] = [];

  if (profileId) {
    const profile = await prisma.profile.findUnique({ where: { id: profileId } });
    if (profile) {
      if (profile.rpdbKey) rpdbKey = profile.rpdbKey;
      if (profile.geminiKey) geminiKey = profile.geminiKey;
      if (profile.filters) {
        try {
          const filters = JSON.parse(profile.filters);
          includeEnded = filters.includeEnded;
          includeCanceled = filters.includeCanceled;
          includeReturning = filters.includeReturning;
          sortBy = filters.sortBy || 'newest';
          sortPreferences = filters.sortPreferences || {};
          if (filters.dateFormat) dateFormat = filters.dateFormat;
          if (filters.geminiModel) geminiModel = filters.geminiModel;
        } catch (e) { logger.debug('Corrupt profile filters, using defaults', e); }
      }
      if (profile.selectedLists) {
        try {
          selectedLists = JSON.parse(profile.selectedLists);
        } catch (e) { logger.debug('Corrupt profile selectedLists, using defaults', e); }
      }
    }
  }

  // Security: Do NOT return sensitive credentials to the client
  // return NextResponse.json({ 
  //   clientId, 
  //   clientSecret, // REMOVED
  //   isConnected: !!accessToken,
  //   hasCredentials: !!(clientId && clientSecret),
  
  return NextResponse.json({ 
    clientId: clientId ? `${clientId.substring(0, 4)}...` : undefined, // Masked
    isConnected: !!accessToken,
    hasCredentials: !!(clientId && clientSecret),
    rpdbKey,
    geminiKey,
    filters: {
      includeEnded,
      includeCanceled,
      includeReturning,
      sortBy,
      sortPreferences,
      dateFormat,
      geminiModel
    },
    selectedLists
  });
}

export async function POST(request: Request) {
  const parsedBody = await parseAndValidateJson(request, settingsBodySchema);

  if (!parsedBody.success) {
    return parsedBody.errorResponse;
  }

  const { 
      profileId, 
      rpdbKey,
      geminiKey,
      filters, 
      selectedLists, 
      FILTER_INCLUDE_ENDED, 
      FILTER_INCLUDE_CANCELED, 
      FILTER_INCLUDE_RETURNING, 
      FILTER_SORT_BY,
        listId,
        DATE_FORMAT,
        GEMINI_MODEL
        } = parsedBody.data;

  // Note: Trakt Client ID and Secret are no longer saved via API.
  // They must be set via environment variables.

  if (profileId) {
    // Update Profile
    const profile = await prisma.profile.findUnique({ where: { id: profileId } });
    if (!profile) {
      return jsonError('Profile not found', 404);
    }

    const updateData: { rpdbKey?: string; geminiKey?: string; selectedLists?: string; filters?: string } = {};
    if (rpdbKey !== undefined) updateData.rpdbKey = rpdbKey;
    if (geminiKey !== undefined) updateData.geminiKey = geminiKey;
    if (selectedLists !== undefined) updateData.selectedLists = JSON.stringify(selectedLists);

    // Merge filters
    let currentFilters: Record<string, unknown> = {};
    if (profile.filters) {
      try { currentFilters = JSON.parse(profile.filters); } catch (e) { logger.debug('Corrupt filters during save, resetting', e); }
    }
    
    if (filters) {
      currentFilters = { ...currentFilters, ...filters };
    }
    
    if (FILTER_INCLUDE_ENDED !== undefined) currentFilters.includeEnded = String(FILTER_INCLUDE_ENDED) === 'true';
    if (FILTER_INCLUDE_CANCELED !== undefined) currentFilters.includeCanceled = String(FILTER_INCLUDE_CANCELED) === 'true';
    if (FILTER_INCLUDE_RETURNING !== undefined) currentFilters.includeReturning = String(FILTER_INCLUDE_RETURNING) === 'true';
    if (FILTER_SORT_BY !== undefined) {
        if (listId) {
            // Update specific list sort preference
            currentFilters.sortPreferences = {
                ...(currentFilters.sortPreferences || {}),
                [listId]: FILTER_SORT_BY
            };
        } else {
             // Update global default
             currentFilters.sortBy = FILTER_SORT_BY;
        }
    }

    if (DATE_FORMAT !== undefined) {
      currentFilters.dateFormat = DATE_FORMAT;
    }

    if (GEMINI_MODEL !== undefined) {
      currentFilters.geminiModel = GEMINI_MODEL;
    }

    updateData.filters = JSON.stringify(currentFilters);

    await prisma.profile.update({
      where: { id: profileId },
      data: updateData
    });

  } else {
    // Update Global Settings
    if (rpdbKey !== undefined) await setSetting('RPDB_API_KEY', rpdbKey);
    if (geminiKey !== undefined) await setSetting('GEMINI_API_KEY', geminiKey);

    // Handle nested filters object
    if (filters) {
      if (filters.includeEnded !== undefined) await setSetting('FILTER_INCLUDE_ENDED', String(filters.includeEnded));
      if (filters.includeCanceled !== undefined) await setSetting('FILTER_INCLUDE_CANCELED', String(filters.includeCanceled));
      if (filters.includeReturning !== undefined) await setSetting('FILTER_INCLUDE_RETURNING', String(filters.includeReturning));
      if (filters.sortBy !== undefined) await setSetting('FILTER_SORT_BY', filters.sortBy);
      if (filters.dateFormat !== undefined) await setSetting('DATE_FORMAT', filters.dateFormat);
      if (filters.geminiModel !== undefined) await setSetting('GEMINI_MODEL', filters.geminiModel);
    }

    // Handle flat filter keys (sent from dashboard "Save as Default")
    if (FILTER_INCLUDE_ENDED !== undefined) await setSetting('FILTER_INCLUDE_ENDED', String(FILTER_INCLUDE_ENDED));
    if (FILTER_INCLUDE_CANCELED !== undefined) await setSetting('FILTER_INCLUDE_CANCELED', String(FILTER_INCLUDE_CANCELED));
    if (FILTER_INCLUDE_RETURNING !== undefined) await setSetting('FILTER_INCLUDE_RETURNING', String(FILTER_INCLUDE_RETURNING));
    
    if (FILTER_SORT_BY !== undefined && !listId) await setSetting('FILTER_SORT_BY', FILTER_SORT_BY);
    if (DATE_FORMAT !== undefined) await setSetting('DATE_FORMAT', DATE_FORMAT);
    if (GEMINI_MODEL !== undefined) await setSetting('GEMINI_MODEL', GEMINI_MODEL);
  }

  return jsonSuccess({ success: true });
}
