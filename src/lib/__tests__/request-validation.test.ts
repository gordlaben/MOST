import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { parseAndValidateJson, validateQuery } from '@/lib/request-validation';

describe('request validation helper', () => {
  const schema = z.object({
    id: z.string().min(1),
  });

  it('parses and validates a valid JSON body', async () => {
    const request = new Request('http://localhost/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'abc' }),
    });

    const result = await parseAndValidateJson(request, schema);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ id: 'abc' });
    }
  });

  it('returns 400 for invalid JSON', async () => {
    const request = new Request('http://localhost/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{bad-json}',
    });

    const result = await parseAndValidateJson(request, schema);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorResponse.status).toBe(400);
      await expect(result.errorResponse.json()).resolves.toEqual({ error: 'Invalid request body' });
    }
  });

  it('returns 400 for schema validation failure', async () => {
    const request = new Request('http://localhost/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: '' }),
    });

    const result = await parseAndValidateJson(request, schema);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorResponse.status).toBe(400);
      await expect(result.errorResponse.json()).resolves.toEqual({ error: 'Invalid request body' });
    }
  });

  it('validates query payload with zod schema', async () => {
    const querySchema = z.object({
      profileId: z.string().min(1),
      query: z.string().optional(),
    });

    const result = validateQuery(querySchema, { profileId: 'p1', query: 'test' });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ profileId: 'p1', query: 'test' });
    }
  });

  it('returns 400 response for invalid query payload', async () => {
    const querySchema = z.object({
      profileId: z.string().min(1),
    });

    const result = validateQuery(querySchema, { profileId: '' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorResponse.status).toBe(400);
      await expect(result.errorResponse.json()).resolves.toEqual({ error: 'Invalid query parameters' });
    }
  });
});
