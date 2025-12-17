'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { GiftRecommendationRevealData } from '@/types/gift';

type Phase = 'teaser' | 'opening' | 'revealed';

function withHonorific(value: string) {
  const name = value.trim();
  if (!name) return name;
  if (/(さん|様|さま|先生|殿)$/.test(name)) {
    return name;
  }
  return `${name}さん`;
}

// Confetti that bursts out from inside the box
function Confetti({ index }: { index: number }) {
  // Random spread from center, going upward
  const xSpread = (Math.random() - 0.5) * 100;
  const yEnd = -60 - Math.random() * 60;
  const rotation = Math.random() * 720 - 360;
  const delay = Math.random() * 0.15;
  const colors = [
    'var(--primary-200)',
    'var(--primary-300)',
    'var(--primary-400)',
    'var(--accent)',
  ];
  const color = colors[index % colors.length];
  const size = 4 + Math.random() * 4;

  return (
    <motion.div
      className="absolute left-1/2 rounded-sm"
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        top: '20%',
      }}
      initial={{ opacity: 0, x: 0, y: 0, scale: 0, rotate: 0 }}
      animate={{
        opacity: [0, 1, 1, 0],
        x: [0, xSpread * 0.4, xSpread],
        y: [0, yEnd * 0.6, yEnd],
        scale: [0, 1, 0.6],
        rotate: [0, rotation],
      }}
      transition={{
        duration: 0.8,
        delay,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
    />
  );
}

