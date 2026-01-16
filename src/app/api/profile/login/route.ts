import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyPassword, createSessionToken } from '@/lib/auth';
import { z } from 'zod';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const bodySchema = z.object({
      id: z.string().min(1),
      password: z.string().min(1)
    });

    const parsedBody = bodySchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { id, password } = parsedBody.data;

    if (!id || !password) {
      return NextResponse.json({ error: 'ID and password are required' }, { status: 400 });
    }

    const profile = await prisma.profile.findUnique({ where: { id } });

    if (!profile || !(await verifyPassword(password, profile.password))) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = await createSessionToken(profile.id);

    return NextResponse.json({ token });
  } catch (error) {
    console.error('Error logging in:', error);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
