'use client';

import React, { useState, useEffect } from 'react';
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, ArrowLeft, Gift } from 'lucide-react';
import Link from 'next/link';
import VoiceChat from '@/components/VoiceChat';
import SakeDisplay from '@/components/SakeDisplay';
import SakeHistory from '@/components/SakeHistory';
import { SakeHistoryStorage, type SakeHistoryItem } from '@/infrastructure/storage/sakeHistoryStorage';
import type { Sake, PurchaseOffer } from '@/domain/sake/types';
import { Button } from '@/components/ui/button';
import WatercolorBackground from '@/components/WatercolorBackground';


export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [recommendedSake, setRecommendedSake] = useState<Sake | null>(null);
  const [purchaseOffer, setPurchaseOffer] = useState<PurchaseOffer | null>(null);
  const [isVoiceChatMinimized, setIsVoiceChatMinimized] = useState(false);
  const [isVoiceConnected, setIsVoiceConnected] = useState(false);
  const [preferences, setPreferences] = useState<{
    flavor_preference?: string | null;
    body_preference?: string | null;
    price_range?: string | null;
    food_pairing?: string[];
    notes?: string | null;
  } | null>(null);

  useEffect(() => {
    try {
      const v = localStorage.getItem('sakePreferences');
      if (v) {
        const p = JSON.parse(v);
        setPreferences({
          flavor_preference: p.flavor_preference,
          body_preference: p.body_preference,
          price_range: p.price_range,
          food_pairing: Array.isArray(p.food_pairing) ? p.food_pairing : undefined,
          notes: typeof p.notes === 'string' ? p.notes : undefined,
        });
      }
    } catch { }
  }, []);



  const isCompactMode = Boolean(recommendedSake);
  const voiceChatVariant = isCompactMode ? 'compact' : 'full';
  const voiceChatContainerClass = isCompactMode
    ? 'pointer-events-auto fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-1.5rem)] max-w-sm sm:max-w-md sm:bottom-8 sm:left-auto sm:right-8 sm:translate-x-0'
    : 'pointer-events-auto relative mt-6 sm:mt-12 w-full max-w-full sm:max-w-2xl lg:max-w-3xl px-0 sm:px-0';

  return (
    <div className="min-h-screen relative overflow-hidden bg-background">
      <WatercolorBackground />

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 sm:px-8 lg:px-12 pt-24 pb-28 gap-10 sm:gap-14 overflow-hidden">
        {/* Header */}
        <motion.header
          className="absolute top-0 left-0 right-0 z-50"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="w-full max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 xl:px-16 py-5 sm:py-8 lg:py-10 flex flex-wrap items-start gap-3 sm:gap-4 justify-between">
            {/* 左側 - ロゴまたは戻るボタン */}
            {recommendedSake ? (
              <Button
                onClick={() => {
                  setRecommendedSake(null);
                  setPurchaseOffer(null);
                }}
                variant="ghost"
                size="lg"
                className="group -ml-1 sm:-ml-2"
              >
                <ArrowLeft className="mr-2 h-4 w-4 sm:h-5 sm:w-5 group-hover:-translate-x-1 transition-transform" />
                <span className="text-sm sm:text-base">他の日本酒を探す</span>
              </Button>
            ) : (
              <div className="flex flex-col items-start gap-2">
                <motion.div
                  className="flex items-center gap-3 sm:gap-4"
                  whileHover={{ scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 400 }}
                >
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold gradient-text tracking-tight">
                    Sakescope
                  </h1>
                </motion.div>
                <SakeHistory
                  placement="header"
                  onSelectSake={(item: SakeHistoryItem) => {
                    setRecommendedSake(item.sake);
                    setPurchaseOffer(item.offer);
                  }}
                />
              </div>
            )}

            {/* 右側ナビゲーション */}
            <div className="flex items-center gap-3 sm:gap-4">
              <SignedOut>
                <>
                  <SignInButton mode="modal">
                    <Button
                      variant="ghost"
                      size="default"
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Gift className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                      <span className="hidden sm:inline">ギフトを贈る</span>
                    </Button>
                  </SignInButton>
                  <SignUpButton mode="modal">
                    <Button className="h-10 sm:h-11 px-4 sm:px-6 shadow-none bg-foreground text-background hover:bg-foreground/90 transition-all duration-300 rounded-full">
                      無料登録
                    </Button>
                  </SignUpButton>
                </>
              </SignedOut>
              <SignedIn>
                <>
                  <Button
                    asChild
                    variant="ghost"
                    size="default"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Link href="/gift">
                      <Gift className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                      <span className="hidden sm:inline">ギフトを贈る</span>
                    </Link>
                  </Button>
                  <Link href="/settings">
                    <Button
                      variant="ghost"
                      size="icon-lg"
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Settings className="h-4 w-4 sm:h-5 sm:w-5" />
                    </Button>
                  </Link>
                  <UserButton
                    afterSignOutUrl="/"
                    appearance={{
                      elements: {
                        avatarBox:
                          'h-10 w-10 sm:h-11 sm:w-11 border border-border/50 rounded-full shadow-sm',
                      },
                    }}
                  />
                </>
              </SignedIn>
            </div>
          </div>
        </motion.header>

        {/* Main Interface */}
        <AnimatePresence mode="wait">
          {!recommendedSake ? (
            <motion.div
              key="voice-interface"
              className="text-center space-y-8 sm:space-y-10 lg:space-y-12 w-full max-w-3xl px-3 sm:px-6 mt-2 sm:mt-0 flex flex-col items-center"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4 }}
            >
              {/* Welcome Message - フェードアウト */}
              <AnimatePresence>
                {!isVoiceConnected && (
              <motion.div
                className="space-y-5 sm:space-y-8 lg:space-y-10"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -30, scale: 0.95 }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
              >

                {/* メインヘッドライン */}
                <div className="space-y-3 sm:space-y-6">
                  <h2 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.08] tracking-tighter px-2 sm:px-0">
                    <span className="gradient-text block mb-1 sm:mb-2">最高の一杯を</span>
                    <span className="gradient-text block">一緒に見つけましょう</span>
                  </h2>

                  <p className="text-base sm:text-lg md:text-xl text-muted-foreground/80 max-w-2xl mx-auto leading-relaxed font-light px-2 sm:px-4">
                    あなたの好みにぴったりの日本酒をお探しします
                  </p>
                </div>
              </motion.div>
            )}
              </AnimatePresence>
            </motion.div>
          ) : (
            <SakeDisplay
              sake={recommendedSake}
              offer={purchaseOffer}
              onReset={() => {
                setRecommendedSake(null);
                setPurchaseOffer(null);
              }}
            />
          )}
        </AnimatePresence>

        <div className={voiceChatContainerClass}>
          <VoiceChat
            variant={voiceChatVariant}
            isRecording={isRecording}
            setIsRecording={setIsRecording}
            isMinimized={isVoiceChatMinimized}
            onToggleMinimize={() => setIsVoiceChatMinimized(!isVoiceChatMinimized)}
            onConnectionChange={setIsVoiceConnected}
            onSakeRecommended={(sake) => {
              setRecommendedSake(sake);
              setPurchaseOffer(null);
            }}
            onOfferReady={(offer) => {
              setRecommendedSake(offer.sake);
              setPurchaseOffer(offer);
              // 履歴に保存
              SakeHistoryStorage.addToHistory(offer.sake, offer);
            }}
            preferences={preferences || undefined}
          />
        </div>

      </div>
    </div>
  );
}
