'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Loader2, AlertCircle, Gift, ArrowLeft, Package, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { getBrowserSupabaseClient } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import type { Gift as GiftType } from '@/types/gift';
import SakeDisplay from '@/components/SakeDisplay';
import type { PurchaseOffer } from '@/domain/sake/types';
import { mapGiftRecommendationPayload } from '@/lib/giftRecommendation';
import { PreferenceRadar } from '@/components/PreferenceRadar';

const formatBudgetRange = (gift: GiftType) =>
  `¥${gift.budget_min.toLocaleString()} - ¥${gift.budget_max.toLocaleString()}`;

const statusLabels: Record<GiftStatusKey, string> = {
  LINK_CREATED: 'リンク未送信',
  OPENED: 'リンク開封済み',
  INTAKE_STARTED: '聞き取り中',
  INTAKE_COMPLETED: '聞き取り完了',
  HANDOFFED: '推薦生成中',
  RECOMMEND_READY: '推薦完了',
  NOTIFIED: '送信済み',
  CLOSED: 'クローズ',
  EXPIRED: '期限切れ',
  DRAFT: '下書き',
};

const waitingMessages: Record<string, string> = {
  LINK_CREATED: 'リンクはまだ開封されていません。贈る相手に共有しましょう。',
  OPENED: 'リンクが開封されました。聞き取りの開始をお待ちください。',
  INTAKE_STARTED: '嗜好の聞き取りが進行中です。完了するとAIが推薦を作成します。',
  INTAKE_COMPLETED: '聞き取りが完了しました。まもなく推薦が生成されます。',
  HANDOFFED: 'AIが最適な一本を選定しています。',
};

type GiftStatusKey =
  | 'LINK_CREATED'
  | 'OPENED'
  | 'INTAKE_STARTED'
  | 'INTAKE_COMPLETED'
  | 'HANDOFFED'
  | 'RECOMMEND_READY'
  | 'NOTIFIED'
  | 'CLOSED'
  | 'EXPIRED'
  | 'DRAFT';

const timelineOrder: Array<{ key: GiftStatusKey; label: string }> = [
  { key: 'LINK_CREATED', label: 'リンク作成' },
  { key: 'OPENED', label: 'リンク開封' },
  { key: 'INTAKE_COMPLETED', label: '聞き取り完了' },
  { key: 'HANDOFFED', label: '推薦生成中' },
  { key: 'RECOMMEND_READY', label: '推薦完了' },
];

