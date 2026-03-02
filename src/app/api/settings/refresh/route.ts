import { refreshCatalog, detectAndUpdateListTypes, CatalogFilters } from '@/lib/catalog';
import { getProfile } from '@/lib/settings';
import { jsonError, jsonSuccess } from '@/lib/http-response';
import { logRouteError } from '@/lib/route-error';
import { z } from 'zod';
import { parseAndValidateJson } from '@/lib/request-validation';

interface SelectedList {
  id: string;
  name: string;
  owner?: string;
}

const bodySchema = z.object({
  profileId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const parsed = await parseAndValidateJson(request, bodySchema);
    if (!parsed.success) return parsed.errorResponse;
    const { profileId } = parsed.data;

    const profile = await getProfile(profileId);
    if (!profile) {
      return jsonError('Profile not found', 404);
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
           logRouteError('api/settings/refresh', 'Failed to update list types during refresh', e, { profileId });
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

    return jsonSuccess({ success: true, count: listsToRefresh.length });

  } catch (error) {
    logRouteError('api/settings/refresh', 'Manual refresh failed', error);
    return jsonError('Refresh failed', 500);
  }
}
