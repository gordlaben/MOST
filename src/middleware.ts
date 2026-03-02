import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  // Add Cache-Control: no-store to auth and admin API responses
  if (pathname.startsWith('/api/admin') || pathname.startsWith('/api/auth') || pathname.startsWith('/api/profile')) {
    response.headers.set('Cache-Control', 'no-store, max-age=0');
  }

  return response;
}

export const config = {
  matcher: ['/api/:path*'],
};
