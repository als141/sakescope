import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sakescope - AI日本酒ソムリエ",
  description: "AIとの音声対話を通じて、あなたにぴったりの日本酒を見つけましょう。最高の一杯との出会いをお手伝いします。",
  keywords: "日本酒, AI, ソムリエ, 音声対話, 推薦, sake, recommendation",
  openGraph: {
    title: "Sakescope - AI日本酒ソムリエ",
    description: "AIとの音声対話を通じて、あなたにぴったりの日本酒を見つけましょう",
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
    <html lang="ja">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Noto+Sans+JP:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
