'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSignIn, useUser } from '@clerk/nextjs';
import type { OAuthStrategy } from '@clerk/types';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Link2,
  Loader2,
  MessageSquare,
  RefreshCcw,
  Shield,
  Sparkles,
  Unlink,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  if (!value) return '未取得';
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '未取得';
    return date.toLocaleString('ja-JP', {
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

export default function SettingsPage() {
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
    setActionMessage(null);
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
  }, [user, lineProviderSlug]);

  const linked = Boolean(status?.account);
  const friendOk = status?.account?.friend_flag ?? false;
  const deepLink = useMemo(() => {
    if (!liffId) return '';
    return `https://liff.line.me/${liffId}?scene=link`;
  }, [liffId]);

  const handleConnect = async () => {
    if (!signIn || !lineStrategy) {
      setActionMessage('LINE OAuth の設定が見つかりませんでした。');
      return;
    }
    setPendingAction('connect');
    try {
      await signIn.authenticateWithRedirect({
        strategy: lineStrategy,
        redirectUrl: '/settings',
        redirectUrlComplete: '/settings',
      });
      setActionMessage('LINEアプリで承認してください。');
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
    <div className="min-h-screen relative overflow-hidden bg-background">
      <div className="fixed inset-0 -z-10">
        <motion.div
          className="absolute inset-0 opacity-20"
          animate={{
            background: [
              'radial-gradient(circle at 20% 80%, oklch(0.68 0.15 70) 0%, transparent 50%)',
              'radial-gradient(circle at 80% 20%, oklch(0.78 0.12 60) 0%, transparent 50%)',
            ],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
        />
      </div>

      <div className="relative z-10 w-full px-6 sm:px-8 lg:px-12 xl:px-16 py-10 sm:py-14 lg:py-16">
        <header className="w-full max-w-5xl mx-auto mb-10 sm:mb-12">
          <Link href="/">
            <Button variant="ghost" size="lg" className="mb-6 sm:mb-8 group">
              <ArrowLeft className="mr-2 sm:mr-2.5 h-4 w-4 sm:h-5 sm:w-5 group-hover:-translate-x-1 transition-transform" />
              戻る
            </Button>
          </Link>

          <div className="flex items-center gap-3 sm:gap-4 lg:gap-5 mb-4 sm:mb-5">
            <div className="rounded-2xl bg-primary/10 p-3 sm:p-4 border border-primary/20">
              <SettingsGlyph />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold gradient-text tracking-tight">
                設定
              </h1>
              <p className="text-muted-foreground text-base sm:text-lg lg:text-xl leading-relaxed font-light">
                LINE 連携と通知の設定をまとめて管理します
              </p>
            </div>
          </div>
        </header>

        <div className="grid gap-6 xl:gap-8 lg:grid-cols-[1.6fr_1fr] w-full max-w-5xl mx-auto">
          <motion.div
            className="space-y-6"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <Card className="shadow-2xl border-primary/25 bg-primary/5">
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-primary text-primary-foreground p-3">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl sm:text-3xl">LINE連携</CardTitle>
                    <CardDescription>
                      推薦完了通知を LINE で受け取るための必須設定です。
                    </CardDescription>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => fetchStatus()} disabled={loading}>
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  状態を更新
                </Button>
              </CardHeader>

              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <StatusTile
                    label="Clerk認証"
                    status={lineExternalAccount ? '連携済み' : '未連携'}
                    tone={lineExternalAccount ? 'positive' : 'warn'}
                    helper={
                      lineExternalAccount
                        ? `userId: ${lineExternalAccount.providerUserId}`
                        : 'LINEアプリで承認すると取得されます'
                    }
                  />
                  <StatusTile
                    label="通知登録"
                    status={linked ? '通知に使用可能' : '未登録'}
                    tone={linked ? 'positive' : 'warn'}
                    helper={
                      linked
                        ? `登録日時: ${formatDate(status?.account?.linked_at ?? '')}`
                        : 'Clerk連携が完了すると自動登録されます'
                    }
                  />
                  <StatusTile
                    label="友だち状態"
                    status={friendOk ? '友だち済み' : '友だち登録を確認'}
                    tone={friendOk ? 'positive' : 'neutral'}
                    helper="公式アカウントを友だち追加しているかを確認します"
                  />
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
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          解除中…
                        </>
                      ) : (
                        <>
                          <Unlink className="mr-2 h-4 w-4" />
                          連携を解除
                        </>
                      )}
                    </Button>
                  )}
                  {!lineProviderSlug && (
                    <Badge variant="destructive" className="flex items-center gap-2">
                      <AlertCircle className="h-3.5 w-3.5" />
                      NEXT_PUBLIC_CLERK_LINE_OAUTH_SLUG が未設定です
                    </Badge>
                  )}
                </div>

                {(actionMessage || error) && (
                  <Alert variant={error ? 'destructive' : 'default'}>
                    <AlertDescription>{error ?? actionMessage}</AlertDescription>
                  </Alert>
                )}

                <Separator />

                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2 font-medium text-foreground">
                    <Shield className="h-4 w-4 text-primary" />
                    連携方法
                  </div>
                  <p>
                    「LINEアカウントを連携」を押し、LINE アプリで承認すると Clerk に外部アカウントが登録され、
                    Supabase に通知用の LINE ID が保存されます。解除すると通知も停止します。
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-xl border-border/50">
              <CardHeader>
                <CardTitle>通知ステータス</CardTitle>
                <CardDescription>Supabase へ登録された通知用 ID を確認できます。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {loading && (
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    状態を読み込んでいます…
                  </div>
                )}
                {!loading && error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                {!loading && !error && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge variant={linked ? 'default' : 'outline'}>
                        {linked ? '通知に使用可能' : '未登録'}
                      </Badge>
                      <Badge variant={friendOk ? 'default' : 'secondary'}>
                        {friendOk ? '友だち済み' : '友だち登録が必要'}
                      </Badge>
                      {status?.pending && (
                        <Badge variant="outline">
                          連携待ち: {formatDate(status.pending.expires_at)}
                        </Badge>
                      )}
                    </div>
                    {status?.account ? (
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>LINE表示名: {status.account.display_name ?? '未取得'}</p>
                        <p>LINE userId: {status.account.line_user_id}</p>
                        <p>登録日時: {formatDate(status.account.linked_at)}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Clerk の外部アカウント連携が完了すると自動で登録されます。
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <div className="space-y-6">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>セットアップ手順</CardTitle>
                <CardDescription>友だち追加と LIFF テストリンクをここから開けます。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <p className="font-semibold flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    LINE公式アカウント
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
                    <Sparkles className="h-4 w-4 text-primary" />
                    LIFF テスト
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
                    LIFF のテスト用リンクです。Clerk 認証済みの場合、自動的に LINE トークンが取得されます。
                  </p>
                </div>
              </CardContent>
            </Card>

            <Alert className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10 backdrop-blur-sm shadow-lg">
              <Sparkles className="h-6 w-6 text-primary" />
              <AlertDescription className="ml-0 mt-3 space-y-2">
                <p className="text-base leading-relaxed">
                  <strong className="text-foreground font-semibold">ヒント:</strong>{' '}
                  LINE 連携が完了していれば、設定の保存操作は不要です。通知を再開したい場合は再度連携してください。
                </p>
                <p className="text-sm text-muted-foreground">
                  動作が不安定な場合は「状態を更新」で最新の連携状況を取得できます。
                </p>
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsGlyph() {
  return (
    <svg
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      className="h-8 w-8 text-primary"
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M32 8c1.7 0 3 .9 3.8 2.3l1.7 3.2a2 2 0 0 0 1.7 1l3.6-.2a4 4 0 0 1 4 2.7l1 3.4c.3 1.1 0 2.3-.8 3.1l-2.6 2.6a2 2 0 0 0-.5 2l1 3.4c.3 1.1 0 2.3-.8 3.1l-2.7 2.7a2 2 0 0 0-.5 2l1 3.2c.5 1.6-.3 3.3-1.8 4l-3.3 1.5c-1 .5-2.3.4-3.2-.3L32 48a2 2 0 0 0-2.4 0l-2.9 2.1c-.9.7-2.1.8-3.2.3l-3.3-1.5a3.6 3.6 0 0 1-1.8-4l1-3.2a2 2 0 0 0-.6-2l-2.6-2.7a3.6 3.6 0 0 1-.8-3l1-3.4a2 2 0 0 0-.5-2l-2.6-2.6a3.6 3.6 0 0 1-.9-3.1l1-3.4a4 4 0 0 1 4-2.7l3.6.2a2 2 0 0 0 1.7-1l1.7-3.2A4 4 0 0 1 32 8Zm0 12a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z"
      />
    </svg>
  );
}

type StatusTileTone = 'positive' | 'warn' | 'neutral';

function StatusTile({
  label,
  status,
  helper,
  tone,
}: {
  label: string;
  status: string;
  helper?: string;
  tone: StatusTileTone;
}) {
  const icon =
    tone === 'positive' ? (
      <Check className="h-4 w-4 text-emerald-500" />
    ) : tone === 'warn' ? (
      <AlertCircle className="h-4 w-4 text-amber-500" />
    ) : (
      <Sparkles className="h-4 w-4 text-primary" />
    );

  return (
    <div className="rounded-xl border border-border/60 bg-background/60 p-4 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2 text-base font-medium text-foreground">
        {icon}
        <span>{status}</span>
      </div>
      {helper && <p className="text-xs text-muted-foreground leading-relaxed">{helper}</p>}
    </div>
  );
}
