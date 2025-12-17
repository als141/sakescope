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
              className="absolute top-0 left-0 right-0 h-1/4"
              style={{
                background:
                  'linear-gradient(135deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.06) 40%, transparent 70%)',
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
                className="absolute inset-x-4 top-0 h-5 rounded-t"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{
                  background:
                    'linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.08) 55%, transparent 100%)',
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
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, var(--primary-300) 0%, var(--primary-400) 30%, var(--primary-500) 100%)',
              boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
            }}
          />

          {/* Lid ribbon (vertical) */}
          <div
            className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-4"
            style={{
              background: 'linear-gradient(90deg, var(--primary-200) 0%, var(--primary-300) 50%, var(--primary-200) 100%)',
            }}
          />

          {/* Ribbon bow on lid */}
          <div className="absolute left-1/2 -translate-x-1/2 -top-8 -z-10">
            <svg width="72" height="44" viewBox="0 0 72 44" fill="none">
              <defs>
                {/* Main ribbon gradient - silk-like sheen */}
                <linearGradient id="ribbonMain" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="var(--primary-200)" />
                  <stop offset="35%" stopColor="var(--primary-300)" />
                  <stop offset="65%" stopColor="var(--primary-400)" />
                  <stop offset="100%" stopColor="var(--primary-300)" />
                </linearGradient>
                {/* Shadow side of ribbon */}
                <linearGradient id="ribbonShadow" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="var(--primary-400)" />
                  <stop offset="100%" stopColor="var(--primary-500)" />
                </linearGradient>
                {/* Highlight for ribbon folds */}
                <linearGradient id="ribbonHighlight" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="var(--primary-100)" />
                  <stop offset="50%" stopColor="var(--primary-200)" />
                  <stop offset="100%" stopColor="var(--primary-100)" />
                </linearGradient>
                {/* Knot gradient */}
                <radialGradient id="knotGrad" cx="30%" cy="30%" r="70%">
                  <stop offset="0%" stopColor="var(--primary-200)" />
                  <stop offset="50%" stopColor="var(--primary-400)" />
                  <stop offset="100%" stopColor="var(--primary-500)" />
                </radialGradient>
                {/* Tail gradients */}
                <linearGradient id="tailLeftGrad" x1="100%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="var(--primary-300)" />
                  <stop offset="40%" stopColor="var(--primary-400)" />
                  <stop offset="70%" stopColor="var(--primary-300)" />
                  <stop offset="100%" stopColor="var(--primary-400)" />
                </linearGradient>
                <linearGradient id="tailRightGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="var(--primary-300)" />
                  <stop offset="40%" stopColor="var(--primary-400)" />
                  <stop offset="70%" stopColor="var(--primary-300)" />
                  <stop offset="100%" stopColor="var(--primary-400)" />
                </linearGradient>
              </defs>

              {/* === Left ribbon tail === */}
              {/* Back layer of left tail */}
              <path
                d="M32 22
                   C28 24, 24 28, 18 32
                   C14 35, 10 38, 6 42
                   L4 40
                   C8 36, 12 32, 16 28
                   C20 25, 26 22, 30 20
                   Z"
                fill="url(#ribbonShadow)"
              />
              {/* Front layer of left tail with twist */}
              <path
                d="M34 22
                   C30 25, 26 30, 20 34
                   C16 37, 11 40, 8 43
                   L6 42
                   C10 38, 15 34, 19 30
                   C24 26, 29 23, 32 21
                   Z"
                fill="url(#tailLeftGrad)"
              />
              {/* Left tail end - V cut */}
              <path
                d="M4 40 L6 42 L8 43 L5 44 L2 42 Z"
                fill="var(--primary-400)"
              />

              {/* === Right ribbon tail === */}
              {/* Back layer of right tail */}
              <path
                d="M40 22
                   C44 24, 48 28, 54 32
                   C58 35, 62 38, 66 42
                   L68 40
                   C64 36, 60 32, 56 28
                   C52 25, 46 22, 42 20
                   Z"
                fill="url(#ribbonShadow)"
              />
              {/* Front layer of right tail with twist */}
              <path
                d="M38 22
                   C42 25, 46 30, 52 34
                   C56 37, 61 40, 64 43
                   L66 42
                   C62 38, 57 34, 53 30
                   C48 26, 43 23, 40 21
                   Z"
                fill="url(#tailRightGrad)"
              />
              {/* Right tail end - V cut */}
              <path
                d="M68 40 L66 42 L64 43 L67 44 L70 42 Z"
                fill="var(--primary-400)"
              />

              {/* === Left loop === */}
              {/* Back part of left loop (darker, behind) */}
              <path
                d="M32 14
                   C26 10, 16 4, 8 6
                   C2 8, 0 14, 4 18
                   C8 22, 18 20, 28 16
                   L32 14"
                fill="url(#ribbonShadow)"
              />
              {/* Front part of left loop (main visible surface) */}
              <path
                d="M34 16
                   C28 12, 18 6, 10 8
                   C4 10, 2 15, 6 19
                   C10 23, 22 20, 32 17
                   L34 16"
                fill="url(#ribbonMain)"
              />
              {/* Left loop highlight edge */}
              <path
                d="M32 15
                   C26 11, 18 7, 12 9
                   C8 10, 6 13, 7 16"
                stroke="var(--primary-100)"
                strokeWidth="1"
                fill="none"
                opacity="0.6"
              />

              {/* === Right loop === */}
              {/* Back part of right loop (darker, behind) */}
              <path
                d="M40 14
                   C46 10, 56 4, 64 6
                   C70 8, 72 14, 68 18
                   C64 22, 54 20, 44 16
                   L40 14"
                fill="url(#ribbonShadow)"
              />
              {/* Front part of right loop (main visible surface) */}
              <path
                d="M38 16
                   C44 12, 54 6, 62 8
                   C68 10, 70 15, 66 19
                   C62 23, 50 20, 40 17
                   L38 16"
                fill="url(#ribbonMain)"
              />
              {/* Right loop highlight edge */}
              <path
                d="M40 15
                   C46 11, 54 7, 60 9
                   C64 10, 66 13, 65 16"
                stroke="var(--primary-100)"
                strokeWidth="1"
                fill="none"
                opacity="0.6"
              />

              {/* === Center knot === */}
              {/* Knot shadow */}
              <ellipse cx="36" cy="18" rx="7" ry="5" fill="var(--primary-500)" opacity="0.3" />
              {/* Main knot shape - gathered fabric look */}
              <path
                d="M30 14
                   C32 12, 34 11, 36 11
                   C38 11, 40 12, 42 14
                   C44 16, 44 19, 42 21
                   C40 23, 38 24, 36 24
                   C34 24, 32 23, 30 21
                   C28 19, 28 16, 30 14
                   Z"
                fill="url(#knotGrad)"
              />
              {/* Knot highlight */}
              <path
                d="M33 13 C35 12, 37 12, 39 13"
                stroke="var(--primary-100)"
                strokeWidth="1.5"
                fill="none"
                opacity="0.5"
                strokeLinecap="round"
              />
              {/* Knot center fold */}
              <path
                d="M34 17 C36 19, 38 17"
                stroke="var(--primary-500)"
                strokeWidth="0.8"
                fill="none"
                opacity="0.4"
              />
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
