import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyPassword, createSessionToken } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { id, password } = await request.json();

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
