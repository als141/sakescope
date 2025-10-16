'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Settings, Volume2, Sparkles } from 'lucide-react';
import Link from 'next/link';
import VoiceChat from '@/components/VoiceChat';
import SakeDisplay from '@/components/SakeDisplay';
import SakeHistory from '@/components/SakeHistory';
import { SakeHistoryStorage, type SakeHistoryItem } from '@/infrastructure/storage/sakeHistoryStorage';
import type { Sake, PurchaseOffer } from '@/domain/sake/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [recommendedSake, setRecommendedSake] = useState<Sake | null>(null);
  const [purchaseOffer, setPurchaseOffer] = useState<PurchaseOffer | null>(null);
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
    } catch {}
  }, []);

  // Deterministic RNG to avoid hydration mismatches
  function mulberry32(a: number) {
    return function () {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const seeded = mulberry32(20250907);
  const orbs = Array.from({ length: 5 }).map(() => {
    const width = seeded() * 200 + 50;
    const height = seeded() * 200 + 50;
    const left = `${(seeded() * 100).toFixed(6)}%`;
    const top = `${(seeded() * 100).toFixed(6)}%`;
    const duration = seeded() * 10 + 10;
    const deltaX = seeded() * 400 - 200;
    const deltaY = seeded() * 400 - 200;
    return { width, height, left, top, duration, deltaX, deltaY };
  });

  const isCompactMode = Boolean(recommendedSake);
  const voiceChatVariant = isCompactMode ? 'compact' : 'full';
  const voiceChatContainerClass = isCompactMode
    ? 'pointer-events-auto fixed bottom-6 right-4 z-40 w-full max-w-sm sm:right-8 sm:bottom-8'
    : 'pointer-events-auto relative mt-12 w-full max-w-2xl mx-auto';

  return (
    <div className="min-h-screen relative overflow-hidden bg-background">
      {/* Animated Background */}
      <div className="fixed inset-0 -z-10">
        {/* Gradient Overlay */}
        <motion.div
          className="absolute inset-0 opacity-30"
          animate={{
            background: [
              'radial-gradient(circle at 20% 80%, oklch(0.68 0.15 70) 0%, transparent 50%)',
              'radial-gradient(circle at 80% 20%, oklch(0.78 0.12 60) 0%, transparent 50%)',
              'radial-gradient(circle at 40% 40%, oklch(0.68 0.15 70) 0%, transparent 50%)',
            ],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
        
        {/* Floating Orbs */}
        {orbs.map((o, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-gradient-to-br from-primary/20 to-primary/10 blur-3xl"
            style={{
              width: o.width,
              height: o.height,
              left: o.left,
              top: o.top,
            }}
            animate={{
              x: [0, o.deltaX],
              y: [0, o.deltaY],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: o.duration,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        ))}

        {/* Grid Pattern */}
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(to right, currentColor 1px, transparent 1px),
                            linear-gradient(to bottom, currentColor 1px, transparent 1px)`,
            backgroundSize: '4rem 4rem',
          }}
        />
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-screen px-6 sm:px-8 lg:px-12 overflow-hidden">
        {/* History Panel */}
        <SakeHistory
          onSelectSake={(item: SakeHistoryItem) => {
            setRecommendedSake(item.sake);
            setPurchaseOffer(item.offer);
          }}
        />

        {/* Header */}
        <motion.header
          className="absolute top-0 left-0 right-0 z-50"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="w-full max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 xl:px-16 py-6 sm:py-8 lg:py-10 flex justify-between items-center">
            {/* ロゴエリア */}
            <motion.div
              className="flex items-center gap-3 sm:gap-4"
              whileHover={{ scale: 1.02 }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              <div className="rounded-2xl bg-primary/10 p-2.5 sm:p-3 backdrop-blur-sm border border-primary/20 shadow-sm">
                <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold gradient-text tracking-tight">
                Sakescope
              </h1>
            </motion.div>
            
            {/* 右側ナビゲーション */}
            <div className="flex items-center gap-3 sm:gap-4">
              <Link href="/settings">
                <Button
                  variant="outline"
                  size="icon-lg"
                  className="backdrop-blur-sm bg-background/50 border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all duration-300 shadow-sm"
                >
                  <Settings className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </motion.header>

        {/* Main Interface */}
        <AnimatePresence mode="wait">
          {!recommendedSake ? (
            <motion.div
              key="voice-interface"
              className="text-center space-y-8 sm:space-y-10 lg:space-y-12 max-w-4xl px-4 sm:px-0"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4 }}
            >
              {/* Welcome Message */}
              <motion.div
                className="space-y-6 sm:space-y-8 lg:space-y-10"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.6, ease: "easeOut" }}
              >
                {/* バッジ */}
                <motion.div
                  className="inline-flex"
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Badge 
                    variant="default" 
                    size="lg"
                    className="px-6 py-2.5 text-sm font-medium shadow-md"
                  >
                    <Sparkles className="h-4 w-4" />
                    AI搭載の日本酒ソムリエ
                  </Badge>
                </motion.div>

                {/* メインヘッドライン */}
                <div className="space-y-4 sm:space-y-6">
                  <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-[1.1] tracking-tight">
                    <span className="gradient-text block mb-2">最高の一杯を</span>
                    <span className="gradient-text block">一緒に見つけましょう</span>
                  </h2>

                  <p className="text-sm sm:text-base md:text-lg lg:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed font-light px-4">
                    AIソムリエとの音声対話を通じて、
                    <br className="hidden sm:inline" />
                    あなたの好みにぴったりの日本酒をお探しします
                  </p>
                </div>
              </motion.div>

              {/* Features */}
              <motion.div
                className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 pt-4 sm:pt-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.6 }}
              >
                {[
                  { icon: Mic, label: "音声で対話" },
                  { icon: Volume2, label: "AIが応答" },
                  { icon: Sparkles, label: "最適な日本酒を提案" },
                ].map((feature, index) => (
                  <React.Fragment key={feature.label}>
                    <Badge 
                      variant="outline" 
                      size="default"
                      className="px-3 sm:px-4 py-2 gap-2 shadow-sm backdrop-blur-md bg-card/50 hover:bg-card/80 transition-all duration-300"
                    >
                      <feature.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                      <span className="text-xs font-medium text-foreground">
                        {feature.label}
                      </span>
                    </Badge>
                    {index < 2 && (
                      <div className="hidden sm:block h-1.5 w-1.5 rounded-full bg-primary/30" />
                    )}
                  </React.Fragment>
                ))}</motion.div>
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
