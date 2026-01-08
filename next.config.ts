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
};

export default nextConfig;
