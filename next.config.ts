import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Allow images from external domains if needed
  images: {
    remotePatterns: [],
  },
  // Headers for API routes to enable caching signals
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 's-maxage=300, stale-while-revalidate=600' },
        ],
      },
    ];
  },
};

export default nextConfig;
