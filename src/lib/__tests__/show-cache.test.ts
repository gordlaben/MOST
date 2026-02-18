import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findUnique, update, remove } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    calendarCache: {
      findUnique,
      update,
      delete: remove,
    },
  },
}));

import { removeShowSlugFromSystemCaches } from '@/lib/show-cache';

describe('show cache helper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('removes matching show slug from both system cache entries', async () => {
    findUnique
      .mockResolvedValueOnce({ data: JSON.stringify([{ show: { ids: { slug: 'keep' } } }, { show: { ids: { slug: 'target' } } }]) })
      .mockResolvedValueOnce({ data: JSON.stringify([{ show: { ids: { slug: 'target' } } }, { show: { ids: { slug: 'keep2' } } }]) });

    await removeShowSlugFromSystemCaches('target');

    expect(update).toHaveBeenCalledTimes(2);
    const firstPayload = JSON.parse(update.mock.calls[0][0].data.data);
    const secondPayload = JSON.parse(update.mock.calls[1][0].data.data);
    expect(firstPayload).toEqual([{ show: { ids: { slug: 'keep' } } }]);
    expect(secondPayload).toEqual([{ show: { ids: { slug: 'keep2' } } }]);
  });

  it('deletes cache entry when parsing fails', async () => {
    findUnique
      .mockResolvedValueOnce({ data: 'not-json' })
      .mockResolvedValueOnce(null);

    remove.mockResolvedValueOnce({});

    await removeShowSlugFromSystemCaches('target');

    expect(remove).toHaveBeenCalledTimes(1);
    expect(update).not.toHaveBeenCalled();
  });
});
