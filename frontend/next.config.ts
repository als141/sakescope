import type { NextConfig } from "next";

const EMBED_PARENT_SITES = [
  "'self'",
  'https://sakescope.vercel.app',
  'http://localhost:3000',
  'https://capable-panda-53.accounts.dev',
  'https://portfolio.atoriba.jp',
  'https://www.echigo.sake-harasho.com',
  'https://echigo.sake-harasho.com',
  'https://gigaplus.makeshop.jp',
  'https://sakescope.atoriba.jp',
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
