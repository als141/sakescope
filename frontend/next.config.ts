import type { NextConfig } from "next";

const EMBED_PARENT_SITES = [
  "'self'",
  'https://sakescope.vercel.app',
  'http://localhost:3000',
  'https://capable-panda-53.accounts.dev',
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' },
    ],
  },
  async headers() {
    return [
      {
        source: '/embed',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: `frame-ancestors ${EMBED_PARENT_SITES.join(' ')};`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
