'use client';

import { useEffect, useState } from 'react';
import liff from '@line/liff';

export default function LiffGiftPage() {
  const [message, setMessage] = useState('LINEアプリを起動しています…');

  useEffect(() => {
    const bootstrap = async () => {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('t');

      if (!token) {
        setMessage('ギフトトークンが見つかりませんでした。');
        return;
      }

      const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID;

      if (!liffId) {
        setMessage('LIFF ID が設定されていません。管理者にお問い合わせください。');
        return;
      }

      await liff.init({ liffId });
      setMessage('ギフトページに移動しています…');

      const appUrl = process.env.NEXT_PUBLIC_APP_URL;
      const target = appUrl
        ? `${appUrl.replace(/\/$/, '')}/gift/${token}`
        : `${window.location.origin}/gift/${token}`;

      window.location.href = target;
    };

    bootstrap().catch((error) => {
      console.error('Failed to bootstrap LIFF gift page', error);
      setMessage('LIFFの初期化に失敗しました。時間をおいて再度お試しください。');
    });
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 text-center">
      <p className="text-base text-muted-foreground">{message}</p>
    </div>
  );
}
