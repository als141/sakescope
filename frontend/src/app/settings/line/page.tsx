'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, MessageSquare, PlugZap, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

type LineAccount = {
  line_user_id: string;
  display_name: string | null;
  friend_flag: boolean | null;
  linked_at: string;
};

type PendingLink = {
  nonce: string;
  expires_at: string;
};

type LinkStatusResponse = {
  account: LineAccount | null;
  pending: PendingLink | null;
  error?: string;
};

const addFriendUrl = process.env.NEXT_PUBLIC_LINE_ADD_FRIEND_URL || '';
const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID || '';

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

export default function LineSettingsPage() {
  const [status, setStatus] = useState<LinkStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/line/link-status', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('LINE連携状況の取得に失敗しました。');
      }
      const data = (await response.json()) as LinkStatusResponse;
      setStatus(data);
    } catch (err) {
      console.error('Failed to fetch LINE link status', err);
      setError(err instanceof Error ? err.message : '情報の取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  const linked = Boolean(status?.account);
  const friendOk = status?.account?.friend_flag ?? false;
  const deepLink = useMemo(() => {
    if (!liffId) return '';
    return `https://liff.line.me/${liffId}?scene=link`;
  }, []);

  return (
    <div className="min-h-screen bg-background px-6 py-10">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <Link href="/settings">
            <Button variant="ghost" className="group">
              <ArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform" />
              設定に戻る
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={() => fetchStatus()}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            再読み込み
          </Button>
        </div>

        <div className="space-y-4">
          <h1 className="text-3xl font-bold tracking-tight">LINE連携</h1>
          <p className="text-muted-foreground">
            送り主アカウントとLINEを連携して、推薦完了のプッシュ通知をLINEで受け取れるようにします。
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>連携ステータス</CardTitle>
            <CardDescription>現在のLINEアカウント連携状況を表示します。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading && (
              <div className="flex items-center gap-3 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                状態を読み込んでいます…
              </div>
            )}

            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

            {!loading && !error && (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant={linked ? 'default' : 'outline'} className="text-sm">
                    {linked ? '連携済み' : '未連携'}
                  </Badge>
                  <Badge variant={friendOk ? 'default' : 'secondary'}>
                    {friendOk ? '友だち済み' : '友だち登録が必要'}
                  </Badge>
                </div>
                {status?.account ? (
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>LINE表示名: {status.account.display_name ?? '未取得'}</p>
                    <p>LINE userId: {status.account.line_user_id}</p>
                    <p>連携日時: {formatDate(status.account.linked_at)}</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    まだLINEアカウントとの連携が完了していません。以下の手順で設定してください。
                  </p>
                )}

                {status?.pending && (
                  <Alert>
                    <AlertDescription>
                      連携処理が進行中です。LINEアプリで表示された同意画面を完了させてください（有効期限:
                      {formatDate(status.pending.expires_at)} まで）。
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>連携手順</CardTitle>
            <CardDescription>以下の順番で操作するとスムーズに連携できます。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <p className="font-semibold flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                1. LINE公式アカウントを友だち追加
              </p>
              {addFriendUrl ? (
                <Button asChild variant="outline">
                  <a href={addFriendUrl} target="_blank" rel="noreferrer">
                    友だち追加ページを開く
                  </a>
                </Button>
              ) : (
                <Alert variant="destructive">
                  <AlertDescription>
                    NEXT_PUBLIC_LINE_ADD_FRIEND_URL が未設定です。環境変数を設定してください。
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <Separator />

            <div className="space-y-2">
              <p className="font-semibold flex items-center gap-2">
                <PlugZap className="h-4 w-4" />
                2. LINEでアカウント連携を開始
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild>
                  <Link href="/liff/link" target="_blank" rel="noreferrer">
                    LINE連携フローを開く
                  </Link>
                </Button>
                {deepLink && (
                  <Button asChild variant="outline">
                    <a href={deepLink} target="_blank" rel="noreferrer">
                      LINEアプリで開く
                    </a>
                  </Button>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                LINEアプリ内ブラウザで開くと自動的にLINEログインが行われ、連携画面へ遷移します。
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
