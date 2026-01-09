import { NextResponse } from 'next/server';
import { getSetting, setSetting, getTraktCredentials } from '@/lib/settings';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const profileId = searchParams.get('profileId') || undefined;

  const { clientId, clientSecret, accessToken } = await getTraktCredentials(profileId);
  
  let rpdbKey = (await getSetting('RPDB_API_KEY')) || 't0-free-rpdb';
  let includeEnded = (await getSetting('FILTER_INCLUDE_ENDED')) !== 'false';
  let includeCanceled = (await getSetting('FILTER_INCLUDE_CANCELED')) !== 'false';
  let includeReturning = (await getSetting('FILTER_INCLUDE_RETURNING')) !== 'false';
  let sortBy = (await getSetting('FILTER_SORT_BY')) || 'newest';
  let sortPreferences: Record<string, string> = {};
  let selectedLists: unknown[] = [];

  if (profileId) {
    const profile = await prisma.profile.findUnique({ where: { id: profileId } });
    if (profile) {
      if (profile.rpdbKey) rpdbKey = profile.rpdbKey;
      if (profile.filters) {
        const filters = JSON.parse(profile.filters);
        includeEnded = filters.includeEnded;
        includeCanceled = filters.includeCanceled;
        includeReturning = filters.includeReturning;
        sortBy = filters.sortBy || 'newest';
        sortPreferences = filters.sortPreferences || {};
      }
      if (profile.selectedLists) {
        selectedLists = JSON.parse(profile.selectedLists);
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
    filters: {
      includeEnded,
      includeCanceled,
      includeReturning,
      sortBy,
      sortPreferences
    },
    selectedLists
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { 
      profileId, 
      rpdbKey, 
      filters, 
      selectedLists, 
      FILTER_INCLUDE_ENDED, 
      FILTER_INCLUDE_CANCELED, 
      FILTER_INCLUDE_RETURNING, 
      FILTER_SORT_BY,
      listId 
  } = body;

  // Note: Trakt Client ID and Secret are no longer saved via API.
  // They must be set via environment variables.

  if (profileId) {
    // Update Profile
    const profile = await prisma.profile.findUnique({ where: { id: profileId } });
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const updateData: { rpdbKey?: string; selectedLists?: string; filters?: string } = {};
    if (rpdbKey !== undefined) updateData.rpdbKey = rpdbKey;
    if (selectedLists !== undefined) updateData.selectedLists = JSON.stringify(selectedLists);

    // Merge filters
    let currentFilters = profile.filters ? JSON.parse(profile.filters) : {};
    
    if (filters) {
      currentFilters = { ...currentFilters, ...filters };
    }
    
    if (FILTER_INCLUDE_ENDED !== undefined) currentFilters.includeEnded = FILTER_INCLUDE_ENDED === 'true';
    if (FILTER_INCLUDE_CANCELED !== undefined) currentFilters.includeCanceled = FILTER_INCLUDE_CANCELED === 'true';
    if (FILTER_INCLUDE_RETURNING !== undefined) currentFilters.includeReturning = FILTER_INCLUDE_RETURNING === 'true';
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

    updateData.filters = JSON.stringify(currentFilters);

    await prisma.profile.update({
      where: { id: profileId },
      data: updateData
    });

  } else {
    // Update Global Settings
    if (rpdbKey !== undefined) await setSetting('RPDB_API_KEY', rpdbKey);

    // Handle nested filters object
    if (filters) {
      if (filters.includeEnded !== undefined) await setSetting('FILTER_INCLUDE_ENDED', String(filters.includeEnded));
      if (filters.includeCanceled !== undefined) await setSetting('FILTER_INCLUDE_CANCELED', String(filters.includeCanceled));
      if (filters.includeReturning !== undefined) await setSetting('FILTER_INCLUDE_RETURNING', String(filters.includeReturning));
      if (filters.sortBy !== undefined) await setSetting('FILTER_SORT_BY', filters.sortBy);
    }

    // Handle flat filter keys (sent from dashboard "Save as Default")
    if (FILTER_INCLUDE_ENDED !== undefined) await setSetting('FILTER_INCLUDE_ENDED', String(FILTER_INCLUDE_ENDED));
    if (FILTER_INCLUDE_CANCELED !== undefined) await setSetting('FILTER_INCLUDE_CANCELED', String(FILTER_INCLUDE_CANCELED));
    if (FILTER_INCLUDE_RETURNING !== undefined) await setSetting('FILTER_INCLUDE_RETURNING', String(FILTER_INCLUDE_RETURNING));
    
    if (FILTER_SORT_BY !== undefined && !listId) await setSetting('FILTER_SORT_BY', FILTER_SORT_BY);
  }

  return NextResponse.json({ success: true });
}
