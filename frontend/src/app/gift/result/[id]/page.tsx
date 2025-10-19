'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, AlertCircle, Gift, ArrowLeft, ExternalLink, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/lib/supabase';
import type { Gift as GiftType, GiftRecommendation } from '@/types/gift';
import SakeDisplay from '@/components/SakeDisplay';
import type { Sake, PurchaseOffer } from '@/domain/sake/types';

export default function GiftResultPage() {
  const params = useParams();
  const router = useRouter();
  const giftId = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gift, setGift] = useState<GiftType | null>(null);
  const [recommendation, setRecommendation] = useState<GiftRecommendation | null>(null);
  const [offer, setOffer] = useState<PurchaseOffer | null>(null);

  useEffect(() => {
    async function loadGiftResult() {
      try {
        // Fetch gift data
        const { data: giftData, error: giftError } = await supabase
          .from('gifts')
          .select('*')
          .eq('id', giftId)
          .single();

        if (giftError || !giftData) {
          setError('ギフトが見つかりませんでした');
          setIsLoading(false);
          return;
        }

        setGift(giftData as GiftType);

        // Check if recommendation is ready
        if (giftData.status === 'RECOMMEND_READY' || giftData.status === 'NOTIFIED') {
          const { data: recData, error: recError } = await supabase
            .from('gift_recommendations')
            .select('*')
            .eq('gift_id', giftId)
            .single();

          if (!recError && recData) {
            setRecommendation(recData as GiftRecommendation);

            // Transform recommendation to PurchaseOffer format
            const recPayload = recData.recommendations as any;
            if (recPayload?.sake && recPayload?.shops) {
              const transformedOffer: PurchaseOffer = {
                sake: {
                  id: recPayload.sake.id || null,
                  name: recPayload.sake.name,
                  brewery: recPayload.sake.brewery || null,
                  region: recPayload.sake.region || null,
                  type: recPayload.sake.type || null,
                  alcohol: recPayload.sake.alcohol || null,
                  sakeValue: recPayload.sake.sake_value || null,
                  acidity: recPayload.sake.acidity || null,
                  description: recPayload.sake.description || null,
                  tastingNotes: recPayload.sake.tasting_notes || null,
                  foodPairing: recPayload.sake.food_pairing || null,
                  servingTemperature: recPayload.sake.serving_temperature || null,
                  imageUrl: recPayload.sake.image_url,
                  originSources: recPayload.sake.origin_sources || null,
                  priceRange: recPayload.sake.price_range || null,
                  flavorProfile: recPayload.sake.flavor_profile || null,
                },
                shops: recPayload.shops.map((shop: any) => ({
                  retailer: shop.retailer,
                  url: shop.url,
                  price: shop.price,
                  priceText: shop.price_text,
                  currency: shop.currency || 'JPY',
                  availability: shop.availability,
                  deliveryEstimate: shop.delivery_estimate,
                  source: shop.source,
                  notes: shop.notes,
                })),
                summary: recPayload.summary,
                reasoning: recPayload.reasoning,
                tastingHighlights: recPayload.tasting_highlights || null,
                servingSuggestions: recPayload.serving_suggestions || null,
              };
              setOffer(transformedOffer);
            }
          }

          // Mark notification as read
          await supabase
            .from('notifications')
            .update({ read_at: new Date().toISOString() })
            .eq('user_id', giftData.sender_user_id)
            .eq('type', 'gift_recommend_ready')
            .match({ 'payload->gift_id': giftId });

          // Update gift status to NOTIFIED
          if (giftData.status === 'RECOMMEND_READY') {
            await supabase
              .from('gifts')
              .update({ status: 'NOTIFIED' })
              .eq('id', giftId);
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

    // Subscribe to realtime updates
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
            <Button onClick={() => router.push('/')} className="w-full">
              ホームに戻る
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Waiting for recommendation
  if (gift.status !== 'RECOMMEND_READY' && gift.status !== 'NOTIFIED' && gift.status !== 'CLOSED') {
    const statusMessages: Record<string, string> = {
      LINK_CREATED: 'ギフトリンクを作成しました。相手がリンクにアクセスするのを待っています。',
      OPENED: '相手がリンクを開きました。',
      INTAKE_STARTED: '相手との会話が始まりました。',
      INTAKE_COMPLETED: '会話が完了しました。',
      HANDOFFED: '最適な日本酒を検索しています...',
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-full bg-primary/10 p-2">
                <Gift className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>ギフト推薦</CardTitle>
            </div>
            <CardDescription>
              {gift.occasion && `用途: ${gift.occasion}`}
              {gift.recipient_first_name && ` | 宛先: ${gift.recipient_first_name}さん`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center gap-4 py-6">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <div className="text-center space-y-2">
                <p className="font-medium">{statusMessages[gift.status] || '処理中...'}</p>
                <p className="text-sm text-muted-foreground">
                  推薦結果が準備でき次第、こちらに表示されます。
                </p>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">ギフト情報</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">予算範囲:</div>
                <div className="font-medium">¥{gift.budget_min.toLocaleString()} - ¥{gift.budget_max.toLocaleString()}</div>
                {gift.occasion && (
                  <>
                    <div className="text-muted-foreground">用途:</div>
                    <div className="font-medium">{gift.occasion}</div>
                  </>
                )}
                <div className="text-muted-foreground">作成日:</div>
                <div className="font-medium">{new Date(gift.created_at).toLocaleDateString('ja-JP')}</div>
              </div>
            </div>
            <Button onClick={() => router.push('/')} variant="outline" className="w-full">
              <ArrowLeft className="mr-2 h-4 w-4" />
              ホームに戻る
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show recommendation
  if (offer) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-7xl mx-auto px-4 py-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <Button
              onClick={() => router.push('/')}
              variant="ghost"
              className="mb-4"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              ホームに戻る
            </Button>
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-3">
                <Package className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">ギフト推薦結果</h1>
                <p className="text-muted-foreground">
                  {gift.recipient_first_name}さんへの{gift.occasion || 'ギフト'}におすすめの日本酒
                </p>
              </div>
            </div>
          </motion.div>

          <SakeDisplay
            sake={offer.sake}
            offer={offer}
            onReset={() => {}}
          />
        </div>
      </div>
    );
  }

  return null;
}
