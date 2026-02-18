import { describe, expect, it } from 'vitest';
import { POST } from './route';

describe('api/settings POST validation', () => {
  it('returns 400 for invalid body shape', async () => {
    const request = new Request('http://localhost:3000/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filters: 'invalid' }),
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid request body');
  });
});
