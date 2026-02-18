import { describe, expect, it, vi } from 'vitest';
import { logRouteError } from '@/lib/route-error';

describe('route error logging', () => {
  it('logs error message with route context', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    logRouteError('api/test', 'Something failed', new Error('boom'), { id: '123' });

    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('does not throw on unserializable context', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const circular: { self?: unknown } = {};
    circular.self = circular;

    expect(() => logRouteError('api/test', 'Failed', new Error('boom'), circular as Record<string, unknown>)).not.toThrow();

    spy.mockRestore();
  });
});
