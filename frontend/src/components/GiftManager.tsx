'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Gift,
  Sparkles,
  ClipboardCopy,
  Check,
  Loader2,
  Clock,
  ExternalLink,
  ListChecks,
  Search,
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
  copied: boolean;
  error: string | null;
  expiresAt?: string | null;
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

interface GiftManagerProps {
  gifts: GiftDashboardItem[];
}

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

function buildGoogleSearchUrl(keyword: string) {
  return `https://www.google.com/search?q=${encodeURIComponent(keyword)}`;
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

export default function GiftManager({ gifts }: GiftManagerProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [refreshOnClose, setRefreshOnClose] = useState(false);
  const [linkStatus, setLinkStatus] = useState<Record<string, LinkStatus>>({});

  const readyGifts = useMemo(
    () => gifts.filter((gift) => gift.recommendation),
    [gifts],
  );
  const activeGifts = useMemo(
    () => gifts.filter((gift) => !gift.recommendation),
    [gifts],
  );

  const handleGenerateLink = async (giftId: string) => {
    setLinkStatus((prev) => ({
      ...prev,
      [giftId]: {
        loading: true,
        copied: false,
        error: null,
        expiresAt: prev[giftId]?.expiresAt,
      },
    }));
    try {
      const response = await fetch(`/api/gift/${giftId}/create-link`, {
        method: 'POST',
      });
      const data = await response.json();
      if (!response.ok || typeof data?.shareUrl !== 'string') {
        const errorText =
          typeof data?.error === 'string'
            ? data.error
            : 'リンクの生成に失敗しました。';
        throw new Error(errorText);
      }
      await navigator.clipboard.writeText(data.shareUrl);
      setLinkStatus((prev) => ({
        ...prev,
        [giftId]: {
          loading: false,
          copied: true,
          error: null,
          expiresAt: typeof data.expiresAt === 'string' ? data.expiresAt : null,
        },
      }));
      setTimeout(() => {
        setLinkStatus((prev) => {
          const current = prev[giftId];
          if (!current) return prev;
          return {
            ...prev,
            [giftId]: { ...current, copied: false },
          };
        });
      }, 2000);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'リンクの生成に失敗しました。';
      setLinkStatus((prev) => ({
        ...prev,
        [giftId]: {
          loading: false,
          copied: false,
          error: message,
          expiresAt: prev[giftId]?.expiresAt,
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

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-20 pt-16">
        <header className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-primary/10 p-3 border border-primary/20">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">ギフト管理</h1>
              <p className="text-sm text-muted-foreground">
                ここからギフト用リンクの作成や進行状況、推薦結果を確認できます。
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={handleModalOpen}
              className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
            >
              <Gift className="mr-2 h-4 w-4" />
              新しいギフトを贈る
            </Button>
            <Link href="/">
              <Button variant="outline" className="border-border">
                ホームに戻る
              </Button>
            </Link>
          </div>
        </header>

        {gifts.length === 0 ? (
          <Card className="border-dashed">
            <CardHeader className="flex flex-col items-center text-center space-y-4">
              <div className="rounded-full bg-primary/10 p-4 border border-primary/20">
                <Gift className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl font-semibold">
                まだギフトはありません
              </CardTitle>
              <p className="text-sm text-muted-foreground max-w-sm">
                「新しいギフトを贈る」をクリックして、贈りたい相手のためのリンクを作成しましょう。
                聞き取った嗜好に合わせて最適な日本酒を推薦します。
              </p>
            </CardHeader>
          </Card>
        ) : (
          <div className="space-y-10">
            {readyGifts.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <ListChecks className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-semibold">
                    推薦が完了したギフト
                  </h2>
                </div>
                <div className="grid gap-6">
                  {readyGifts.map((gift) => {
                    const statusClass =
                      statusClassMap[gift.status] ??
                      'bg-muted text-muted-foreground border-border/60';
                    return (
                      <Card key={gift.id} className="border-border/60">
                        <CardHeader className="space-y-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <CardTitle className="text-2xl font-semibold">
                                {gift.recipientFirstName
                                  ? `${gift.recipientFirstName} へのギフト`
                                  : 'ギフト'}
                              </CardTitle>
                              <p className="text-sm text-muted-foreground">
                                {gift.occasion
                                  ? `${gift.occasion} | 作成日: ${formatDateTime(gift.createdAt)}`
                                  : `作成日: ${formatDateTime(gift.createdAt)}`}
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className={cn('gap-1', statusClass)}
                            >
                              {statusLabels[gift.status]}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                            <span>予算: {formatBudget(gift.budgetMin, gift.budgetMax)}</span>
                            {gift.recommendationCreatedAt && (
                              <span>
                                推薦日時: {formatDateTime(gift.recommendationCreatedAt)}
                              </span>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          {gift.recommendation && (
                            <div className="space-y-5">
                              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 shadow-sm space-y-3">
                                <div className="flex flex-col gap-2">
                                  <div className="text-sm font-semibold text-primary uppercase tracking-wide">
                                    メイン推薦
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <h3 className="text-xl font-semibold text-foreground">
                                      {gift.recommendation.sake.name}
                                    </h3>
                                    <Button
                                      asChild
                                      variant="outline"
                                      size="icon-sm"
                                      className="h-7 w-7"
                                    >
                                      <a
                                        href={buildGoogleSearchUrl(gift.recommendation.sake.name)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        aria-label={`${gift.recommendation.sake.name} をGoogleで検索`}
                                      >
                                        <Search className="h-3.5 w-3.5" />
                                      </a>
                                    </Button>
                                  </div>
                                  <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                                    {gift.recommendation.summary}
                                  </p>
                                </div>
                                {gift.recommendation.tastingHighlights?.length ? (
                                  <div className="text-sm text-muted-foreground space-y-1">
                                    <div className="font-semibold text-foreground">味わいの特徴</div>
                                    <p>{gift.recommendation.tastingHighlights.join(' / ')}</p>
                                  </div>
                                ) : null}
                                {gift.recommendation.servingSuggestions?.length ? (
                                  <div className="text-sm text-muted-foreground space-y-1">
                                    <div className="font-semibold text-foreground">おすすめの楽しみ方</div>
                                    <p>{gift.recommendation.servingSuggestions.join(' / ')}</p>
                                  </div>
                                ) : null}
                                <div className="space-y-2">
                                  <div className="text-sm font-semibold text-foreground">
                                    購入候補
                                  </div>
                                  <div className="grid gap-2">
                                    {gift.recommendation.shops.map((shop) => (
                                      <a
                                        key={`${gift.id}-${shop.retailer}-${shop.url}`}
                                        href={shop.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-between rounded-xl border border-border/40 bg-background/70 px-4 py-3 text-sm hover:bg-muted transition-colors"
                                      >
                                        <div className="flex items-center gap-2 text-foreground">
                                          <ExternalLink className="h-4 w-4 text-primary" />
                                          <span>{shop.retailer}</span>
                                        </div>
                                        <div className="text-muted-foreground">
                                          {shop.price
                                            ? `¥${currencyFormatter.format(shop.price)}`
                                            : shop.priceText ?? '価格情報なし'}
                                        </div>
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              {gift.recommendation.alternatives?.length ? (
                                <div className="space-y-3">
                                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                                    代替案
                                  </h4>
                                  <div className="grid gap-3">
                                    {gift.recommendation.alternatives.map((alt, index) => (
                                      <div
                                        key={`${gift.id}-alt-${index}`}
                                        className="rounded-xl border border-border/50 bg-background/80 p-4 space-y-2"
                                      >
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                          <div className="font-semibold text-foreground">
                                            {alt.name}
                                          </div>
                                          <div className="flex items-center gap-2">
                                            {alt.url ? (
                                              <Button
                                                asChild
                                                variant="outline"
                                                size="icon-sm"
                                                className="h-7 w-7"
                                              >
                                                <a
                                                  href={alt.url}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  aria-label={`${alt.name} の販売ページ`}
                                                >
                                                  <ExternalLink className="h-3.5 w-3.5" />
                                                </a>
                                              </Button>
                                            ) : null}
                                            <Button
                                              asChild
                                              variant="outline"
                                              size="icon-sm"
                                              className="h-7 w-7"
                                            >
                                              <a
                                                href={buildGoogleSearchUrl(alt.name)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                aria-label={`${alt.name} をGoogleで検索`}
                                              >
                                                <Search className="h-3.5 w-3.5" />
                                              </a>
                                            </Button>
                                          </div>
                                        </div>
                                        {alt.highlight ? (
                                          <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                                            {alt.highlight}
                                          </p>
                                        ) : null}
                                        {alt.priceText ? (
                                          <p className="text-xs text-muted-foreground">
                                            参考価格: {alt.priceText}
                                          </p>
                                        ) : null}
                                        {alt.notes ? (
                                          <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                                            {alt.notes}
                                          </p>
                                        ) : null}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : null}

                              {gift.recommendation.followUpPrompt && (
                                <div className="rounded-xl border border-border/50 bg-muted/40 p-4 text-sm text-muted-foreground">
                                  <div className="font-semibold text-foreground mb-2">フォロー提案</div>
                                  <p>{gift.recommendation.followUpPrompt}</p>
                                </div>
                              )}
                            </div>
                          )}

                          <Separator />

                          <div className="space-y-3">
                            <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                              聞き取ったポイント
                            </div>
                            {buildIntakeSummary(gift.intakeSummary).length > 0 ? (
                              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                                {buildIntakeSummary(gift.intakeSummary).map((line) => (
                                  <li key={line}>{line}</li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                聞き取りサマリーは登録されていません。
                              </p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </section>
            )}

            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">進行中のギフト</h2>
              </div>
              {activeGifts.length === 0 ? (
                <Card className="border-border/60">
                  <CardContent className="py-8 text-center text-sm text-muted-foreground">
                    進行中のギフトはありません。リンクを送るとこちらに表示されます。
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-6">
                  {activeGifts.map((gift) => {
                    const statusClass =
                      statusClassMap[gift.status] ??
                      'bg-muted text-muted-foreground border-border/60';
                    const linkInfo = linkStatus[gift.id];
                    return (
                      <Card key={gift.id} className="border-border/60">
                        <CardHeader className="space-y-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <CardTitle className="text-xl font-semibold">
                                {gift.recipientFirstName
                                  ? `${gift.recipientFirstName} へのギフト`
                                  : 'ギフト'}
                              </CardTitle>
                              <p className="text-sm text-muted-foreground">
                                {gift.occasion ?? '用途未設定'} | 作成日: {formatDateTime(gift.createdAt)}
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className={cn('gap-1', statusClass)}
                            >
                              {statusLabels[gift.status]}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                            <span>予算: {formatBudget(gift.budgetMin, gift.budgetMax)}</span>
                            {gift.intakeCompletedAt && (
                              <span>最終更新: {formatDateTime(gift.intakeCompletedAt)}</span>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="rounded-xl border border-border/50 bg-muted/30 p-4 space-y-2 text-sm text-muted-foreground">
                            <div className="font-semibold text-foreground">進捗メモ</div>
                            {gift.status === 'LINK_CREATED' && (
                              <p>リンクはまだ開封されていません。贈る相手に共有しましょう。</p>
                            )}
                            {gift.status === 'OPENED' && (
                              <p>リンクが開封されました。年齢確認の完了をお待ちください。</p>
                            )}
                            {gift.status === 'INTAKE_STARTED' && (
                              <p>相手との会話が進行中です。終了すると推薦が生成されます。</p>
                            )}
                            {gift.status === 'INTAKE_COMPLETED' && (
                              <p>嗜好の聞き取りが完了しました。まもなく推薦が作成されます。</p>
                            )}
                            {gift.status === 'HANDOFFED' && (
                              <p>テキストエージェントが推薦を作成しています。完了すると通知されます。</p>
                            )}
                            {['CLOSED', 'EXPIRED'].includes(gift.status) && (
                              <p>このギフトリンクは無効になっています。必要に応じて新しいリンクを作成してください。</p>
                            )}
                          </div>

                          {buildIntakeSummary(gift.intakeSummary).length > 0 && (
                            <div className="space-y-2">
                              <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                                聞き取り済みの嗜好
                              </div>
                              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                                {buildIntakeSummary(gift.intakeSummary).map((line) => (
                                  <li key={line}>{line}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          <div className="flex flex-col gap-2">
                            <Button
                              variant="outline"
                              className="justify-center"
                              onClick={() => handleGenerateLink(gift.id)}
                              disabled={linkInfo?.loading}
                            >
                              {linkInfo?.loading ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  リンクを生成中...
                                </>
                              ) : linkInfo?.copied ? (
                                <>
                                  <Check className="mr-2 h-4 w-4" />
                                  リンクをコピーしました
                                </>
                              ) : (
                                <>
                                  <ClipboardCopy className="mr-2 h-4 w-4" />
                                  招待リンクをコピー
                                </>
                              )}
                            </Button>
                            {linkInfo?.expiresAt && (
                              <p className="text-xs text-muted-foreground">
                                有効期限: {formatDateTime(linkInfo.expiresAt)}
                              </p>
                            )}
                            {linkInfo?.error && (
                              <p className="text-xs text-destructive">{linkInfo.error}</p>
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
      </div>

      <CreateGiftModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onCreated={() => setRefreshOnClose(true)}
      />
    </div>
  );
}
