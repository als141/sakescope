'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  MicOff,
  MessageSquare,
  Loader2,
  PhoneOff,
  Activity,
} from 'lucide-react';
import type {
  RealtimeSession,
  RealtimeSessionEventTypes,
  TransportEvent,
} from '@openai/agents-realtime';
import { Sake, PurchaseOffer } from '@/domain/sake/types';
import {
  createRealtimeVoiceBundle,
  type VoiceAgentBundle,
} from '@/infrastructure/openai/realtime/sessionFactory';
import type {
  AgentRuntimeContext,
  AgentUserPreferences,
} from '@/infrastructure/openai/agents/context';
import type { TextWorkerProgressEvent } from '@/types/textWorker';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface VoiceChatProps {
  isRecording: boolean;
  setIsRecording: (recording: boolean) => void;
  onSakeRecommended: (sake: Sake) => void;
  onOfferReady?: (offer: PurchaseOffer) => void;
  onConnectionChange?: (isConnected: boolean) => void;
  preferences?: {
    flavor_preference?: string | null;
    body_preference?: string | null;
    price_range?: string | null;
    food_pairing?: string[];
    notes?: string | null;
  };
  variant?: 'full' | 'compact';
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
}

const preferenceValueLabels: Record<string, string> = {
  dry: '辛口',
  sweet: '甘口',
  balanced: 'バランス型',
  light: '軽やか',
  medium: '中程度',
  rich: '濃厚',
  budget: '手頃な価格帯',
  mid: '標準的な価格帯',
  premium: '高級帯',
};

const describePreferenceValue = (value?: string | null): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return preferenceValueLabels[trimmed] ?? trimmed;
};

function extractErrorMessage(input: unknown, seen = new Set<unknown>()): string | undefined {
  if (input == null) return undefined;
  if (typeof input === 'string') return input;
  if (typeof input === 'number' || typeof input === 'boolean') {
    return String(input);
  }
  if (typeof input !== 'object') return undefined;
  if (seen.has(input)) return undefined;
  seen.add(input);

  if (Array.isArray(input)) {
    for (const item of input) {
      const msg = extractErrorMessage(item, seen);
      if (msg) return msg;
    }
    return undefined;
  }

  const record = input as Record<string, unknown>;
  for (const key of ['message', 'error', 'details', 'reason']) {
    if (key in record) {
      const msg = extractErrorMessage(record[key], seen);
      if (msg) return msg;
    }
  }

  for (const value of Object.values(record)) {
    const msg = extractErrorMessage(value, seen);
    if (msg) return msg;
  }

  return undefined;
}

