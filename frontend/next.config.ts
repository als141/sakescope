import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ec-hakkaisan.com',
      },
      {
        protocol: 'https',
        hostname: '**.rakuten.co.jp',
      },
      {
        protocol: 'https',
        hostname: '**.amazon.co.jp',
      },
      {
        protocol: 'https',
        hostname: '**.kurand.jp',
      },
      {
        protocol: 'https',
        hostname: '**.sake-times.com',
      },
      {
        protocol: 'https',
        hostname: '**.sakagura.net',
      },
      // 一般的な画像ホスティングサービス
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'cdn.jsdelivr.net',
      },
    ],
  },
};

export default nextConfig;
