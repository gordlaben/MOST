import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    localPatterns: [
      {
        pathname: '/api/image',
      },
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'assets.fanart.tv',
      },
      {
        protocol: 'https',
        hostname: 'walter.trakt.tv',
      },
      {
        protocol: 'https',
        hostname: 'walter-r2.trakt.tv',
      },
      {
        protocol: 'https',
        hostname: 'secure.gravatar.com',
      },
      {
        protocol: 'https',
        hostname: 'api.ratingposterdb.com',
      },
      {
        protocol: 'https',
        hostname: 'image.tmdb.org',
      },
      {
        protocol: 'https',
        hostname: 'thetvdb.com',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/((?!api|stremio).*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://api.trakt.tv; frame-src https://www.youtube.com https://youtube.com;" },
        ],
      },
    ];
  },
};

export default nextConfig;
