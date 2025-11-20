'use client';

import { useEffect, useState } from 'react';
import liff from '@line/liff';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ServerResponse =
  | {
      accountLinkUrl: string;
      expiresAt: string;
      friendFlag: boolean | null;
      friendCheckError?: string | null;
    }
  | { status: 'already_linked' }
  | { error: string };

export default function LiffLinkPage() {
  const [status, setStatus] = useState('LINEログインを確認しています…');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);
  const [friendHint, setFriendHint] = useState<string | null>(null);

  useEffect(() => {
    let aborted = false;

    const run = async () => {
      const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID;

      if (!liffId) {
        throw new Error('LIFF ID が設定されていません。');
      }

      await liff.init({ liffId });

      const tokens = getLiffTokens();
      if (!tokens) {
        // liff.login() がトリガーされた場合、この関数は redirect 後に再度実行される
        return;
      }

      const { idToken, accessToken } = tokens;

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
        if (data.friendFlag === false) {
          setFriendHint('まずは公式アカウントを友だち追加してください。');
        } else if (!data.friendFlag && data.friendCheckError) {
          setFriendHint(`友だち状態の確認に失敗しました (${data.friendCheckError})`);
        } else {
          setFriendHint(null);
        }
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
        {friendHint && !error && (
          <p className="text-sm text-muted-foreground">{friendHint}</p>
        )}
      </div>
      {isProcessing && !error && <Loader2 className="h-6 w-6 animate-spin text-primary" />}
      {error && (
        <div className="space-x-3">
          <Button variant="outline" onClick={() => window.location.reload()}>
            リトライ
          </Button>
          <Button onClick={() => (window.location.href = '/settings')}>設定に戻る</Button>
        </div>
      )}
    </div>
  );
}

function getLiffTokens() {
  const idToken = liff.getIDToken();
  const accessToken = liff.getAccessToken();

  if (idToken && accessToken) {
    return { idToken, accessToken };
  }

  if (!liff.isLoggedIn()) {
    liff.login();
    return null;
  }

  // ログイン済みだがトークンが未取得の場合は再初期化を促す
  throw new Error('LINEトークンを取得できませんでした。アプリを開き直してください。');
}
