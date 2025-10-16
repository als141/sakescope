import type { Metadata } from "next";
import { Inter, Noto_Sans_JP } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  variable: "--font-inter",
});

const notoSansJp = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  variable: "--font-noto-sans-jp",
});

export const metadata: Metadata = {
  title: "Sakescope - AI日本酒ソムリエ",
  description:
    "AIとの音声対話を通じて、あなたにぴったりの日本酒を見つけましょう。最高の一杯との出会いをお手伝いします。",
  keywords:
    "日本酒, AI, ソムリエ, 音声対話, 推薦, sake, recommendation",
  openGraph: {
    title: "Sakescope - AI日本酒ソムリエ",
    description:
      "AIとの音声対話を通じて、あなたにぴったりの日本酒を見つけましょう",
    type: "website",
    locale: "ja_JP",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="dark">
      <body
        className={`${inter.variable} ${notoSansJp.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
