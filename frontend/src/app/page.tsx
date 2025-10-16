'use client';

import { useState, useEffect } from 'react';
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
  const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(null);
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
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 sm:px-6 lg:px-8">
        {/* History Panel */}
        <SakeHistory
          onSelectSake={(item: SakeHistoryItem) => {
            setRecommendedSake(item.sake);
            setPurchaseOffer(item.offer);
            setCurrentHistoryId(item.id);
          }}
        />

        {/* Header */}
        <motion.header
          className="absolute top-0 left-0 right-0 px-6 py-6 flex justify-between items-center sm:px-10 sm:py-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div
            className="flex items-center gap-3"
            whileHover={{ scale: 1.02 }}
          >
            <div className="rounded-full bg-primary/10 p-2">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold gradient-text">
              Sakescope
            </h1>
          </motion.div>
          
          <Link href="/settings">
            <Button
              variant="outline"
              size="icon"
              className="rounded-full h-11 w-11 shadow-lg hover:shadow-xl transition-all hover:scale-105"
            >
              <Settings className="h-5 w-5" />
            </Button>
          </Link>
        </motion.header>

        {/* Main Interface */}
        <AnimatePresence mode="wait">
          {!recommendedSake ? (
            <motion.div
              key="voice-interface"
              className="text-center space-y-12 max-w-3xl"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4 }}
            >
              {/* Welcome Message */}
              <motion.div
                className="space-y-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
              >
                <motion.div
                  className="inline-flex"
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Badge variant="secondary" className="px-4 py-1.5 text-sm">
                    <Sparkles className="mr-2 h-3.5 w-3.5" />
                    AI搭載の日本酒ソムリエ
                  </Badge>
                </motion.div>

                <h2 className="text-4xl sm:text-6xl lg:text-7xl font-bold leading-tight">
                  <span className="gradient-text block">最高の一杯を</span>
                  <span className="gradient-text block">一緒に見つけましょう</span>
                </h2>

                <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                  AIソムリエとの音声対話を通じて、<br className="hidden sm:inline" />
                  あなたの好みにぴったりの日本酒をお探しします
                </p>
              </motion.div>

              {/* Features */}
              <motion.div
                className="flex flex-col sm:flex-row items-center justify-center gap-4 text-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.5 }}
              >
                <Badge variant="outline" className="px-4 py-2.5 gap-2 shadow-sm backdrop-blur-sm bg-card/50">
                  <Mic className="h-4 w-4 text-primary" />
                  <span className="text-muted-foreground">音声で対話</span>
                </Badge>
                <div className="hidden sm:block h-1 w-1 rounded-full bg-border" />
                <Badge variant="outline" className="px-4 py-2.5 gap-2 shadow-sm backdrop-blur-sm bg-card/50">
                  <Volume2 className="h-4 w-4 text-primary" />
                  <span className="text-muted-foreground">AIが応答</span>
                </Badge>
                <div className="hidden sm:block h-1 w-1 rounded-full bg-border" />
                <Badge variant="outline" className="px-4 py-2.5 gap-2 shadow-sm backdrop-blur-sm bg-card/50">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-muted-foreground">最適な日本酒を提案</span>
                </Badge>
              </motion.div>
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
              setCurrentHistoryId(null);
            }}
            onOfferReady={(offer) => {
              setRecommendedSake(offer.sake);
              setPurchaseOffer(offer);
              // 履歴に保存
              SakeHistoryStorage.addToHistory(offer.sake, offer);
              setCurrentHistoryId(null);
            }}
            preferences={preferences || undefined}
          />
        </div>

        {/* Footer */}
        {!recommendedSake && (
          <motion.footer
            className="absolute bottom-0 left-0 right-0 px-6 py-8 text-center sm:px-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.5 }}
          >
            <p className="text-sm text-muted-foreground/60">
              Powered by OpenAI Realtime API • 日本酒の新しい体験
            </p>
          </motion.footer>
        )}
      </div>
    </div>
  );
}
