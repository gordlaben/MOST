
import { NextResponse } from 'next/server';
import { refreshCatalog, detectAndUpdateListTypes, CatalogFilters } from '@/lib/catalog';
import { getProfile } from '@/lib/settings';

interface SelectedList {
  id: string;
  name: string;
  owner?: string;
}

export async function POST(request: Request) {
  try {
    const { profileId } = await request.json();

    if (!profileId) {
      return NextResponse.json({ error: 'Profile ID is required' }, { status: 400 });
    }

    const profile = await getProfile(profileId);
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // 1. Update List Types (Force Check)
    // This ensures that if a movie list became mixed (user added a show), we detect it now.
    if (profile.selectedLists) {
         try {
             // We can run this in background or await it. 
             // Since it's a manual "Refresh" action, waiting is safer so the UI updates correctly afterwards.
             // We use JSON.parse so we pass an array of objects.
             await detectAndUpdateListTypes(profileId, JSON.parse(profile.selectedLists), true);
         } catch (e) {
             console.error('Failed to update list types during refresh', e);
         }
    }

    let filters: CatalogFilters = {
        includeEnded: true,
        includeCanceled: true,
        includeReturning: true,
        sortBy: 'newest'
    };

    if (profile.filters) {
       filters = { ...filters, ...JSON.parse(profile.filters) };
    }

    // Always include system lists
    const listsToRefresh = [
        { id: 'binge_ready', name: 'Binge Ready' },
        { id: 'episodes_left', name: 'Episodes Left' }
    ];

    if (profile.selectedLists) {
        const customLists = JSON.parse(profile.selectedLists) as SelectedList[];
        listsToRefresh.push(...customLists.filter(l => l.id !== 'binge_ready' && l.id !== 'episodes_left'));
    }

    // Trigger refreshes in parallel but don't wait for them all if it takes too long?
    // User wants a progress bar, so we should probably wait or use SSE.
    // For MVP, await Promise.all is safest to ensure "Done" really means Done.
    
    const refreshPromises = listsToRefresh.map(async (list) => {
        let baseKey = '';
        if (list.id === 'binge_ready') {
            baseKey = 'binge-ready-shows';
        } else if (list.id === 'episodes_left') {
            baseKey = 'episodes-left-shows';
        } else {
            baseKey = `list-${list.id}`;
        }
    
        const cacheKey = `${baseKey}-${profileId}-${JSON.stringify(filters)}`;
        
        let username: string | undefined = undefined;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((list as any).owner) username = (list as any).owner;

        await refreshCatalog(list.id, cacheKey, filters, profileId, username);
        return list.name;
    });

    await Promise.all(refreshPromises);

    return NextResponse.json({ success: true, count: listsToRefresh.length });

  } catch (error) {
    console.error('Manual refresh failed:', error);
    return NextResponse.json({ error: 'Refresh failed' }, { status: 500 });
  }
}
