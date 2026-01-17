import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import packageJson from '../../../../../package.json';
import { logger } from '@/lib/logger';
import { detectAndUpdateListTypes } from '@/lib/catalog';
import { getAppConfig } from '@/lib/config';

interface SelectedList {
    id: string;
    name: string;
    enabled: boolean;
    type?: string;
    content_type?: string;
    owner?: string;
}

interface CatalogDefinition {
  type: 'series' | 'movie';
  id: string;
  name: string;
  extra?: Array<{ name: string; options?: string[]; isRequired?: boolean }>;
}


export async function GET(request: Request, { params }: { params: Promise<{ profileId: string }> }) {
  // We need to await params to satisfy Next.js 15+ dynamic route requirements
  const { profileId } = await params;

  logger.info(`Stremio Manifest Request | Profile: ${profileId}`);

  const profile = await prisma.profile.findUnique({
    where: { id: profileId }
  });

  // Use package version to match the build
  const version = packageJson.version;
  
  const host = request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  const { appUrl } = getAppConfig();
  const origin = appUrl || (host ? `${proto}://${host}` : new URL(request.url).origin);

  const defaultSystemLists: CatalogDefinition[] = [
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

  let catalogs: CatalogDefinition[] = [];

  const sortExtra = {
      name: "sort",
      options: ["newest", "oldest", "title", "title_z_a", "rating_desc", "rating_asc", "random"],
      isRequired: false
  };

  if (profile?.selectedLists) {
    try {
      const selectedLists = JSON.parse(profile.selectedLists) as SelectedList[];
      
      // Check if any list needs update (missing content_type)
      const needsUpdate = selectedLists.some((l) => l.type !== 'system' && !l.content_type);
      
      if (needsUpdate) {
          // Trigger background update
          detectAndUpdateListTypes(profileId, selectedLists).catch(e => logger.error('Background list type detection failed', e));
      }

      const hasSystemLists = selectedLists.some((l) => l.type === 'system');

      if (hasSystemLists) {
        selectedLists.forEach((list) => {
          if (list.enabled) {
            if (list.type === 'system') {
                catalogs.push({
                    type: "series",
                    id: list.id,
                    name: list.name,
                    extra: [sortExtra]
                });
            } else {
                // For Trakt lists, we support both series and movies depending on content
                const isWatchlist = list.id === 'watchlist';
                const contentType = isWatchlist ? 'mixed' : (list.content_type || 'mixed');
                const shouldSplit = contentType === 'mixed';
                
                if (isWatchlist) {
                  if (contentType === 'movie' || contentType === 'mixed') {
                    catalogs.push({
                      type: "movie",
                      id: list.id,
                      name: list.name,
                      extra: [sortExtra]
                    });
                  }
                  if (contentType === 'series' || contentType === 'mixed') {
                    catalogs.push({
                      type: "series",
                      id: list.id,
                      name: list.name,
                      extra: [sortExtra]
                    });
                  }
                } else {
                  if (contentType === 'series' || contentType === 'mixed') {
                    catalogs.push({
                      type: "series",
                      id: list.id,
                      name: shouldSplit ? `${list.name} (Series)` : list.name,
                      extra: [sortExtra]
                    });
                  }
                  
                  if (contentType === 'movie' || contentType === 'mixed') {
                    catalogs.push({
                      type: "movie",
                      id: list.id,
                      name: shouldSplit ? `${list.name} (Movies)` : list.name,
                      extra: [sortExtra]
                    });
                  }
                }
            }
          }
        });
      } else {
        catalogs = [...defaultSystemLists.map(l => ({ ...l, extra: [sortExtra] }))];
        selectedLists.forEach((list: SelectedList) => {
          if (list.enabled) {
            const isWatchlist = list.id === 'watchlist';
            const contentType = isWatchlist ? 'mixed' : (list.content_type || 'mixed');
            const shouldSplit = contentType === 'mixed';
            
            if (isWatchlist) {
              if (contentType === 'movie' || contentType === 'mixed') {
                catalogs.push({
                  type: "movie",
                  id: list.id,
                  name: list.name,
                  extra: [sortExtra]
                });
              }

              if (contentType === 'series' || contentType === 'mixed') {
                catalogs.push({
                  type: "series",
                  id: list.id,
                  name: list.name,
                  extra: [sortExtra]
                });
              }
            } else {
              if (contentType === 'series' || contentType === 'mixed') {
                catalogs.push({
                  type: "series",
                  id: list.id,
                  name: shouldSplit ? `${list.name} (Series)` : list.name,
                  extra: [sortExtra]
                });
              }

              if (contentType === 'movie' || contentType === 'mixed') {
                catalogs.push({
                  type: "movie",
                  id: list.id,
                  name: shouldSplit ? `${list.name} (Movies)` : list.name,
                  extra: [sortExtra]
                });
              }
            }
          }
        });
      }
    } catch {
      catalogs = [...defaultSystemLists.map(l => ({ ...l, extra: [sortExtra] }))];
    }
  } else {
    catalogs = [...defaultSystemLists.map(l => ({ ...l, extra: [sortExtra] }))];
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
