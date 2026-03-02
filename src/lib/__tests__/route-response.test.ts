import { describe, expect, it, vi } from 'vitest';
import { finalizeApiResponse } from '@/lib/route-response';
import type { RequestContext } from '@/lib/request-logging';

function mockCtx(): RequestContext {
  return { requestId: 'test', startTime: Date.now(), log: vi.fn(), end: vi.fn() } as unknown as RequestContext;
}

describe('route response helper', () => {
  it('appends timing metric and ends request context', () => {
    const response = new Response('ok', { status: 200 });
    const appendTo = vi.fn((res: Response, metricName?: string) => {
      res.headers.set('Server-Timing', `${metricName};dur=1`);
    });
    const ctx = mockCtx();

    const finalized = finalizeApiResponse(response, {
      ctx,
      timing: { appendTo },
      metricName: 'unit_test',
    });

    expect(finalized).toBe(response);
    expect(appendTo).toHaveBeenCalledWith(response, 'unit_test');
    expect(response.headers.get('Server-Timing')).toContain('unit_test');
    expect(ctx.end).toHaveBeenCalledWith(200);
  });

  it('works without timing object', () => {
    const response = new Response(null, { status: 204 });
    const ctx = mockCtx();

    finalizeApiResponse(response, { ctx });

    expect(ctx.end).toHaveBeenCalledWith(204);
  });
});
