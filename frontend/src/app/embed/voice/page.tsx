'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageSquare } from 'lucide-react';
import VoiceChat from '@/components/VoiceChat';
import SakeDisplay from '@/components/SakeDisplay';
import type { Sake, PurchaseOffer } from '@/domain/sake/types';
import WatercolorBackground from '@/components/WatercolorBackground';
import { Button } from '@/components/ui/button';
import { createRealtimeEmbedVoiceBundle } from '@/infrastructure/openai/realtime/embedSessionFactory';
import { useSearchParams } from 'next/navigation';

function VoiceOnlyEmbedPageInner() {
  const searchParams = useSearchParams();
  const isWidgetMode = searchParams.get('mode') === 'widget';

  const [isRecording, setIsRecording] = useState(false);
  const [recommendedSake, setRecommendedSake] = useState<Sake | null>(null);
  const [purchaseOffer, setPurchaseOffer] = useState<PurchaseOffer | null>(null);
  const [isVoiceConnected, setIsVoiceConnected] = useState(false);

  // Send messages to parent window (for iframe embedding)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.parent !== window) {
      // Notify parent about connection status
      window.parent.postMessage({
        type: 'sakescope:connectionChange',
        connected: isVoiceConnected
      }, '*');
    }
  }, [isVoiceConnected]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.parent !== window && purchaseOffer) {
      // Notify parent when sake is recommended
      window.parent.postMessage({
        type: 'sakescope:sakeRecommended',
        sake: purchaseOffer.sake,
        offer: purchaseOffer
      }, '*');
    }
  }, [purchaseOffer]);

  const isCompactMode = Boolean(recommendedSake);
  const isVoiceSessionMobile = isVoiceConnected && !recommendedSake;
  const voiceChatVariant = isCompactMode ? 'compact' : 'full';
  const showHero = !recommendedSake && (!isVoiceConnected || isVoiceSessionMobile);

  const voiceChatContainerClass = isCompactMode
    ? 'pointer-events-auto fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-1.5rem)] max-w-sm sm:max-w-md sm:bottom-8 sm:left-auto sm:right-8 sm:translate-x-0'
    : isVoiceSessionMobile
      ? 'pointer-events-auto fixed inset-0 z-40 w-full h-[100dvh] bg-background flex flex-col overflow-hidden sm:relative sm:inset-auto sm:h-auto sm:mt-2 sm:max-w-4xl lg:max-w-5xl sm:bg-transparent'
      : isVoiceConnected
        ? 'pointer-events-auto relative mt-2 sm:mt-6 w-full max-w-full sm:max-w-4xl lg:max-w-5xl px-0 sm:px-2'
        : 'pointer-events-auto relative mt-6 sm:mt-6 w-full max-w-full sm:max-w-2xl lg:max-w-3xl px-0 sm:px-0';

  const voiceChatInnerClass = isVoiceSessionMobile ? 'flex-1 h-full flex' : '';

  const mainSpacingClass = isVoiceSessionMobile
    ? 'pt-0 pb-0 gap-0 sm:pt-14 sm:pb-18 sm:gap-10'
    : isVoiceConnected
      ? 'pt-12 pb-20 gap-8 sm:pt-10 sm:pb-18 sm:gap-10'
      : 'pt-14 pb-22 gap-8 sm:pt-10 sm:pb-16 sm:gap-8';

  const containerPaddingClass = isVoiceSessionMobile
    ? 'px-0 sm:px-8 lg:px-12'
    : 'px-4 sm:px-8 lg:px-12';

  return (
    <div className="min-h-screen relative overflow-hidden bg-background">
      {!isWidgetMode && <WatercolorBackground />}

      <div
        className={`relative z-10 flex flex-col items-center justify-center min-h-screen ${containerPaddingClass} ${mainSpacingClass} overflow-hidden`}
      >
        {!isWidgetMode && (
          <motion.header
            className="absolute top-0 left-0 right-0 z-50"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="relative w-full max-w-6xl mx-auto px-5 sm:px-8 lg:px-12 py-5 sm:py-7 lg:py-9 flex items-center justify-between">
              <motion.div
                className="flex items-center gap-3 sm:gap-4"
                whileHover={{ scale: 1.02 }}
                transition={{ type: 'spring', stiffness: 400 }}
              >
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold gradient-text tracking-tight">
                  Sakescope
                </h1>
              </motion.div>

              <Button
                asChild
                variant="ghost"
                size="icon-lg"
                className="h-11 w-11 sm:h-12 sm:w-12 border border-border/40 bg-background/60 hover:bg-background/90 shadow-sm"
              >
                <Link href="/text-chat" aria-label="チャットへ移動">
                  <MessageSquare className="h-5 w-5" />
                </Link>
              </Button>
            </div>
          </motion.header>
        )}

        {/* ヒーロー（モバイルのみ上部に表示） */}
        {!isWidgetMode && (
          <AnimatePresence mode="wait">
            {showHero ? (
              <motion.div
                key="hero-mobile"
                className="sm:hidden text-center space-y-6 w-full max-w-3xl px-3 sm:px-6 mt-6 flex flex-col items-center"
                initial={{ opacity: 0, scale: 0.96, y: 14 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: -14 }}
                transition={{ duration: 0.35 }}
              >
                <h2 className="text-3xl font-bold leading-[1.08] tracking-tight">
                  <span className="gradient-text block mb-2">最高の一杯を</span>
                  <span className="gradient-text block">会話だけで見つける</span>
                </h2>
                <p className="text-base text-muted-foreground/80 max-w-2xl mx-auto leading-relaxed font-light">
                  マイクを押して話しかけるだけ。テキスト画面への切り替えなしで、リアルタイムの音声ソムリエと対話できます。
                </p>
              </motion.div>
            ) : null}
          </AnimatePresence>
        )}

        {/* 会話コンポーネントを最優先で配置 */}
        <div className={voiceChatContainerClass}>
          <div className={voiceChatInnerClass}>
            <VoiceChat
              variant={voiceChatVariant}
              isRecording={isRecording}
              setIsRecording={setIsRecording}
              onConnectionChange={setIsVoiceConnected}
              onSakeRecommended={(sake) => {
                setRecommendedSake(sake);
                setPurchaseOffer(null);
              }}
              onOfferReady={(offer) => {
                setRecommendedSake(offer.sake);
                setPurchaseOffer(offer);
              }}
              fullscreenMobile={isVoiceSessionMobile}
              clientSecretPath="/api/client-secret?variant=embed"
              createSessionBundle={createRealtimeEmbedVoiceBundle}
            />
          </div>
        </div>

        {/* レコメンド結果は会話ボックスの下に配置し、レイアウトを押し上げない */}
        <AnimatePresence mode="wait">
          {recommendedSake ? (
            <motion.div
              key="sake-display"
              className="w-full max-w-4xl px-4 sm:px-0 mt-8 sm:mt-10"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <SakeDisplay
                sake={recommendedSake}
                offer={purchaseOffer}
                variant="embed"
                onReset={() => {
                  setRecommendedSake(null);
                  setPurchaseOffer(null);
                }}
                showPreferenceMap
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function VoiceOnlyEmbedPage() {
  // Next.js 15 では useSearchParams を含むツリーを Suspense でラップする必要がある
  return (
    <Suspense fallback={null}>
      <VoiceOnlyEmbedPageInner />
    </Suspense>
  );
}
