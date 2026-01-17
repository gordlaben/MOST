import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSetting } from '@/lib/settings';
import { logger } from '@/lib/logger';

async function getApiKey(profileId?: string | null): Promise<string | null> {
  if (profileId) {
    const profile = (await prisma.profile.findUnique({ where: { id: profileId } })) as
      | { geminiKey?: string | null }
      | null;
    if (profile?.geminiKey) return profile.geminiKey;
  }

  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;

  const settingKey = await getSetting('GEMINI_API_KEY');
  return settingKey || null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const profileId = searchParams.get('profileId');

  try {
    const apiKey = await getApiKey(profileId);
    if (!apiKey) {
      return NextResponse.json({ models: [], error: 'Missing GEMINI_API_KEY' }, { status: 400 });
    }

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (!res.ok) {
      const text = await res.text();
      logger.error('Gemini models list failed', { status: res.status, text });
      return NextResponse.json({ models: [], error: 'Failed to load models' }, { status: 502 });
    }

    const data = (await res.json()) as { models?: Array<{ name?: string; supportedGenerationMethods?: string[] }> };
    const models = (data.models || [])
      .filter((model) => (model.supportedGenerationMethods || []).includes('generateContent'))
      .map((model) => ({
        name: (model.name || '').replace(/^models\//, ''),
        fullName: model.name || ''
      }))
      .filter((model) => model.name);

    return NextResponse.json({ models });
  } catch (error) {
    logger.error('Gemini models list error', error);
    return NextResponse.json({ models: [], error: 'Failed to load models' }, { status: 500 });
  }
}
