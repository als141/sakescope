'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Link2, Loader2, RefreshCcw, Unlink } from 'lucide-react';
import { useSignIn, useUser } from '@clerk/nextjs';
import type { OAuthStrategy } from '@clerk/types';
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

const lineProviderSlug = process.env.NEXT_PUBLIC_CLERK_LINE_OAUTH_SLUG;
const lineStrategy = lineProviderSlug as OAuthStrategy | undefined;

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
  const { user } = useUser();
  const { signIn, isLoaded: signInLoaded } = useSignIn();
  const [status, setStatus] = useState<LinkStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<'connect' | 'disconnect' | null>(null);

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

  const lineExternalAccount = useMemo(() => {
    if (!user || !lineProviderSlug) return null;
    return user.externalAccounts?.find((account) => account.provider === lineProviderSlug) ?? null;
  }, [user]);

  const linked = Boolean(status?.account);
  const friendOk = status?.account?.friend_flag ?? false;
  const deepLink = useMemo(() => {
    if (!liffId) return '';
    return `https://liff.line.me/${liffId}?scene=link`;
  }, []);

  const handleConnect = async () => {
    if (!signIn || !lineStrategy) {
      setActionMessage('LINE OAuth の設定が見つかりませんでした。');
      return;
    }
    setPendingAction('connect');
    try {
      await signIn.authenticateWithRedirect({
        strategy: lineStrategy,
        redirectUrl: '/settings/line',
        redirectUrlComplete: '/settings/line',
      });
    } catch (err) {
      console.error('Failed to start LINE OAuth', err);
      setActionMessage('LINE連携の開始に失敗しました。');
      setPendingAction(null);
    }
  };

  const handleDisconnect = async () => {
    if (!lineExternalAccount) {
      return;
    }
    setPendingAction('disconnect');
    try {
      await lineExternalAccount.destroy();
      setActionMessage('LINE連携を解除しました。');
      await fetchStatus();
    } catch (err) {
      console.error('Failed to unlink LINE account', err);
      setActionMessage('LINE連携の解除に失敗しました。');
    } finally {
      setPendingAction(null);
    }
  };

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
            <CardTitle>Clerk × LINE 認証</CardTitle>
            <CardDescription>LINE OAuth を使って送り主アカウントとLINE IDを同期します。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant={lineExternalAccount ? 'default' : 'outline'}>
                  {lineExternalAccount ? 'Clerk連携済み' : '未連携'}
                </Badge>
                {!lineProviderSlug && (
                  <Badge variant="destructive">Slug未設定</Badge>
                )}
              </div>
              {lineExternalAccount ? (
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>LINE userId: {lineExternalAccount.providerUserId}</p>
                  <p>表示名: {lineExternalAccount.label ?? '取得中…'}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  LINEボタンを押すと LINE アプリで承認し、そのまま通知に使えるIDを取得します。
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={handleConnect}
                disabled={!lineProviderSlug || !signInLoaded || pendingAction === 'connect'}
              >
                {pendingAction === 'connect' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    連携中…
                  </>
                ) : (
                  <>
                    <Link2 className="mr-2 h-4 w-4" />
                    LINEアカウントを連携
                  </>
                )}
              </Button>
              {lineExternalAccount && (
                <Button
                  variant="outline"
                  onClick={handleDisconnect}
                  disabled={pendingAction === 'disconnect'}
                >
                  {pendingAction === 'disconnect' ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />解除中…
                    </>
                  ) : (
                    <>
                      <Unlink className="mr-2 h-4 w-4" />
                      連携を解除
                    </>
                  )}
                </Button>
              )}
            </div>
            {actionMessage && (
              <Alert>
                <AlertDescription>{actionMessage}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>通知ステータス</CardTitle>
            <CardDescription>Supabase 経由で Push に使用する LINE ID を確認します。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading && (
              <div className="flex items-center gap-3 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />状態を読み込んでいます…
              </div>
            )}
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            {!loading && !error && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant={linked ? 'default' : 'outline'}>{linked ? '通知に使用可能' : '未登録'}</Badge>
                  <Badge variant={friendOk ? 'default' : 'secondary'}>
                    {friendOk ? '友だち済み' : '友だち登録が必要'}
                  </Badge>
                </div>
                {status?.account ? (
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>LINE表示名: {status.account.display_name ?? '未取得'}</p>
                    <p>LINE userId: {status.account.line_user_id}</p>
                    <p>登録日時: {formatDate(status.account.linked_at)}</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Clerk 連携が完了すると自動で登録されます。
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>連携手順</CardTitle>
            <CardDescription>LINE公式アカウントの友だち追加や LIFF テストリンクもこちらから確認できます。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <p className="font-semibold">LINE公式アカウント</p>
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
              <p className="font-semibold">LIFF テスト</p>
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
                LIFF のテスト用リンクです。Clerk 認証済みの場合、自動的にLINEトークンが取得されます。
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
