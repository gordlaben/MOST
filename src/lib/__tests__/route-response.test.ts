import { describe, expect, it, vi } from 'vitest';
import { finalizeApiResponse } from '@/lib/route-response';

describe('route response helper', () => {
  it('appends timing metric and ends request context', () => {
    const response = new Response('ok', { status: 200 });
    const appendTo = vi.fn((res: Response, metricName?: string) => {
      res.headers.set('Server-Timing', `${metricName};dur=1`);
    });
    const end = vi.fn();

    const finalized = finalizeApiResponse(response, {
      ctx: { end } as unknown as { end: (status?: number) => void },
      timing: { appendTo },
      metricName: 'unit_test',
    });

    expect(finalized).toBe(response);
    expect(appendTo).toHaveBeenCalledWith(response, 'unit_test');
    expect(response.headers.get('Server-Timing')).toContain('unit_test');
    expect(end).toHaveBeenCalledWith(200);
  });

  it('works without timing object', () => {
    const response = new Response(null, { status: 204 });
    const end = vi.fn();

    finalizeApiResponse(response, {
      ctx: { end } as unknown as { end: (status?: number) => void },
    });

    expect(end).toHaveBeenCalledWith(204);
  });
});
