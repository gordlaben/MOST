import { describe, expect, it } from 'vitest';
import { jsonError, jsonSuccess } from '@/lib/http-response';

describe('http response helpers', () => {
  it('creates a json error response', async () => {
    const response = jsonError('Bad request', 400);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: 'Bad request' });
  });

  it('creates a json success response with custom status', async () => {
    const response = jsonSuccess({ ok: true }, 201);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual({ ok: true });
  });
});
