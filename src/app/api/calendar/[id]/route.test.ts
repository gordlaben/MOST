import { describe, expect, it } from 'vitest';
import { GET } from './route';
import { NextRequest } from 'next/server';

describe('api/calendar/[id] GET validation', () => {
  it('returns 400 for invalid force query value', async () => {
    const request = new NextRequest('http://localhost:3000/api/calendar/test-id?force=maybe');

    const response = await GET(request, {
      params: Promise.resolve({ id: 'test-id' }),
    });

    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid query parameters');
  });
});
