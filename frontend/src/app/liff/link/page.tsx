'use client';

import { useEffect, useState } from 'react';
import liff from '@line/liff';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ServerResponse =
  | { accountLinkUrl: string; expiresAt: string }
  | { status: 'already_linked' }
  | { error: string };

export default function LiffLinkPage() {
  const [status, setStatus] = useState('LINEログインを確認しています…');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    let aborted = false;

    const run = async () => {
      const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID;

      if (!liffId) {
        throw new Error('LIFF ID が設定されていません。');
      }

      await liff.init({ liffId });

      if (!liff.isLoggedIn()) {
        liff.login();
        return;
      }

      const idToken = liff.getIDToken();
      const accessToken = liff.getAccessToken();

      if (!idToken || !accessToken) {
        throw new Error('LINEアカウント情報の取得に失敗しました。');
      }

      setStatus('LINEアカウントを検証しています…');
      const response = await fetch('/api/line/liff-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, accessToken }),
      });

      const data: ServerResponse = await response.json().catch(() => ({ error: 'サーバーエラーが発生しました。' }));

      if (!response.ok) {
        throw new Error('error' in data ? data.error : 'LINE連携に失敗しました。');
      }

      if ('status' in data && data.status === 'already_linked') {
        setStatus('すでにLINEアカウントと連携済みです。');
        setIsProcessing(false);
        return;
      }

      if ('accountLinkUrl' in data) {
        setStatus('LINEアカウント連携を完了してください…');
        window.location.href = data.accountLinkUrl;
        return;
      }

      throw new Error('LINE連携URLの取得に失敗しました。');
    };

    run().catch((err) => {
      if (aborted) return;
      console.error('LIFF link flow failed', err);
      setError(err instanceof Error ? err.message : '予期しないエラーが発生しました。');
      setIsProcessing(false);
    });

    return () => {
      aborted = true;
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 text-center gap-6">
      <div className="space-y-3">
        <p className="text-lg font-semibold">{status}</p>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      {isProcessing && !error && <Loader2 className="h-6 w-6 animate-spin text-primary" />}
      {error && (
        <div className="space-x-3">
          <Button variant="outline" onClick={() => window.location.reload()}>
            リトライ
          </Button>
          <Button onClick={() => (window.location.href = '/settings/line')}>設定に戻る</Button>
        </div>
      )}
    </div>
  );
}
