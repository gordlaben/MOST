import { prisma } from '@/lib/db';

const SYSTEM_CACHE_KEYS = ['binge-ready-shows', 'episodes-left-shows'] as const;

type CachedShowEntry = {
  show?: {
    ids?: {
      slug?: string;
    };
  };
};

export async function removeShowSlugFromSystemCaches(showId: string) {
  for (const key of SYSTEM_CACHE_KEYS) {
    const cached = await prisma.calendarCache.findUnique({
      where: { id: key },
    });

    if (!cached) continue;

    try {
      const shows = JSON.parse(cached.data) as CachedShowEntry[];
      const updatedShows = shows.filter((entry) => entry.show?.ids?.slug !== showId);

      await prisma.calendarCache.update({
        where: { id: key },
        data: { data: JSON.stringify(updatedShows) },
      });
    } catch {
      await prisma.calendarCache.delete({
        where: { id: key }
      }).catch(() => {});
    }
  }
}