export default function VoiceChat({
  isRecording,
  setIsRecording,
  onSakeRecommended,
  onOfferReady,
  onConnectionChange,
  preferences,
  variant = 'full',
  isMinimized = false,
  onToggleMinimize,
}: VoiceChatProps) {
  const realtimeModel =
    process.env.NEXT_PUBLIC_OPENAI_REALTIME_MODEL ?? 'gpt-realtime-mini';
  const sessionRef = useRef<RealtimeSession<AgentRuntimeContext> | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [aiMessages, setAiMessages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDelegating, setIsDelegating] = useState(false);
  const [progressEvents, setProgressEvents] = useState<TextWorkerProgressEvent[]>([]);

  const bundleRef = useRef<VoiceAgentBundle | null>(null);
  const onSakeRecommendedRef = useRef(onSakeRecommended);
  const onOfferReadyRef = useRef(onOfferReady);
  const latestSakeRef = useRef<Sake | null>(null);
  const preferencesRef = useRef(preferences);
  const assistantMessageIdsRef = useRef<Set<string>>(new Set());
  const isCompact = variant === 'compact';
  const isRecordingRef = useRef(isRecording);
  const autoMutedRef = useRef(false);
  const setIsRecordingStateRef = useRef(setIsRecording);

  const formatProgressTime = (timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      if (Number.isNaN(date.getTime())) {
        return '';
      }
      return date.toLocaleTimeString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const progressAccent = (type: TextWorkerProgressEvent['type']): string => {
    switch (type) {
      case 'tool_started':
        return 'text-amber-500';
      case 'tool_completed':
      case 'final':
        return 'text-emerald-500';
      case 'tool_failed':
      case 'error':
        return 'text-destructive';
      case 'reasoning':
        return 'text-sky-500';
      case 'message':
        return 'text-muted-foreground';
      default:
        return 'text-primary';
    }
  };

  useEffect(() => {
    onSakeRecommendedRef.current = onSakeRecommended;
  }, [onSakeRecommended]);

  useEffect(() => {
    onOfferReadyRef.current = onOfferReady;
  }, [onOfferReady]);

  useEffect(() => {
    preferencesRef.current = preferences;
  }, [preferences]);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    setIsRecordingStateRef.current = setIsRecording;
  }, [setIsRecording]);

  useEffect(() => {
    if (bundleRef.current) {
      return;
    }

    const pushSakeUpdate = (update: Sake) => {
      const current = latestSakeRef.current ?? null;
      const merged: Sake = {
        ...(current ?? {}),
        ...update,
        flavorProfile: update.flavorProfile ?? current?.flavorProfile,
        tastingNotes: update.tastingNotes ?? current?.tastingNotes,
        foodPairing: update.foodPairing ?? current?.foodPairing,
        servingTemperature: update.servingTemperature ?? current?.servingTemperature,
        originSources: update.originSources ?? current?.originSources,
        priceRange: update.priceRange ?? current?.priceRange,
        imageUrl: update.imageUrl ?? current?.imageUrl,
      } as Sake;
      latestSakeRef.current = merged;
      onSakeRecommendedRef.current(merged);
    };

    const bundle = createRealtimeVoiceBundle({
      onSakeProfile: (sake) => {
        pushSakeUpdate(sake);
      },
      onShopsUpdated: () => {
        setIsDelegating(true);
      },
      onOfferReady: (offer) => {
        pushSakeUpdate(offer.sake);
        setIsDelegating(false);
        if (autoMutedRef.current && sessionRef.current) {
          autoMutedRef.current = false;
          try {
            sessionRef.current.mute(false);
          } catch (err) {
            console.error('Failed to unmute after delegation:', err);
          }
          setIsRecordingStateRef.current(true);
        }
        onOfferReadyRef.current?.(offer);
      },
      onProgressEvent: (event) => {
        if (event.label === 'connected') {
          return;
        }
        setProgressEvents((prev) => {
          if (event.type === 'status' && event.label === 'テキスト調査') {
            return [event];
          }
          const next = [...prev, event];
          if (next.length > 15) {
            next.splice(0, next.length - 15);
          }
          return next;
        });
      },
      onError: (message) => {
        setError(message);
        setIsDelegating(false);
      },
    });

    bundleRef.current = bundle;
    sessionRef.current = bundle.session;

    const prefSeed = preferencesRef.current;
    if (prefSeed) {
      const normalizedPrefs: AgentUserPreferences = {
        flavorPreference: prefSeed.flavor_preference ?? null,
        bodyPreference: prefSeed.body_preference ?? null,
        priceRange: prefSeed.price_range ?? null,
        foodPairing: prefSeed.food_pairing ?? null,
        notes: prefSeed.notes ?? null,
      };
      const runtimeContext = bundle.session.context.context as AgentRuntimeContext;
      runtimeContext.session.userPreferences = normalizedPrefs;
    }

    type SessionEvents = RealtimeSessionEventTypes<AgentRuntimeContext>;

    bundle.session.on('transport_event', (event: TransportEvent) => {
      void event;
    });

    const extractAssistantTranscript = (item: unknown): string | null => {
      if (!item || typeof item !== 'object') {
        return null;
      }
      const record = item as Record<string, unknown>;
      if (record.type !== 'message' || record.role !== 'assistant') {
        return null;
      }
      const rawContent = record.content;
      const content = Array.isArray(rawContent)
        ? (rawContent as Array<Record<string, unknown>>)
        : [];
      const snippets = content
        .map((piece) => {
          if (!piece || typeof piece !== 'object') {
            return null;
          }
          if (piece.type === 'output_text' && typeof piece.text === 'string') {
            return piece.text;
          }
          if (
            piece.type === 'output_audio' &&
            typeof piece.transcript === 'string'
          ) {
            return piece.transcript;
          }
          return null;
        })
        .filter((text): text is string => Boolean(text && text.trim()));
      if (snippets.length === 0) {
        return null;
      }
      return snippets.join('\n').trim();
    };

    bundle.session.on('history_added', (item) => {
      const text = extractAssistantTranscript(item);
      if (!text) {
        return;
      }
      const rawId =
        item && typeof item === 'object' && 'itemId' in item
          ? (item as { itemId?: unknown }).itemId
          : null;
      if (typeof rawId === 'string') {
        const seen = assistantMessageIdsRef.current;
        if (seen.has(rawId)) {
          return;
        }
        seen.add(rawId);
      }
      setAiMessages((prev) => {
        const last = prev.length > 0 ? prev[prev.length - 1] : null;
        if (last && last.trim() === text) {
          return prev;
        }
        return [...prev, text];
      });
    });

    bundle.session.on('agent_end', (...[, , finalText]: SessionEvents['agent_end']) => {
      if (typeof finalText !== 'string') {
        return;
      }
      const trimmed = finalText.trim();
      if (!trimmed) {
        return;
      }
      setAiMessages((prev) => {
        const last = prev.length > 0 ? prev[prev.length - 1] : null;
        if (last && last.trim() === trimmed) {
          return prev;
        }
        return [...prev, trimmed];
      });
    });

    bundle.session.on('agent_handoff', () => {
      setIsDelegating(true);
    });

    bundle.session.on('agent_tool_start', (...[, , tool]: SessionEvents['agent_tool_start']) => {
      if (tool.name === 'recommend_sake') {
        setIsDelegating(true);
        const currentSession = sessionRef.current;
        if (currentSession && isRecordingRef.current) {
          autoMutedRef.current = true;
          try {
            currentSession.mute(true);
          } catch (err) {
            console.error('Failed to auto-mute during delegation:', err);
          }
          setIsRecordingStateRef.current(false);
        }
      }
    });

    bundle.session.on('agent_tool_end', (...[, , tool]: SessionEvents['agent_tool_end']) => {
      if (tool.name === 'recommend_sake') {
        setIsDelegating(false);
        if (autoMutedRef.current) {
          autoMutedRef.current = false;
          const currentSession = sessionRef.current;
          if (currentSession) {
            try {
              currentSession.mute(false);
            } catch (err) {
              console.error('Failed to auto-unmute after delegation:', err);
            }
            setIsRecordingStateRef.current(true);
          }
        }
      }
    });

    bundle.session.on('error', (event: SessionEvents['error'][0]) => {
      const rawMsg = extractErrorMessage(event);
      const isBenign =
        rawMsg && /Unable to add filesystem/i.test(rawMsg);
      if (isBenign) {
        console.warn('[Realtime] Ignored benign error:', rawMsg);
        return;
      }
      console.error('Session error:', rawMsg ?? event);
      setError(rawMsg || 'Connection error occurred');
      setIsLoading(false);
    });

    return () => {
      try {
        bundle.session.close();
      } catch (err) {
        console.warn('Error closing session', err);
      }
      bundleRef.current = null;
      sessionRef.current = null;
    };
  }, []);

  const connectToSession = async () => {
    const currentSession = sessionRef.current;
    if (!currentSession) return;

    setIsLoading(true);
    setError(null);
    setIsDelegating(false);

    try {
      const response = await fetch('/api/client-secret', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = (await response.json().catch(() => null)) as
        | { value?: string; error?: unknown; details?: unknown }
        | null;
      if (!response.ok || !data?.value) {
        const details =
          (data && (data.error || data.details)) || 'Failed to get client secret';
        throw new Error(
          typeof details === 'string' ? details : JSON.stringify(details)
        );
      }

      await currentSession.connect({
        apiKey: data.value,
        model: realtimeModel,
      });
      currentSession.mute(false);

      const prefs = preferencesRef.current;
      if (prefs) {
        const flavorText = describePreferenceValue(prefs.flavor_preference);
        const bodyText = describePreferenceValue(prefs.body_preference);
        const priceText = describePreferenceValue(prefs.price_range);
        const prefParts = [
          flavorText ? `味わい=${flavorText}` : null,
          bodyText ? `ボディ=${bodyText}` : null,
          priceText ? `価格帯=${priceText}` : null,
          prefs.food_pairing?.length ? `料理=${prefs.food_pairing.join(' / ')}` : null,
          prefs.notes ? `メモ=${prefs.notes}` : null,
        ].filter(Boolean);
        const prefText =
          prefParts.length > 0
            ? `ユーザー設定: ${prefParts.join('、 ')}`
            : 'ユーザー設定: 特になし';
        currentSession.sendMessage({
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: prefText }],
        });
      }

      setIsConnected(true);
      setIsLoading(false);
      setIsRecording(true);
      assistantMessageIdsRef.current.clear();
      setAiMessages([]);
      onConnectionChange?.(true);
    } catch (err) {
      console.error('Failed to connect:', err);
      const message =
        err instanceof Error ? err.message : 'Failed to connect to AI assistant';
      setError(message || 'Failed to connect to AI assistant');
      setIsLoading(false);
    }
  };

  const disconnectFromSession = () => {
    if (sessionRef.current) {
      sessionRef.current.close();
    }
    setIsConnected(false);
    setIsRecording(false);
    setIsLoading(false);
    setError(null);
    setIsDelegating(false);
    latestSakeRef.current = null;
    assistantMessageIdsRef.current.clear();
    setProgressEvents([]);
    autoMutedRef.current = false;
    onConnectionChange?.(false);
  };

  const handleStartConversation = () => {
    if (isLoading || isConnected) return;
    void connectToSession();
  };

  const handleStopConversation = () => {
    if (!isConnected) return;
    disconnectFromSession();
  };

  const handleToggleMute = () => {
    const currentSession = sessionRef.current;
    if (!isConnected || !currentSession) return;
    const nextRecordingState = !isRecording;
    try {
      currentSession.mute(!nextRecordingState);
    } catch (err) {
      console.error('Failed to toggle mute:', err);
      setError('マイクのミュート切り替えに失敗しました');
      return;
    }
    autoMutedRef.current = false;
    if (error === 'マイクのミュート切り替えに失敗しました') {
      setError(null);
    }
    setIsRecording(nextRecordingState);
  };

  const isMuted = isConnected && !isRecording;

  useEffect(() => () => {
    try {
      sessionRef.current?.close();
    } catch {}
  }, []);

  // Full variant (大画面表示)
  const fullContent = (
    <div className="flex flex-col items-center w-full max-w-4xl mx-auto space-y-6">
      {/* 接続前：マイクボタンのみ表示 */}
      {!isConnected && (
        <motion.div 
          className="flex flex-col items-center gap-5 sm:gap-6"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div className="relative">
            <Button
              onClick={handleStartConversation}
              disabled={isLoading}
              size="xl"
              className={cn(
                "relative h-24 w-24 sm:h-28 sm:w-28 lg:h-32 lg:w-32 rounded-full p-0",
                "bg-gradient-to-br from-primary-400 via-primary-500 to-primary-600",
                "shadow-2xl hover:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)]",
                "hover:scale-105 active:scale-100",
                "transition-all duration-300",
                "border-4 border-primary-200/20",
                "disabled:opacity-70"
              )}
            >
              <motion.div
                animate={isLoading ? { rotate: 360 } : {}}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                {isLoading ? (
                  <Loader2 className="h-10 w-10 sm:h-12 sm:w-12 lg:h-14 lg:w-14" />
                ) : (
                  <Mic className="h-10 w-10 sm:h-12 sm:w-12 lg:h-14 lg:w-14" />
                )}
              </motion.div>
            </Button>
          </motion.div>

          <motion.div
            className="text-center space-y-2 px-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h3 className="text-lg sm:text-xl font-semibold text-foreground tracking-tight">
              {isLoading ? 'AIソムリエに接続中...' : 'マイクボタンを押してスタート'}
            </h3>
          </motion.div>
        </motion.div>
      )}

      {/* 接続後：チャットUI表示 */}
      {isConnected && (
        <motion.div
          className="w-full space-y-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          {/* チャット表示エリア */}
          <Card className="w-full shadow-2xl border-border/30 bg-card/95 backdrop-blur-sm">
            <CardContent className="p-0">
              <ScrollArea className="h-[60vh] sm:h-[65vh] max-h-[600px] p-4 sm:p-6">
                <div className="space-y-4 sm:space-y-5">
                  {aiMessages.length === 0 ? (
                    <motion.div
                      className="flex flex-col items-center justify-center h-full min-h-[200px] text-center space-y-3"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 }}
                    >
                      <div className="rounded-full bg-primary/10 p-4">
                        <MessageSquare className="h-8 w-8 text-primary" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-base font-medium text-foreground">
                          会話を開始しました
                        </p>
                        <p className="text-sm text-muted-foreground">
                          お好みの日本酒についてお聞かせください
                        </p>
                      </div>
                    </motion.div>
                  ) : (
                    aiMessages.map((message, index) => (
                      <motion.div
                        key={`${index}-${message}`}
                        className="flex items-start gap-3 sm:gap-4"
                        initial={{ opacity: 0, x: -20, scale: 0.95 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        transition={{ 
                          delay: Math.min(index * 0.05, 0.3),
                          type: "spring",
                          stiffness: 500,
                          damping: 30
                        }}
                      >
                        <Avatar className="h-9 w-9 sm:h-10 sm:w-10 border-2 border-primary/30 shadow-md flex-shrink-0">
                          <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary">
                            <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-primary">
                              AIソムリエ
                            </span>
                          </div>
                          <div className="rounded-2xl rounded-tl-sm bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 p-3 sm:p-4 shadow-sm">
                            <p className="text-sm sm:text-base leading-relaxed text-foreground whitespace-pre-wrap">
                              {message}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* ステータスとプログレス */}
          <div className="space-y-3">
            {isDelegating && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex justify-center"
              >
                <Badge variant="secondary" className="gap-2 py-2 px-4">
                  <Activity className="h-4 w-4 animate-pulse" />
                  <span>テキストエージェントが購入候補を調査しています</span>
                </Badge>
              </motion.div>
            )}

            {progressEvents.length > 0 && (
              <motion.div
                key="progress-log"
                className="w-full"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
              >
                <Card className="shadow-lg border-border/30 bg-card/70 backdrop-blur">
                  <CardContent className="p-3 sm:p-4">
                    <div className="space-y-2">
                      {progressEvents.map((event) => {
                        const timeLabel = formatProgressTime(event.timestamp);
                        const key = `${event.timestamp}-${event.type}-${event.label ?? 'event'}`;
                        return (
                          <div
                            key={key}
                            className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 text-xs sm:text-sm"
                          >
                            <span className="text-muted-foreground font-mono tabular-nums">
                              {timeLabel}
                            </span>
                            <div className="flex-1">
                              <div className={cn('font-semibold', progressAccent(event.type))}>
                                {event.label ?? event.type}
                              </div>
                              {event.message && (
                                <p className="text-muted-foreground leading-snug">
                                  {event.message}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>

          {/* コントロールボタン */}
          <motion.div
            className="flex items-center justify-center gap-6 sm:gap-8 pt-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button
                onClick={handleStopConversation}
                size="xl"
                variant="destructive"
                className="h-14 w-14 sm:h-16 sm:w-16 rounded-full p-0 shadow-xl hover:shadow-destructive/50 transition-all"
              >
                <PhoneOff className="h-7 w-7 sm:h-9 sm:w-9" />
              </Button>
            </motion.div>

            <motion.div className="relative">
              <AnimatePresence>
                {isRecording && (
                  <>
                    <motion.div
                      className="absolute inset-0 rounded-full bg-primary/20 blur-md"
                      initial={{ scale: 1, opacity: 0.8 }}
                      animate={{ scale: 2.2, opacity: 0 }}
                      exit={{ scale: 1, opacity: 0.8 }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeOut",
                      }}
                    />
                    <motion.div
                      className="absolute inset-0 rounded-full bg-primary/30 blur-sm"
                      initial={{ scale: 1, opacity: 0.6 }}
                      animate={{ scale: 2.5, opacity: 0 }}
                      exit={{ scale: 1, opacity: 0.6 }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeOut",
                        delay: 0.5,
                      }}
                    />
                  </>
                )}
              </AnimatePresence>

              <Button
                onClick={handleToggleMute}
                size="xl"
                variant={isMuted ? "secondary" : "default"}
                className={cn(
                  "relative h-18 w-18 sm:h-20 sm:w-20 lg:h-24 lg:w-24 rounded-full p-0 shadow-xl transition-all duration-300",
                  !isMuted && "bg-gradient-to-br from-emerald-500 via-emerald-600 to-emerald-700 hover:shadow-emerald-500/50",
                  "hover:scale-105 active:scale-100"
                )}
              >
                <motion.div
                  animate={isRecording ? { scale: [1, 1.1, 1] } : { scale: 1 }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  {isMuted ? (
                    <MicOff className="h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12" />
                  ) : (
                    <Mic className="h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12" />
                  )}
                </motion.div>
              </Button>
            </motion.div>
          </motion.div>

          {/* ステータステキスト */}
          <motion.div
            className="text-center space-y-2 px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <p className="text-sm sm:text-base text-muted-foreground">
              {isMuted
                ? 'ミュート中（AIには聞こえていません）'
                : isDelegating
                  ? '購入情報を調査中です…'
                  : 'お話しください 🎤'}
            </p>

            {error && (
              <motion.p
                className="text-destructive text-sm font-medium"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                エラー: {error}
              </motion.p>
            )}
          </motion.div>
        </motion.div>
      )}
    </div>
  );

  // Minimized variant (最小化表示 - 右下に固定)
  if (variant === 'compact' && isMinimized) {
    return (
      <motion.button
        onClick={onToggleMinimize}
        className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-50 h-14 w-14 rounded-full shadow-2xl glass border-border/30 flex items-center justify-center hover:scale-110 transition-all duration-300"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0 }}
      >
        <div className="relative">
          {isConnected && isRecording && (
            <motion.div
              className="absolute inset-0 rounded-full bg-primary/30"
              animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          )}
          <MessageSquare className={cn(
            "h-6 w-6",
            isConnected ? "text-primary" : "text-muted-foreground"
          )} />
        </div>
        {isConnected && (
          <div className="absolute -top-1 -right-1 h-3 w-3 bg-emerald-500 rounded-full border-2 border-background animate-pulse" />
        )}
      </motion.button>
    );
  }

  // Compact variant (コンパクト表示)
  const compactContent = (
    <Card className="glass w-full shadow-2xl border-border/30">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9 border-2 border-primary/30 shadow-sm">
              <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary">
                <MessageSquare className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <span className="text-base font-semibold">音声アシスト</span>
          </div>
          <div className="flex items-center gap-2">
            {onToggleMinimize && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleMinimize}
                className="h-8 w-8 hover:bg-primary/10"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-muted-foreground"
                >
                  <polyline points="4 14 10 14 10 20"></polyline>
                  <polyline points="20 10 14 10 14 4"></polyline>
                  <line x1="14" y1="10" x2="21" y2="3"></line>
                  <line x1="3" y1="21" x2="10" y2="14"></line>
                </svg>
              </Button>
            )}
            {isDelegating && (
              <Activity className="h-5 w-5 text-primary animate-pulse" />
            )}
            <div
              className={cn(
                "h-3 w-3 rounded-full shadow-sm",
                isConnected ? "bg-emerald-500 animate-pulse" : "bg-muted"
              )}
            />
          </div>
        </div>

        <p className={cn(
          "text-sm mb-4 leading-relaxed",
          error ? "text-destructive font-medium" : "text-muted-foreground"
        )}>
          {error ?? (isLoading
            ? 'AIソムリエに接続中...'
            : !isConnected
              ? '準備完了です。スタートで会話を始めましょう。'
              : isDelegating
                ? 'テキストエージェントが購入候補を更新しています'
                : isMuted
                  ? 'ミュート中（AIには聞こえていません）'
                  : '会話中です。ご希望を追加してください。')}
        </p>

        {aiMessages.length > 0 && !error && (
          <div className="mb-4 rounded-xl border border-border/50 bg-gradient-to-br from-muted/50 to-muted/30 p-4 text-sm text-foreground line-clamp-2 leading-relaxed shadow-sm">
            {aiMessages[aiMessages.length - 1]}
          </div>
        )}

        <div className="flex items-center gap-3">
          {!isConnected ? (
            <Button
              onClick={handleStartConversation}
              disabled={isLoading}
              className="flex-1 h-11"
              size="default"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
              開始
            </Button>
          ) : (
            <>
              <Button
                onClick={handleToggleMute}
                variant={isMuted ? "secondary" : "default"}
                className={cn(
                  "flex-1 h-11",
                  !isMuted && "bg-gradient-to-br from-emerald-500 via-emerald-600 to-emerald-700 hover:from-emerald-400 hover:via-emerald-500 hover:to-emerald-600"
                )}
                size="default"
              >
                {isMuted ? (
                  <>
                    <MicOff className="h-5 w-5" />
                    ミュート解除
                  </>
                ) : (
                  <>
                    <Mic className="h-5 w-5" />
                    ミュート
                  </>
                )}
              </Button>
              <Button
                onClick={handleStopConversation}
                variant="destructive"
                size="icon-lg"
                className="h-11 w-11"
              >
                <PhoneOff className="h-5 w-5" />
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return isCompact ? compactContent : fullContent;
}
