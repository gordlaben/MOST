import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import packageJson from '../../../../../package.json';
import { TraktClient } from '@/lib/trakt';
import { getTraktCredentials } from '@/lib/settings';
import { logger } from '@/lib/logger';

interface SelectedList {
    id: string;
    name: string;
    enabled: boolean;
    type?: string;
    content_type?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function detectAndUpdateListTypes(profileId: string, lists: any[]) {
  let updated = false;
  try {
    const { clientId, clientSecret, accessToken } = await getTraktCredentials(profileId);
    
    if (!accessToken || !clientId || !clientSecret) return;

    const trakt = new TraktClient(clientId, clientSecret, '', accessToken);

    for (const list of lists) {
        if (list.type !== 'system' && !list.content_type) {
             try {
                 const listOwner = list.type === 'custom' ? list.owner : undefined;
                 
                 const items = await trakt.getListItems(list.id, listOwner);
                 
                 let hasMovies = false;
                 let hasShows = false;

                 for (const item of items) {
                    if (item.movie) hasMovies = true;
                    if (item.show) hasShows = true;
                    if (hasMovies && hasShows) break;
                 }

                 let contentType = 'mixed';
                 if (hasMovies && !hasShows) contentType = 'movie';
                 if (!hasMovies && hasShows) contentType = 'series';
                 
                 list.content_type = contentType;
                 updated = true;
                 logger.info(`Detected type ${contentType} for list ${list.name} (${list.id})`);

             } catch (e) {
                 logger.error(`Failed to detect type for list ${list.id}`, e);
             }
        }
    }

    if (updated) {
        await prisma.profile.update({
            where: { id: profileId },
            data: { selectedLists: JSON.stringify(lists) }
        });
        logger.info(`Updated profile ${profileId} with detected list types`);
    }
  } catch (e) {
    logger.error('Error in detectAndUpdateListTypes', e);
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ profileId: string }> }) {
  // We need to await params to satisfy Next.js 15+ dynamic route requirements
  const { profileId } = await params;

  const profile = await prisma.profile.findUnique({
    where: { id: profileId }
  });

  // Use package version to match the build
  const version = packageJson.version;
  
  const host = request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  const origin = process.env.APP_URL || (host ? `${proto}://${host}` : new URL(request.url).origin);

  const defaultSystemLists = [
    {
      type: "series",
      id: "binge_ready",
      name: "Binge Ready"
    },
    {
      type: "series",
      id: "episodes_left",
      name: "Episodes Left"
    }
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let catalogs: any[] = [];

  if (profile?.selectedLists) {
    try {
      const selectedLists = JSON.parse(profile.selectedLists);
      
      // Check if any list needs update (missing content_type)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const needsUpdate = selectedLists.some((l: any) => l.type !== 'system' && !l.content_type);
      
      if (needsUpdate) {
          // Trigger background update
          detectAndUpdateListTypes(profileId, JSON.parse(profile.selectedLists)).catch(e => logger.error('Background list type detection failed', e));
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hasSystemLists = selectedLists.some((l: any) => l.type === 'system');

      if (hasSystemLists) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        selectedLists.forEach((list: any) => {
          if (list.enabled) {
            if (list.type === 'system') {
                catalogs.push({
                    type: "series",
                    id: list.id,
                    name: list.name
                });
            } else {
                // For Trakt lists, we support both series and movies depending on content
                const contentType = list.content_type || 'mixed';
                
                if (contentType === 'series' || contentType === 'mixed') {
                    catalogs.push({
                        type: "series",
                        id: list.id,
                        name: list.name
                    });
                }
                
                if (contentType === 'movie' || contentType === 'mixed') {
                    catalogs.push({
                        type: "movie",
                        id: list.id,
                        name: list.name
                    });
                }
            }
          }
        });
      } else {
        catalogs = [...defaultSystemLists];
        selectedLists.forEach((list: SelectedList) => {
          if (list.enabled) {
            catalogs.push({
                type: "series",
                id: list.id,
                name: list.name
            });
            catalogs.push({
                type: "movie",
                id: list.id,
                name: list.name
            });
          }
        });
      }
    } catch {
      catalogs = [...defaultSystemLists];
    }
  } else {
    catalogs = [...defaultSystemLists];
  }

  // Add search catalog
  catalogs.push({
    type: "series",
    id: "most_search",
    name: "Most Search",
    extra: [{ name: "search", isRequired: true }]
  });
  catalogs.push({
    type: "movie",
    id: "most_search",
    name: "Most Search",
    extra: [{ name: "search", isRequired: true }]
  });

  const manifest = {
    id: `com.gordlaben.most.${profileId}`,
    version: version,
    name: "Most",
    description: "Most tracks your Trakt watch history and organizes shows into two lists: 'Binge Ready' (fully aired seasons ready to watch) and 'Episodes Left' (shows in progress). Never get stuck waiting for the next episode again!",
    logo: `${origin}/logo.png`,
    resources: ["catalog", "meta"],
    types: ["series", "movie"],
    catalogs: catalogs,
    idPrefixes: ["tt", "trakt", "most"],
    behaviorHints: {
      configurable: true,
      configurationRequired: false
    }
  };

  return NextResponse.json(manifest, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' // Disable caching to ensure updates are seen immediately
    }
  });
}
