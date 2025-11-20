'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Gift,
  Sparkles,
  ClipboardCopy,
  Check,
  Loader2,
  Clock,
  ExternalLink,
  ListChecks,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import CreateGiftModal from '@/components/CreateGiftModal';
import type { GiftStatus, IntakeSummary, GiftDashboardItem } from '@/types/gift';

const currencyFormatter = new Intl.NumberFormat('ja-JP');
const dateTimeFormatter = new Intl.DateTimeFormat('ja-JP', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

type LinkStatus = {
  loading: boolean;
  copiedTarget: 'web' | 'line' | null;
  error: string | null;
  expiresAt?: string | null;
  webShareUrl?: string;
  lineShareUrl?: string | null;
};

const statusLabels: Record<GiftStatus, string> = {
  DRAFT: '下書き',
  LINK_CREATED: 'リンク未送信',
  OPENED: 'リンク開封済み',
  INTAKE_STARTED: '聞き取り中',
  INTAKE_COMPLETED: '聞き取り完了',
  HANDOFFED: '推薦生成中',
  RECOMMEND_READY: '推薦完了',
  NOTIFIED: '送信済み',
  CLOSED: 'クローズ',
  EXPIRED: '期限切れ',
};

const statusClassMap: Partial<Record<GiftStatus, string>> = {
  RECOMMEND_READY: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  NOTIFIED: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  HANDOFFED: 'bg-primary/10 text-primary border-primary/30',
  INTAKE_STARTED: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  INTAKE_COMPLETED: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  OPENED: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  LINK_CREATED: 'bg-muted text-muted-foreground border-border/60',
  EXPIRED: 'bg-destructive/10 text-destructive border-destructive/30',
  CLOSED: 'bg-muted text-muted-foreground border-border/60',
};

function formatBudget(min: number, max: number) {
  return `¥${currencyFormatter.format(min)}〜¥${currencyFormatter.format(max)}`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';
  try {
    return dateTimeFormatter.format(new Date(value));
  } catch {
    return value;
  }
}

function buildIntakeSummary(summary: IntakeSummary | null) {
  if (!summary) return [];
  const lines: string[] = [];
  if (summary.sweetness_dryness) {
    lines.push(`味わい: ${summary.sweetness_dryness}`);
  }
  if (summary.aroma?.length) {
    lines.push(`香り: ${summary.aroma.join(' / ')}`);
  }
  if (summary.temperature_preference?.length) {
    lines.push(`温度: ${summary.temperature_preference.join(' / ')}`);
  }
  if (summary.food_pairing?.length) {
    lines.push(`料理: ${summary.food_pairing.join(' / ')}`);
  }
  if (summary.drinking_frequency) {
    lines.push(`頻度: ${summary.drinking_frequency}`);
  }
  if (summary.region_preference?.length) {
    lines.push(`地域: ${summary.region_preference.join(' / ')}`);
  }
  if (summary.notes) {
    lines.push(summary.notes);
  }
  return lines;
}

const progressMessages: Partial<Record<GiftStatus, string>> = {
  LINK_CREATED: 'まだリンクは開封されていません。贈る相手にシェアしましょう。',
  OPENED: 'リンクが開封されました。年齢確認までしばらくお待ちください。',
  INTAKE_STARTED: '嗜好の聞き取りが進行中です。完了すると自動で推薦が始まります。',
  INTAKE_COMPLETED: '聞き取りが完了しました。AIが最適な一本を選定中です。',
  HANDOFFED: 'テキストエージェントが推薦内容を整理しています。',
  CLOSED: 'このギフトリンクはクローズされました。必要に応じて再作成してください。',
  EXPIRED: 'リンクの有効期限が切れています。新しいリンクを発行してください。',
};

interface GiftManagerProps {
  gifts: GiftDashboardItem[];
}

export default function GiftManager({ gifts }: GiftManagerProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [refreshOnClose, setRefreshOnClose] = useState(false);
  const [linkStatus, setLinkStatus] = useState<Record<string, LinkStatus>>({});

  const isReadyGift = useCallback(
    (gift: GiftDashboardItem) =>
      gift.status === 'RECOMMEND_READY' ||
      gift.status === 'NOTIFIED' ||
      Boolean(gift.recommendation),
    [],
  );

  const readyGifts = useMemo(() => gifts.filter((gift) => isReadyGift(gift)), [gifts, isReadyGift]);
  const activeGifts = useMemo(() => gifts.filter((gift) => !isReadyGift(gift)), [gifts, isReadyGift]);

  const scheduleCopyReset = (giftId: string, target: 'web' | 'line') => {
    setTimeout(() => {
      setLinkStatus((prev) => {
        const current = prev[giftId];
        if (!current || current.copiedTarget !== target) {
          return prev;
        }
        return {
          ...prev,
          [giftId]: { ...current, copiedTarget: null },
        };
      });
    }, 2000);
  };

  const copyGeneratedLink = async (giftId: string, url: string, target: 'web' | 'line') => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setLinkStatus((prev) => ({
        ...prev,
        [giftId]: {
          ...(prev[giftId] ?? { loading: false, copiedTarget: null, error: null }),
          copiedTarget: target,
          error: null,
        },
      }));
      scheduleCopyReset(giftId, target);
    } catch (err) {
      console.error('Failed to copy gift link', err);
      setLinkStatus((prev) => ({
        ...prev,
        [giftId]: {
          ...(prev[giftId] ?? { loading: false, copiedTarget: null, error: null }),
          error: 'リンクのコピーに失敗しました。',
        },
      }));
    }
  };

  const handleGenerateLink = async (giftId: string) => {
    setLinkStatus((prev) => ({
      ...prev,
      [giftId]: {
        loading: true,
        copiedTarget: null,
        error: null,
        expiresAt: prev[giftId]?.expiresAt,
        webShareUrl: prev[giftId]?.webShareUrl,
        lineShareUrl: prev[giftId]?.lineShareUrl,
      },
    }));
    try {
      const response = await fetch(`/api/gift/${giftId}/create-link`, {
        method: 'POST',
      });
      const data = await response.json();
      if (!response.ok || typeof data?.shareUrl !== 'string') {
        const errorText =
          typeof data?.error === 'string' ? data.error : 'リンクの生成に失敗しました。';
        throw new Error(errorText);
      }
      const lineShareUrl = typeof data.lineShareUrl === 'string' ? data.lineShareUrl : null;
      setLinkStatus((prev) => ({
        ...prev,
        [giftId]: {
          loading: false,
          copiedTarget: null,
          error: null,
          expiresAt: typeof data.expiresAt === 'string' ? data.expiresAt : null,
          webShareUrl: data.shareUrl,
          lineShareUrl,
        },
      }));
      await copyGeneratedLink(giftId, data.shareUrl, 'web');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'リンクの生成に失敗しました。';
      setLinkStatus((prev) => ({
        ...prev,
        [giftId]: {
          loading: false,
          copiedTarget: null,
          error: message,
          expiresAt: prev[giftId]?.expiresAt,
          webShareUrl: prev[giftId]?.webShareUrl,
          lineShareUrl: prev[giftId]?.lineShareUrl,
        },
      }));
    }
  };

  const handleModalOpen = () => {
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    if (refreshOnClose) {
      router.refresh();
      setRefreshOnClose(false);
    }
  };

  const renderStatusBadge = (status: GiftStatus) => (
    <Badge variant="outline" className={cn('gap-2 text-xs', statusClassMap[status])}>
      {statusLabels[status]}
    </Badge>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 sm:gap-10 px-4 sm:px-6 pb-16 sm:pb-20 pt-14 sm:pt-16">
        <header className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-primary/10 p-3 border border-primary/20">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">ギフト管理</h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                ギフトリンクの進行状況や推薦結果をまとめて確認できます。
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
            <Button
              onClick={handleModalOpen}
              className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-md w-full sm:w-auto justify-center"
            >
              <Gift className="mr-2 h-4 w-4" />
              新しいギフトを贈る
            </Button>
            <Link href="/">
              <Button variant="outline" className="border-border w-full sm:w-auto justify-center">
                ホームに戻る
              </Button>
            </Link>
          </div>
        </header>

        {gifts.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center space-y-4">
              <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Gift className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-xl font-semibold">まだギフトはありません</h2>
              <p className="text-sm text-muted-foreground">
                「新しいギフトを贈る」からリンクを作成すると、ここに進行状況が表示されます。
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-10">
            {readyGifts.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <ListChecks className="h-5 w-5 text-primary" />
                  <h2 className="text-lg sm:text-xl font-semibold">推薦が完了したギフト</h2>
                </div>
                <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
                  {readyGifts.map((gift) => (
                    <Card
                      key={gift.id}
                      className="border-border/60 hover:border-primary/40 transition-colors shadow-sm rounded-2xl sm:rounded-3xl h-full flex flex-col"
                    >
                      <CardHeader className="space-y-3 pb-3 sm:pb-4">
                        <div className="flex flex-wrap items-start justify-between gap-2 sm:gap-3">
                          <div className="min-w-0">
                            <CardTitle className="text-base sm:text-lg font-semibold leading-tight">
                              {gift.recipientFirstName ? `${gift.recipientFirstName} へのギフト` : 'ギフト'}
                            </CardTitle>
                            <p className="text-[11px] sm:text-xs text-muted-foreground">
                              {gift.occasion ?? '用途未設定'} ・ {formatDateTime(gift.createdAt)}
                            </p>
                          </div>
                          {renderStatusBadge(gift.status)}
                        </div>
                      </CardHeader>
                      <CardContent className="flex flex-col gap-3 sm:gap-4 flex-1">
                        {gift.recommendation ? (
                          <div className="rounded-2xl border border-border/50 bg-background/80 p-3 sm:p-4 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 space-y-1">
                                <p className="text-[11px] sm:text-xs text-muted-foreground">おすすめの一本</p>
                                <p
                                  className="text-base sm:text-lg font-semibold text-foreground leading-tight line-clamp-2 break-words"
                                >
                                  {gift.recommendation.sake.name}
                                </p>
                              </div>
                              {gift.recommendation.sake.type && (
                                <Badge
                                  variant="secondary"
                                  className="max-w-[140px] truncate"
                                  title={gift.recommendation.sake.type}
                                >
                                  {gift.recommendation.sake.type}
                                </Badge>
                              )}
                            </div>
                            {gift.recommendation.summary && (
                              <p
                                className="text-sm text-muted-foreground line-clamp-3 leading-relaxed"
                              >
                                {gift.recommendation.summary}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 p-3 sm:p-4 space-y-2">
                            <p className="text-sm font-semibold text-foreground">推薦データを取得できませんでした</p>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              推薦は完了していますが詳細データの取得に失敗しました。結果ページを開くと最新の情報を再取得します。
                            </p>
                          </div>
                        )}
                          <div className="flex flex-wrap gap-2 text-[11px] sm:text-xs text-muted-foreground">
                            <Badge variant="outline" className="whitespace-nowrap">
                              予算 {formatBudget(gift.budgetMin, gift.budgetMax)}
                            </Badge>
                            {gift.intakeSummary && (
                              <Badge
                              variant="outline"
                              className="max-w-full"
                              style={{
                                display: '-webkit-box',
                                WebkitLineClamp: 1,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                              }}
                            >
                              聞き取り {buildIntakeSummary(gift.intakeSummary).slice(0, 2).join(' / ') || '—'}
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-col sm:flex-row flex-wrap gap-2 mt-auto pt-1">
                          <Button asChild className="w-full sm:flex-1 min-w-[140px] justify-center">
                            <Link href={`/gift/result/${gift.id}`}>
                              結果ページを開く
                              <ExternalLink className="ml-2 h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="outline"
                            className="w-full sm:w-auto sm:min-w-[120px] justify-center"
                            onClick={() => router.push(`/gift/result/${gift.id}#alternatives`)}
                          >
                            詳細を見る
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <h2 className="text-lg sm:text-xl font-semibold">進行中のギフト</h2>
              </div>
              {activeGifts.length === 0 ? (
                <Card className="border-border/60">
                  <CardContent className="py-8 text-center text-sm text-muted-foreground">
                    進行中のギフトはありません。リンクを送るとこちらに表示されます。
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 sm:gap-6">
                  {activeGifts.map((gift) => {
                    const linkInfo = linkStatus[gift.id];
                    const summaryLines = buildIntakeSummary(gift.intakeSummary);
                    const shareLabel = linkInfo?.loading
                      ? 'リンクを生成中...'
                      : linkInfo?.copiedTarget
                        ? 'リンクをコピーしました'
                        : linkInfo?.webShareUrl
                          ? 'リンクをコピー'
                          : 'リンクを作成';
                    return (
                      <Card key={gift.id} className="border-border/60 rounded-2xl sm:rounded-3xl h-full flex flex-col">
                        <CardHeader className="space-y-3 pb-3 sm:pb-4">
                          <div className="flex flex-wrap items-start justify-between gap-2 sm:gap-3">
                            <div className="min-w-0">
                              <CardTitle className="text-base sm:text-lg font-semibold leading-tight">
                                {gift.recipientFirstName ? `${gift.recipientFirstName} へのギフト` : 'ギフト'}
                              </CardTitle>
                              <p className="text-[11px] sm:text-xs text-muted-foreground">
                                {gift.occasion ?? '用途未設定'} ・ {formatDateTime(gift.createdAt)}
                              </p>
                            </div>
                            {renderStatusBadge(gift.status)}
                          </div>
                          <div className="text-[11px] sm:text-xs text-muted-foreground flex flex-wrap gap-3">
                            <span className="whitespace-nowrap">予算 {formatBudget(gift.budgetMin, gift.budgetMax)}</span>
                            {gift.intakeCompletedAt && <span className="whitespace-nowrap">最終更新 {formatDateTime(gift.intakeCompletedAt)}</span>}
                          </div>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-3 sm:gap-4 flex-1">
                          <div className="rounded-2xl border border-border/50 bg-muted/30 p-3 sm:p-4 text-sm text-muted-foreground space-y-1.5">
                            <p className="font-semibold text-foreground text-sm">進捗メモ</p>
                            <p className="leading-relaxed">{progressMessages[gift.status] ?? '現在のステータスをご確認ください。'}</p>
                          </div>
                          {summaryLines.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                                聞き取り済みの嗜好
                              </p>
                              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                                {summaryLines.map((line) => (
                                  <li key={line}>{line}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          <Separator />
                          <div className="flex flex-col sm:flex-row flex-wrap gap-2 mt-auto pt-1">
                            <Button
                              variant="outline"
                              className="flex items-center gap-2 justify-center w-full sm:w-auto"
                              onClick={() => handleGenerateLink(gift.id)}
                              disabled={linkInfo?.loading}
                            >
                              {linkInfo?.loading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : linkInfo?.copiedTarget ? (
                                <Check className="h-4 w-4" />
                              ) : (
                                <ClipboardCopy className="h-4 w-4" />
                              )}
                              {shareLabel}
                            </Button>
                            <Button asChild variant="ghost" className="flex items-center gap-2 justify-center w-full sm:w-auto">
                              <Link href={`/gift/result/${gift.id}`}>
                                進行状況を見る
                                <ExternalLink className="h-4 w-4" />
                              </Link>
                            </Button>
                            {linkInfo?.error && (
                              <p className="text-xs text-destructive w-full">{linkInfo.error}</p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        <CreateGiftModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          onCreated={() => {
            setRefreshOnClose(true);
          }}
        />
      </div>
    </div>
  );
}
