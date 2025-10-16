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
  preferences?: {
    flavor_preference?: string | null;
    body_preference?: string | null;
    price_range?: string | null;
    food_pairing?: string[];
    notes?: string | null;
  };
  variant?: 'full' | 'compact';
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
  preferences,
  variant = 'full',
}: VoiceChatProps) {
  const sessionRef = useRef<RealtimeSession<AgentRuntimeContext> | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [aiMessages, setAiMessages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDelegating, setIsDelegating] = useState(false);

  const bundleRef = useRef<VoiceAgentBundle | null>(null);
  const onSakeRecommendedRef = useRef(onSakeRecommended);
  const onOfferReadyRef = useRef(onOfferReady);
  const latestSakeRef = useRef<Sake | null>(null);
  const preferencesRef = useRef(preferences);
  const assistantMessageIdsRef = useRef<Set<string>>(new Set());
  const isCompact = variant === 'compact';

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
        onOfferReadyRef.current?.(offer);
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
      }
    });

    bundle.session.on('agent_tool_end', (...[, , tool]: SessionEvents['agent_tool_end']) => {
      if (tool.name === 'recommend_sake') {
        setIsDelegating(false);
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
    <div className="flex flex-col items-center space-y-8 sm:space-y-10 lg:space-y-12">
      <div className="flex flex-col items-center gap-6 sm:gap-8">
        {!isConnected ? (
          <motion.div className="relative">
            <Button
              onClick={handleStartConversation}
              disabled={isLoading}
              size="xl"
              className={cn(
                "relative h-28 w-28 sm:h-32 sm:w-32 lg:h-36 lg:w-36 rounded-full p-0",
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
                  <Loader2 className="h-12 w-12 sm:h-14 sm:w-14 lg:h-16 lg:w-16" />
                ) : (
                  <Mic className="h-12 w-12 sm:h-14 sm:w-14 lg:h-16 lg:w-16" />
                )}
              </motion.div>
            </Button>
          </motion.div>
        ) : (
          <div className="flex items-center gap-6 sm:gap-8 lg:gap-10">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button
                onClick={handleStopConversation}
                size="xl"
                variant="destructive"
                className="h-16 w-16 sm:h-20 sm:w-20 rounded-full p-0 shadow-xl hover:shadow-destructive/50 transition-all"
              >
                <PhoneOff className="h-7 w-7 sm:h-9 sm:w-9" />
              </Button>
            </motion.div>

            <motion.div className="relative">
              <AnimatePresence>
                {isRecording && (
                  <>
                    {/* パルスリング1 */}
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
                    {/* パルスリング2 */}
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
                  "relative h-20 w-20 sm:h-24 sm:w-24 lg:h-28 lg:w-28 rounded-full p-0 shadow-xl transition-all duration-300",
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
          </div>
        )}
      </div>

      <motion.div
        className="text-center space-y-3 sm:space-y-4 px-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h3 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
          {isLoading
            ? 'AIソムリエに接続中...'
            : !isConnected
              ? 'マイクボタンを押してスタート'
              : isMuted
                ? 'ミュート中（AIには聞こえていません）'
                : isDelegating
                  ? '購入情報を調査中です…'
                  : 'お話しください 🎤'}
        </h3>

        {error && (
          <motion.p
            className="text-destructive text-base font-medium"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            エラー: {error}
          </motion.p>
        )}
      </motion.div>

      <AnimatePresence>
        {isDelegating && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <Badge variant="secondary" className="gap-2 py-2 px-4">
              <Activity className="h-4 w-4 animate-pulse" />
              <span>テキストエージェントが購入候補を調査しています</span>
            </Badge>
          </motion.div>
        )}
      </AnimatePresence>

      {aiMessages.length > 0 && (
        <Card className="w-full max-w-2xl shadow-2xl border-border/30">
          <CardContent className="p-0">
            <ScrollArea className="h-64 sm:h-72 lg:h-80 p-6 sm:p-8">
              <div className="space-y-4 sm:space-y-5">
                {aiMessages.map((message, index) => (
                  <motion.div
                    key={`${index}-${message}`}
                    className="flex items-start gap-4"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(index * 0.05, 0.3) }}
                  >
                    <Avatar className="h-9 w-9 sm:h-10 sm:w-10 border-2 border-primary/30 shadow-sm">
                      <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary">
                        <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 rounded-2xl bg-gradient-to-br from-muted/50 to-muted/30 border border-border/50 p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow">
                      <div className="mb-1.5 sm:mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
                        AIソムリエ
                      </div>
                      <p className="text-sm sm:text-base leading-relaxed text-foreground whitespace-pre-wrap">
                        {message}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <div
          className={cn(
            "h-2 w-2 rounded-full",
            isConnected ? "bg-emerald-500" : "bg-destructive"
          )}
        />
        {isConnected ? '接続中' : '未接続'}
      </div>
    </div>
  );

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
          <div className="flex items-center gap-3">
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