export default function GiftResultPage() {
  const params = useParams();
  const router = useRouter();
  const giftId = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gift, setGift] = useState<GiftType | null>(null);
  const [offer, setOffer] = useState<PurchaseOffer | null>(null);
  const hasMarkedReadRef = useRef(false);
  const giftStatus = gift?.status;

  useEffect(() => {
    async function loadGiftResult() {
      try {
        setOffer(null);
        setError(null);

        const response = await fetch(`/api/gift/${giftId}/detail`, { cache: 'no-store' });

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          const message =
            (data && typeof data.error === 'string' && data.error) || 'ギフトが見つかりませんでした';
          setError(message);
          setIsLoading(false);
          return;
        }

        const payload = (await response.json()) as {
          gift: GiftType;
          recommendation: { recommendations: unknown; created_at: string | null } | null;
        };

        setGift(payload.gift);

        if (payload.recommendation) {
          const mappedOffer = mapGiftRecommendationPayload(
            payload.recommendation.recommendations,
            payload.recommendation.created_at ?? undefined,
          );
          if (mappedOffer) {
            setOffer(mappedOffer);
          }
        }
      } catch (err) {
        console.error('Error loading gift result:', err);
        setError('結果の読み込み中にエラーが発生しました');
      } finally {
        setIsLoading(false);
      }
    }

    if (giftId) {
      void loadGiftResult();
    }

    // Subscribe to realtime updates (still via anon key; used only to trigger refetch)
    const supabase = getBrowserSupabaseClient();
    const channel = supabase
      .channel(`gift-${giftId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'gifts',
          filter: `id=eq.${giftId}`,
        },
        () => {
          void loadGiftResult();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [giftId]);

  useEffect(() => {
    hasMarkedReadRef.current = false;
  }, [giftId]);

  useEffect(() => {
    if (!giftId || !giftStatus) return;
    if (!['RECOMMEND_READY', 'NOTIFIED', 'CLOSED'].includes(giftStatus)) return;
    if (hasMarkedReadRef.current) return;

    hasMarkedReadRef.current = true;
    void (async () => {
      try {
        await fetch('/api/notifications/mark-read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ giftId }),
        });
      } catch (error) {
        console.warn('Failed to mark gift recommendation notification read', error);
      }
    })();
  }, [giftId, giftStatus]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">ギフト情報を読み込んでいます...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !gift) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              エラー
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button onClick={() => router.push('/gift')} className="w-full">
              ギフト一覧に戻る
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Waiting for recommendation
  if (gift.status !== 'RECOMMEND_READY' && gift.status !== 'NOTIFIED' && gift.status !== 'CLOSED') {
    const currentIdx = Math.max(
      timelineOrder.findIndex((step) => step.key === gift.status),
      gift.status === 'INTAKE_STARTED' ? 1 : 0,
    );

    return (
      <div className="min-h-screen bg-background px-3 py-6 sm:px-6 sm:py-10">
        <div className="max-w-2xl mx-auto space-y-5 sm:space-y-6">
          <Card className="rounded-2xl sm:rounded-3xl">
            <CardHeader className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-primary/10 p-2">
                    <Gift className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg sm:text-xl font-semibold">推薦を準備中です</CardTitle>
                    <CardDescription>
                      {gift.occasion ?? '用途未設定'} ・ {gift.recipient_first_name ?? '宛先未設定'} さん
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="secondary">{statusLabels[gift.status as GiftStatusKey] ?? '処理中'}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {waitingMessages[gift.status] ?? '推奨結果が確定すると自動的に更新されます。'}
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-4">
                {timelineOrder.map((step, index) => {
                  const completed = index < currentIdx;
                  const active = step.key === gift.status;
                  return (
                    <div key={step.key} className="flex items-center gap-3">
                      <div
                        className={cn(
                          'h-7 w-7 rounded-full border flex items-center justify-center text-xs font-semibold',
                          completed
                            ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600'
                            : active
                              ? 'border-primary text-primary'
                              : 'border-border text-muted-foreground',
                        )}
                      >
                        {completed ? <Check className="h-4 w-4" /> : index + 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{step.label}</p>
                        {active && (
                          <p className="text-xs text-muted-foreground">
                            {waitingMessages[gift.status] ?? '処理中です'}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="text-muted-foreground">予算範囲</div>
                <div className="font-medium">{formatBudgetRange(gift)}</div>
                {gift.occasion && (
                  <>
                    <div className="text-muted-foreground">用途</div>
                    <div className="font-medium">{gift.occasion}</div>
                  </>
                )}
                <div className="text-muted-foreground">作成日</div>
                <div className="font-medium">{new Date(gift.created_at).toLocaleDateString('ja-JP')}</div>
              </div>
              <Button onClick={() => router.push('/gift')} variant="outline" className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                ギフト一覧に戻る
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show recommendation
  if (offer) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-8 sm:py-10 space-y-6 sm:space-y-8">
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl sm:rounded-3xl border border-border/60 bg-card/80 backdrop-blur p-5 sm:p-6 space-y-3 sm:space-y-4 shadow-lg"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-primary/10 p-3">
                  <Package className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold">ギフト推薦結果</h1>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {gift.recipient_first_name ?? '宛先未設定'} さんへの {gift.occasion ?? 'ギフト'}
                  </p>
                </div>
              </div>
              <Badge variant="secondary" className="px-3 py-1 text-[10px] sm:text-xs tracking-[0.25em] uppercase">
                {gift.status === 'NOTIFIED' ? 'NOTIFIED' : 'READY'}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-3 text-xs sm:text-sm text-muted-foreground">
              <span>予算 {formatBudgetRange(gift)}</span>
              <span>作成日 {new Date(gift.created_at).toLocaleDateString('ja-JP')}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={() => router.push('/gift')} className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                ギフト一覧に戻る
              </Button>
            </div>
          </motion.div>

          <Card className="rounded-2xl sm:rounded-3xl border border-border/60">
            <CardHeader className="space-y-2 pb-3">
              <CardDescription>おすすめの一本</CardDescription>
              <CardTitle className="text-xl sm:text-2xl font-semibold">
                {offer.sake.name}
              </CardTitle>
              {offer.summary && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {offer.summary}
                </p>
              )}
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {offer.sake.brewery && (
                <Badge variant="secondary">{offer.sake.brewery}</Badge>
              )}
              {offer.sake.region && (
                <Badge variant="secondary">{offer.sake.region}</Badge>
              )}
              {offer.sake.type && (
                <Badge variant="outline">{offer.sake.type}</Badge>
              )}
            </CardContent>
          </Card>

          {offer.preferenceMap?.axes?.length ? (
            <Card className="rounded-2xl sm:rounded-3xl border border-border/60">
              <CardHeader className="pb-2 sm:pb-3">
                <CardTitle className="text-lg sm:text-xl font-semibold">嗜好マップ</CardTitle>
                {offer.preferenceMap.summary && (
                  <CardDescription>{offer.preferenceMap.summary}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="flex justify-center">
                <PreferenceRadar
                  axes={offer.preferenceMap.axes}
                  size={260}
                  className="text-primary"
                />
              </CardContent>
            </Card>
          ) : null}

          <SakeDisplay
            sake={offer.sake}
            offer={offer}
            onReset={() => {}}
            showPreferenceMap={false}
            layout="section"
          />
        </div>
      </div>
    );
  }

  // Recommendation missing but status is ready/notified: show fallback
  if (gift.status === 'RECOMMEND_READY' || gift.status === 'NOTIFIED') {
    return (
      <div className="min-h-screen bg-background px-3 py-6 sm:px-6 sm:py-10">
        <div className="max-w-2xl mx-auto space-y-5 sm:space-y-6">
          <Card className="shadow-xl border-border/60 rounded-2xl sm:rounded-3xl">
            <CardHeader className="space-y-2">
              <div className="flex items-center gap-3">
                <Package className="h-6 w-6 text-primary" />
                <div>
                  <CardTitle className="text-lg sm:text-xl font-semibold">推薦結果を取得できませんでした</CardTitle>
                  <CardDescription>
                    {gift.recipient_first_name ?? '宛先未設定'} さんへの {gift.occasion ?? 'ギフト'}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertDescription className="text-sm">
                  推薦は完了していますが、詳細データの取得に失敗しました。数秒後に再読み込みすると解決する場合があります。
                </AlertDescription>
              </Alert>
              <div className="rounded-2xl border border-dashed border-border/60 bg-muted/30 px-4 py-3 text-sm text-muted-foreground space-y-1">
                <p>予算: {formatBudgetRange(gift)}</p>
                <p>作成日: {new Date(gift.created_at).toLocaleDateString('ja-JP')}</p>
                <p>ステータス: {statusLabels[gift.status as GiftStatusKey] ?? '完了'}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="default" onClick={() => window.location.reload()}>
                  再読み込み
                </Button>
                <Button variant="outline" onClick={() => router.push('/gift')}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  ギフト一覧に戻る
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return null;
}