function PresentBox({ phase }: { phase: Phase }) {
  const isOpened = phase !== 'teaser';
  const isOpening = phase === 'opening';

  // Generate confetti
  const confettiCount = 14;

  return (
    <div className="relative h-36 w-36 sm:h-40 sm:w-40 flex items-center justify-center">
      {/* Soft ambient glow */}
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 rounded-full"
        style={{
          background: 'radial-gradient(circle, var(--primary-200) 0%, transparent 70%)',
        }}
        animate={{
          opacity: isOpened ? 0.5 : 0.15,
          scale: isOpened ? 1.2 : 1,
        }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />

      {/* Confetti bursting from box */}
      {isOpening &&
        Array.from({ length: confettiCount }).map((_, i) => (
          <Confetti key={`confetti-${i}`} index={i} />
        ))}

      {/* Box container */}
      <div className="relative">
        {/* Ground shadow */}
        <motion.div
          className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-20 h-3 rounded-full"
          style={{
            background: 'radial-gradient(ellipse, rgba(0,0,0,0.15) 0%, transparent 70%)',
          }}
        />

        {/* Box body */}
        <div className="relative w-24 h-20 sm:w-28 sm:h-24">
          {/* Box front face */}
          <div
            className="absolute inset-0 rounded-b-lg"
            style={{
              background: 'linear-gradient(180deg, var(--primary-400) 0%, var(--primary-500) 50%, var(--primary-600) 100%)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            }}
          >
            {/* Top highlight */}
            <div
              className="absolute top-0 left-0 right-0 h-1/3"
              style={{
                background: 'linear-gradient(180deg, rgba(255,255,255,0.2) 0%, transparent 100%)',
              }}
            />
          </div>

          {/* Vertical ribbon on box */}
          <div
            className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-4 z-10"
            style={{
              background: 'linear-gradient(90deg, var(--primary-200) 0%, var(--primary-300) 50%, var(--primary-200) 100%)',
            }}
          />

          {/* Horizontal ribbon on box */}
          <div
            className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-4 z-10"
            style={{
              background: 'linear-gradient(180deg, var(--primary-200) 0%, var(--primary-300) 50%, var(--primary-200) 100%)',
            }}
          />

          {/* Inner glow when opened */}
          <AnimatePresence>
            {isOpened && (
              <motion.div
                className="absolute inset-x-4 top-0 h-6 rounded-t"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{
                  background: 'linear-gradient(180deg, var(--primary-100) 0%, var(--primary-200) 50%, transparent 100%)',
                }}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Lid - pops up in 2D */}
        <motion.div
          className="absolute -top-1 left-1/2 -translate-x-1/2 w-[104px] h-7 sm:w-[120px] sm:h-8 z-20"
          animate={{
            y: isOpened ? -50 : 0,
            rotate: isOpened ? -8 : 0,
            opacity: isOpened ? 0 : 1,
          }}
          transition={{
            type: 'spring',
            stiffness: 300,
            damping: 20,
          }}
        >
          {/* Lid surface */}
          <div
            className="absolute inset-0 rounded-lg"
            style={{
              background: 'linear-gradient(180deg, var(--primary-300) 0%, var(--primary-400) 50%, var(--primary-500) 100%)',
              boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
            }}
          >
            {/* Shine */}
            <div
              className="absolute top-0 left-0 right-0 h-1/2 rounded-t-lg"
              style={{
                background: 'linear-gradient(180deg, rgba(255,255,255,0.3) 0%, transparent 100%)',
              }}
            />
          </div>

          {/* Lid ribbon (vertical) */}
          <div
            className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-4"
            style={{
              background: 'linear-gradient(90deg, var(--primary-200) 0%, var(--primary-300) 50%, var(--primary-200) 100%)',
            }}
          />

          {/* Ribbon bow on lid */}
          <div className="absolute left-1/2 -translate-x-1/2 -top-5">
            <svg width="36" height="24" viewBox="0 0 36 24" fill="none">
              {/* Left loop */}
              <ellipse cx="9" cy="10" rx="8" ry="6" fill="url(#bowGradient)" />
              {/* Right loop */}
              <ellipse cx="27" cy="10" rx="8" ry="6" fill="url(#bowGradient)" />
              {/* Center knot */}
              <circle cx="18" cy="11" r="5" fill="url(#knotGradient)" />
              {/* Tails */}
              <path d="M15 16 L12 23 L18 19 L24 23 L21 16" fill="url(#bowGradient)" />
              <defs>
                <linearGradient id="bowGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="var(--primary-200)" />
                  <stop offset="100%" stopColor="var(--primary-400)" />
                </linearGradient>
                <linearGradient id="knotGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="var(--primary-300)" />
                  <stop offset="100%" stopColor="var(--primary-500)" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </motion.div>
      </div>

      {/* Subtle pulse indicator in teaser state */}
      {phase === 'teaser' && (
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            border: '2px solid var(--primary-300)',
            opacity: 0,
          }}
          animate={{
            scale: [0.9, 1.05, 0.9],
            opacity: [0, 0.4, 0],
          }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}
    </div>
  );
}

export default function GiftRecommendationReveal({ reveal }: { reveal: GiftRecommendationRevealData }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const stickyTestMode =
    process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_GIFT_REVEAL_STICKY === '1';

  const [visible, setVisible] = useState(true);
  const [phase, setPhase] = useState<Phase>('teaser');
  const openingTimerRef = useRef<number | null>(null);
  const markedReadRef = useRef(false);

  const headline = useMemo(() => {
    const recipient = reveal.recipientName ? withHonorific(reveal.recipientName) : '大切な方';
    const occasion = reveal.occasion?.trim() ? reveal.occasion.trim() : 'ギフト';
    return `${recipient}への${occasion}のプレゼントは？`;
  }, [reveal.occasion, reveal.recipientName]);

  const markReadOnce = useCallback(async () => {
    if (stickyTestMode) return;
    if (markedReadRef.current) return;
    markedReadRef.current = true;
    try {
      await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: reveal.notificationId }),
      });
    } catch (error) {
      console.warn('Failed to mark recommendation notification read', error);
    }
  }, [reveal.notificationId, stickyTestMode]);

  const handleOpen = useCallback(() => {
    if (phase !== 'teaser') return;
    setPhase('opening');
    void markReadOnce();

    if (openingTimerRef.current != null) {
      window.clearTimeout(openingTimerRef.current);
      openingTimerRef.current = null;
    }

    const delayMs = reduceMotion ? 0 : 700;
    openingTimerRef.current = window.setTimeout(() => {
      setPhase('revealed');
    }, delayMs);
  }, [markReadOnce, phase, reduceMotion]);

  const handleClose = useCallback(() => {
    if (openingTimerRef.current != null) {
      window.clearTimeout(openingTimerRef.current);
      openingTimerRef.current = null;
    }
    if (stickyTestMode) {
      setPhase('teaser');
      return;
    }
    setVisible(false);
  }, [stickyTestMode]);

  const handleOpenDetail = useCallback(() => {
    void markReadOnce();
    router.push(`/gift/result/${reveal.giftId}`);
  }, [markReadOnce, reveal.giftId, router]);

  useEffect(() => {
    return () => {
      if (openingTimerRef.current != null) {
        window.clearTimeout(openingTimerRef.current);
      }
    };
  }, []);

  return (
    <AnimatePresence initial={false}>
      {visible ? (
        <motion.section
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
        >
          <Card className="overflow-hidden rounded-2xl sm:rounded-3xl border border-border/60 bg-card/80 backdrop-blur shadow-lg">
            <CardContent className="relative p-5 sm:p-6">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-primary/10 blur-3xl"
              />

              <div className="relative flex flex-col sm:flex-row items-center gap-5 sm:gap-6">
                <motion.button
                  type="button"
                  onClick={handleOpen}
                  disabled={phase !== 'teaser'}
                  className={cn(
                    'shrink-0 rounded-3xl focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40',
                    phase === 'teaser'
                      ? 'cursor-pointer'
                      : 'cursor-default opacity-90',
                  )}
                  whileTap={phase === 'teaser' ? { scale: 0.98 } : undefined}
                  aria-label="新しい推薦を開封する"
                >
                  <PresentBox phase={phase} />
                </motion.button>

                <div className="min-w-0 flex-1 text-center sm:text-left space-y-2">
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <Badge className="bg-primary/10 text-primary border border-primary/20">NEW</Badge>
                    <span className="text-xs text-muted-foreground">新しい推薦が届きました</span>
                    {stickyTestMode ? (
                      <span className="text-[10px] text-muted-foreground">(テスト: 未開封のまま)</span>
                    ) : null}
                  </div>
                  <h2 className="text-xl sm:text-2xl font-semibold tracking-tight wrap-break-word">
                    {headline}
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {phase === 'teaser'
                      ? 'プレゼントボックスをタップして開封しましょう。'
                      : phase === 'opening'
                        ? '開封中...'
                        : 'おすすめの一本をお届けします。'}
                  </p>
                  {phase === 'teaser' ? (
                    <div className="pt-1 flex justify-center sm:justify-start">
                      <Button onClick={handleOpen} className="shadow-sm">
                        開ける
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>

              <AnimatePresence initial={false}>
                {phase === 'revealed' ? (
                  <motion.div
                    key="reveal-card"
                    initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
                    animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="relative mt-5 sm:mt-6"
                  >
                    <Card className="rounded-2xl border border-border/60 bg-background/80">
                      <CardHeader className="space-y-2 pb-3">
                        <CardTitle className="text-lg sm:text-xl font-semibold">
                          {reveal.sakeName?.trim() ? reveal.sakeName.trim() : 'おすすめの一本'}
                        </CardTitle>
                        {reveal.summary?.trim() ? (
                          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                            {reveal.summary.trim()}
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            ギフトにぴったりな一本を選びました。詳細で確認できます。
                          </p>
                        )}
                      </CardHeader>
                      <CardContent className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                          <Button onClick={handleOpenDetail} className="w-full sm:w-auto">
                            詳細を見る
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                          <Button variant="outline" onClick={handleClose} className="w-full sm:w-auto">
                            閉じる
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.section>
      ) : null}
    </AnimatePresence>
  );
}
