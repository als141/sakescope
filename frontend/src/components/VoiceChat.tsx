'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  MicOff,
  MessageSquare,
  Loader,
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

    bundle.session.on('agent_end', (...[, , finalText]: SessionEvents['agent_end']) => {
      if (typeof finalText === 'string' && finalText.trim()) {
        setAiMessages((prev) => [...prev, finalText.trim()]);
      }
    });

    bundle.session.on('agent_handoff', () => {
      setIsDelegating(true);
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

  const fullContent = (
    <div className="flex flex-col items-center space-y-6">
      <div className="flex flex-col items-center gap-4">
        {!isConnected ? (
          <motion.button
            onClick={handleStartConversation}
            className={`
              relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300
              ${isLoading
                ? 'bg-gray-600'
                : 'bg-orange-500 hover:bg-orange-600 shadow-lg shadow-orange-500/50'
              }
            `}
            whileHover={{ scale: isLoading ? 1 : 1.05 }}
            whileTap={{ scale: isLoading ? 1 : 0.95 }}
            disabled={isLoading}
            aria-label="会話を開始"
          >
            {isLoading ? (
              <Loader className="w-10 h-10 text-white animate-spin" />
            ) : (
              <Mic className="w-10 h-10 text-white" />
            )}
          </motion.button>
        ) : (
          <div className="flex items-center gap-6">
            <motion.button
              onClick={handleStopConversation}
              className="w-20 h-20 rounded-full flex items-center justify-center bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/40 transition-all duration-300"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              aria-label="会話を終了"
            >
              <PhoneOff className="w-8 h-8 text-white" />
            </motion.button>

            <div className="relative">
              <AnimatePresence>
                {isRecording && (
                  <>
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-amber-400"
                      initial={{ scale: 1, opacity: 1 }}
                      animate={{ scale: 2, opacity: 0 }}
                      exit={{ scale: 1, opacity: 1 }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: 'easeOut',
                      }}
                    />
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-orange-400"
                      initial={{ scale: 1, opacity: 1 }}
                      animate={{ scale: 2.5, opacity: 0 }}
                      exit={{ scale: 1, opacity: 1 }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: 'easeOut',
                        delay: 0.5,
                      }}
                    />
                  </>
                )}
              </AnimatePresence>

              <motion.button
                onClick={handleToggleMute}
                className={`
                  relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300
                  ${isMuted
                    ? 'bg-gray-600 hover:bg-gray-500 shadow-lg shadow-gray-600/40'
                    : 'bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/40'
                  }
                `}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                aria-label={isMuted ? 'ミュートを解除' : 'ミュートする'}
              >
                {isMuted ? (
                  <MicOff className="w-8 h-8 text-white" />
                ) : (
                  <Mic className="w-8 h-8 text-white" />
                )}
              </motion.button>
            </div>
          </div>
        )}
      </div>

      <motion.div
        className="text-center space-y-2"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <p className="text-lg font-medium text-white">
          {isLoading
            ? 'AIソムリエに接続中...'
            : !isConnected
              ? 'マイクボタンを押してスタート'
              : isMuted
                ? 'ミュート中（AIには聞こえていません）'
                : isDelegating
                  ? '購入情報を調査中です…'
                  : 'お話しください 🎤'}
        </p>

        {error && (
          <motion.p
            className="text-red-400 text-sm"
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
            className="flex items-center gap-2 text-sm text-amber-300 bg-amber-500/10 border border-amber-500/40 rounded-full px-4 py-2"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <Activity className="w-4 h-4 animate-pulse" />
            <span>テキストエージェントが購入候補を調査しています</span>
          </motion.div>
        )}
      </AnimatePresence>

      {aiMessages.length > 0 && (
        <motion.div
          className="w-full max-w-2xl space-y-3 max-h-64 overflow-y-auto px-2"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: 0.5 }}
          aria-live="polite"
        >
          {aiMessages.map((message, index) => (
            <motion.div
              key={`${index}-${message}`}
              className="flex items-start gap-3 mr-8"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(index * 0.05, 0.3) }}
            >
              <div className="shrink-0 mt-1 rounded-full bg-orange-500/20 p-2">
                <MessageSquare className="w-4 h-4 text-orange-300" />
              </div>
              <div className="flex-1 rounded-2xl bg-gradient-to-br from-orange-500/15 to-amber-400/10 border border-orange-400/20 p-4 shadow-sm">
                <div className="mb-1 text-xs uppercase tracking-wider text-orange-300/80">
                  AIソムリエ
                </div>
                <p className="text-sm leading-relaxed text-gray-100 whitespace-pre-wrap">
                  {message}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      <div className="flex items-center gap-2 text-sm text-gray-400">
        <div
          className={`w-2 h-2 rounded-full ${
            isConnected ? 'bg-green-400' : 'bg-red-400'
          }`}
        />
        {isConnected ? '接続中' : '未接続'}
      </div>
    </div>
  );

  const hasError = Boolean(error);
  const statusText =
    error ??
    (isLoading
      ? 'AIソムリエに接続中...'
      : !isConnected
        ? '準備完了です。スタートで会話を始めましょう。'
        : isDelegating
          ? 'テキストエージェントが購入候補を更新しています'
          : isMuted
            ? 'ミュート中（AIには聞こえていません）'
            : '会話中です。ご希望を追加してください。');
  const latestMessage =
    aiMessages.length > 0 ? aiMessages[aiMessages.length - 1] : null;

  const compactContent = (
    <div className="glass w-full rounded-xl border border-orange-500/20 bg-black/40 p-4 text-sm text-white shadow-lg backdrop-blur">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-amber-300" />
          <span className="text-sm font-semibold text-white">音声アシスト</span>
        </div>
        <div className="flex items-center gap-2">
          {isDelegating ? (
            <Activity className="w-4 h-4 text-amber-300 animate-pulse" />
          ) : null}
          <span
            className={`inline-flex h-2.5 w-2.5 rounded-full ${
              isConnected ? 'bg-emerald-400' : 'bg-gray-400'
            }`}
            aria-hidden
          />
        </div>
      </div>
      <p
        className={`mt-2 text-xs ${
          hasError ? 'text-red-300' : 'text-gray-200'
        }`}
      >
        {statusText}
      </p>
      {latestMessage && !hasError ? (
        <div className="mt-2 rounded-lg border border-white/10 bg-white/5 p-2 text-xs text-gray-300 line-clamp-2">
          {latestMessage}
        </div>
      ) : null}
      <div className="mt-3 flex items-center gap-2">
        {!isConnected ? (
          <button
            onClick={handleStartConversation}
            disabled={isLoading}
            className="flex-1 inline-flex items-center justify-center rounded-lg bg-orange-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70"
            aria-label="会話を開始"
          >
            {isLoading ? (
              <Loader className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Mic className="mr-2 h-4 w-4" />
                開始
              </>
            )}
          </button>
        ) : (
          <>
            <button
              onClick={handleToggleMute}
              className={`flex-1 inline-flex items-center justify-center rounded-lg border border-white/10 px-3 py-2 text-sm transition-colors ${
                isMuted
                  ? 'bg-gray-700/70 text-gray-200 hover:bg-gray-600/70'
                  : 'bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30'
              }`}
              aria-label={isMuted ? 'ミュートを解除' : 'ミュートする'}
            >
              {isMuted ? (
                <>
                  <MicOff className="mr-2 h-4 w-4" />
                  ミュート解除
                </>
              ) : (
                <>
                  <Mic className="mr-2 h-4 w-4" />
                  ミュート
                </>
              )}
            </button>
            <button
              onClick={handleStopConversation}
              className="inline-flex items-center justify-center rounded-lg bg-red-500/80 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600/80"
              aria-label="会話を終了"
            >
              <PhoneOff className="mr-2 h-4 w-4" />
              終了
            </button>
          </>
        )}
      </div>
    </div>
  );

  return isCompact ? compactContent : fullContent;
}
