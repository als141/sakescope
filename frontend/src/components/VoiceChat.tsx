'use client';

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Mic,
  MicOff,
  MessageSquare,
  Loader2,
  PhoneOff,
  Activity,
  Send,
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
  AgentOrchestrationCallbacks,
} from '@/infrastructure/openai/agents/context';
import type { TextWorkerProgressEvent } from '@/types/textWorker';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
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
  fullscreenMobile?: boolean;
  /**
   * When true, render a minimal start-only UI for embed contexts.
   * Once connected, the normal full/compact UI is used.
   */
  embedMinimal?: boolean;
  /**
   * In embed contexts, keep microphone muted after delegation completes.
   */
  embedPreserveMuteOnDelegationEnd?: boolean;
  /**
   * Expose a stop/disconnect function to parent (embed UX).
   */
  onStopAvailable?: (stopFn: () => void) => void;
  clientSecretPath?: string;
  createSessionBundle?: (callbacks: AgentOrchestrationCallbacks) => VoiceAgentBundle;
}

type InteractionMode = 'voice' | 'chat';

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
  fullscreenMobile = false,
  embedMinimal = false,
  embedPreserveMuteOnDelegationEnd = false,
  onStopAvailable,
  clientSecretPath = '/api/client-secret',
  createSessionBundle,
}: VoiceChatProps) {
  const realtimeModel =
    process.env.NEXT_PUBLIC_OPENAI_REALTIME_MODEL ?? 'gpt-realtime-mini';
  const sessionRef = useRef<RealtimeSession<AgentRuntimeContext> | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [aiMessages, setAiMessages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDelegating, setIsDelegating] = useState(false);
  const [isAvatarSpeaking, setIsAvatarSpeaking] = useState(false);
  const [currentSubtitle, setCurrentSubtitle] = useState('');
  const [isMouthOpenFrame, setIsMouthOpenFrame] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [reasoningSummaryJa, setReasoningSummaryJa] = useState('');
  const [isTranslatingSummary, setIsTranslatingSummary] = useState(false);

  const bundleRef = useRef<VoiceAgentBundle | null>(null);
  const onSakeRecommendedRef = useRef(onSakeRecommended);
  const onOfferReadyRef = useRef(onOfferReady);
  const latestSakeRef = useRef<Sake | null>(null);
  const preferencesRef = useRef(preferences);
  const assistantMessageIdsRef = useRef<Set<string>>(new Set());
  const assistantMessageOrderRef = useRef<string[]>([]);
  const pushTranscript = useCallback((role: 'user' | 'assistant', text: string, mode: 'text' | 'voice' = 'text') => {
    const session = sessionRef.current;
    if (!session) return;
    const ctx = session.context.context as AgentRuntimeContext | undefined;
    if (!ctx) return;
    if (!ctx.session.transcriptLog) {
      ctx.session.transcriptLog = [];
    }
    ctx.session.transcriptLog.push({
      role,
      text,
      mode,
      timestamp: Date.now(),
    });
  }, []);
  const isCompact = variant === 'compact';
  const isRecordingRef = useRef(isRecording);
  const autoMutedRef = useRef(false);
  const avatarSpeechTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mouthAnimationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const setIsRecordingStateRef = useRef(setIsRecording);
  const chatInputRef = useRef<HTMLInputElement | null>(null);
  const translateAbortControllerRef = useRef<AbortController | null>(null);
  const isChatMode = isConnected && !isRecording;
  const isFullscreenActive = Boolean(fullscreenMobile && isConnected);

  const openAvatarMouth = useCallback(() => {
    if (avatarSpeechTimeoutRef.current) {
      clearTimeout(avatarSpeechTimeoutRef.current);
      avatarSpeechTimeoutRef.current = null;
    }
    setIsAvatarSpeaking(true);
    setIsMouthOpenFrame(true);
  }, []);

  const scheduleAvatarMouthClose = useCallback((delay = 220) => {
    if (avatarSpeechTimeoutRef.current) {
      clearTimeout(avatarSpeechTimeoutRef.current);
    }
    avatarSpeechTimeoutRef.current = setTimeout(() => {
      setIsAvatarSpeaking(false);
      setIsMouthOpenFrame(false);
      avatarSpeechTimeoutRef.current = null;
    }, delay);
  }, []);

  const translateReasoningSummary = useCallback(async (summary: string) => {
    const trimmed = summary.trim();
    if (!trimmed) {
      setReasoningSummaryJa('');
      setIsTranslatingSummary(false);
      return;
    }
    setIsTranslatingSummary(true);
    setReasoningSummaryJa('');
    if (translateAbortControllerRef.current) {
      translateAbortControllerRef.current.abort();
      translateAbortControllerRef.current = null;
    }
    const controller = new AbortController();
    translateAbortControllerRef.current = controller;
    try {
      const response = await fetch('/api/reasoning-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ summary: trimmed }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const details = await response.text().catch(() => 'Translation failed');
        throw new Error(details || 'Translation failed');
      }
      const data = (await response.json().catch(() => null)) as
        | { translation?: string }
        | null;
      if (controller.signal.aborted) {
        return;
      }
      const translated =
        typeof data?.translation === 'string' && data.translation.trim().length > 0
          ? data.translation.trim()
          : trimmed;
      setReasoningSummaryJa(translated);
    } catch (err) {
      if (controller.signal.aborted) {
        return;
      }
      console.error('Failed to translate reasoning summary:', err);
      setReasoningSummaryJa(trimmed);
      setError((prev) => prev ?? '推論サマリの翻訳に失敗しました');
    } finally {
      if (!controller.signal.aborted) {
        setIsTranslatingSummary(false);
        translateAbortControllerRef.current = null;
      }
    }
  }, []);

  const handleTextWorkerProgress = useCallback(
    (event: TextWorkerProgressEvent) => {
      if (event.type === 'reasoning' && typeof event.message === 'string') {
        const text = event.message.trim();
        if (text.length > 0) {
          void translateReasoningSummary(text);
        }
      }
      if (event.type === 'final' || event.type === 'error') {
        if (translateAbortControllerRef.current) {
          translateAbortControllerRef.current.abort();
          translateAbortControllerRef.current = null;
        }
        setIsTranslatingSummary(false);
      }
    },
    [translateReasoningSummary],
  );

  const upsertAiMessage = useCallback((id: string, text: string, options: { append?: boolean } = {}) => {
    if (!id || typeof text !== 'string') {
      return;
    }
    const { append = false } = options;
    setAiMessages((prev) => {
      const order = assistantMessageOrderRef.current;
      const index = order.indexOf(id);
      if (index === -1) {
        order.push(id);
        assistantMessageIdsRef.current.add(id);
        return [...prev, text];
      }
      const existing = prev[index] ?? '';
      const nextText = append ? `${existing}${text}` : text;
      if (nextText === existing) {
        return prev;
      }
      const next = [...prev];
      next[index] = nextText;
      return next;
    });
  }, []);

  useEffect(() => {
    onSakeRecommendedRef.current = onSakeRecommended;
  }, [onSakeRecommended]);

  useEffect(() => {
    onOfferReadyRef.current = onOfferReady;
  }, [onOfferReady]);

  useEffect(() => {
    if (aiMessages.length === 0) {
      setCurrentSubtitle('');
      return;
    }
    setCurrentSubtitle(aiMessages[aiMessages.length - 1] ?? '');
  }, [aiMessages]);

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
    if (!isConnected) {
      if (avatarSpeechTimeoutRef.current) {
        clearTimeout(avatarSpeechTimeoutRef.current);
        avatarSpeechTimeoutRef.current = null;
      }
      if (mouthAnimationIntervalRef.current) {
        clearInterval(mouthAnimationIntervalRef.current);
        mouthAnimationIntervalRef.current = null;
      }
      setIsAvatarSpeaking(false);
      setIsMouthOpenFrame(false);
    }
  }, [isConnected]);

  useEffect(() => {
    if (isAvatarSpeaking) {
      if (!mouthAnimationIntervalRef.current) {
        mouthAnimationIntervalRef.current = setInterval(() => {
          setIsMouthOpenFrame((prev) => !prev);
        }, 160 + Math.random() * 80);
      }
    } else if (mouthAnimationIntervalRef.current) {
      clearInterval(mouthAnimationIntervalRef.current);
      mouthAnimationIntervalRef.current = null;
      setIsMouthOpenFrame(false);
    }
  }, [isAvatarSpeaking]);

  useEffect(
    () => () => {
      if (avatarSpeechTimeoutRef.current) {
        clearTimeout(avatarSpeechTimeoutRef.current);
      }
      if (mouthAnimationIntervalRef.current) {
        clearInterval(mouthAnimationIntervalRef.current);
      }
      if (translateAbortControllerRef.current) {
        translateAbortControllerRef.current.abort();
        translateAbortControllerRef.current = null;
      }
    },
    [],
  );

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

    const bundleFactory = createSessionBundle ?? createRealtimeVoiceBundle;
    const bundle = bundleFactory({
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
          if (!embedPreserveMuteOnDelegationEnd) {
            try {
              sessionRef.current.mute(false);
            } catch (err) {
              console.error('Failed to unmute after delegation:', err);
            }
            setIsRecordingStateRef.current(true);
          }
        }
        onOfferReadyRef.current?.(offer);
      },
      onError: (message) => {
        setError(message);
        setIsDelegating(false);
      },
      onProgressEvent: handleTextWorkerProgress,
    });

    bundleRef.current = bundle;
    sessionRef.current = bundle.session;
    assistantMessageOrderRef.current = [];

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

    const handleTransportEvent = (event: TransportEvent) => {
      if (!event || typeof event !== 'object') {
        return;
      }
      const type = (event as { type?: unknown }).type;
      if (typeof type !== 'string') {
        return;
      }
      const itemId = (event as { item_id?: unknown }).item_id;
      if (typeof itemId !== 'string') {
        return;
      }
      if (type === 'response.output_text.delta') {
        const delta = (event as { delta?: unknown }).delta;
        if (typeof delta === 'string' && delta.length > 0) {
          upsertAiMessage(itemId, delta, { append: true });
        }
        return;
      }
      if (type === 'response.output_text.done') {
        const text = (event as { text?: unknown }).text;
        if (typeof text === 'string') {
          upsertAiMessage(itemId, text);
          pushTranscript('assistant', text, 'text');
        }
        return;
      }
      if (type === 'response.output_audio.delta') {
        openAvatarMouth();
        return;
      }
      if (type === 'response.output_audio.done') {
        scheduleAvatarMouthClose();
        return;
      }
      if (type === 'response.output_audio_transcript.delta') {
        const delta = (event as { delta?: unknown }).delta;
        if (typeof delta === 'string' && delta.length > 0) {
          upsertAiMessage(itemId, delta, { append: true });
          openAvatarMouth();
        }
        return;
      }
      if (type === 'response.output_audio_transcript.done') {
        const transcript = (event as { transcript?: unknown }).transcript;
        if (typeof transcript === 'string') {
          upsertAiMessage(itemId, transcript);
          pushTranscript('assistant', transcript, 'voice');
          scheduleAvatarMouthClose(320);
        }
        return;
      }
      if (type === 'conversation.item.input_audio_transcription.done') {
        const transcript = (event as { transcript?: unknown }).transcript;
        if (typeof transcript === 'string') {
          pushTranscript('user', transcript, 'voice');
        }
        return;
      }
      if (type === 'response.completed') {
        scheduleAvatarMouthClose();
        return;
      }
    };

    bundle.session.on('transport_event', handleTransportEvent);

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
      const itemId =
        typeof rawId === 'string'
          ? rawId
          : `assistant-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      upsertAiMessage(itemId, text);
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
            if (!embedPreserveMuteOnDelegationEnd) {
              try {
                currentSession.mute(false);
              } catch (err) {
                console.error('Failed to auto-unmute after delegation:', err);
              }
              setIsRecordingStateRef.current(true);
            }
          }
        }
      }
    });

    bundle.session.on('error', (event: SessionEvents['error'][0]) => {
      const rawMsg = extractErrorMessage(event);
      const benignPatterns = [
        /Unable to add filesystem/i,
        /Tool call ID .* not found in conversation/i,
      ];
      const isBenign = Boolean(
        rawMsg && benignPatterns.some((pattern) => pattern.test(rawMsg)),
      );
      if (isBenign) {
        console.warn('[Realtime] Ignored benign error:', rawMsg);
        return;
      }
      console.error('Session error:', rawMsg ?? event);
      setError(rawMsg || 'Connection error occurred');
      setIsLoading(false);
    });

    return () => {
      bundle.session.off('transport_event', handleTransportEvent);
      try {
        bundle.session.close();
      } catch (err) {
        console.warn('Error closing session', err);
      }
      bundleRef.current = null;
      sessionRef.current = null;
    };
  }, [
    preferences,
    upsertAiMessage,
    openAvatarMouth,
    scheduleAvatarMouthClose,
    handleTextWorkerProgress,
    pushTranscript,
    createSessionBundle,
    embedPreserveMuteOnDelegationEnd,
  ]);

  const connectToSession = useCallback(
    async (mode: InteractionMode) => {
      const currentSession = sessionRef.current;
      if (!currentSession) return;

      setIsLoading(true);
      setError(null);
      setIsDelegating(false);

      try {
        const response = await fetch(clientSecretPath, {
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
        if (mode === 'voice') {
          currentSession.mute(false);
          setIsRecording(true);
        } else {
          currentSession.mute(true);
          setIsRecording(false);
        }

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
        assistantMessageIdsRef.current.clear();
        assistantMessageOrderRef.current = [];
        setAiMessages([]);
        onConnectionChange?.(true);
      } catch (err) {
        console.error('Failed to connect:', err);
        const message =
          err instanceof Error ? err.message : 'Failed to connect to AI assistant';
        setError(message || 'Failed to connect to AI assistant');
        setIsLoading(false);
      }
    },
    [onConnectionChange, realtimeModel, setIsRecording, clientSecretPath],
  );

  const disconnectFromSession = useCallback(() => {
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
    assistantMessageOrderRef.current = [];
    setChatInput('');
    setReasoningSummaryJa('');
    setIsTranslatingSummary(false);
    if (translateAbortControllerRef.current) {
      translateAbortControllerRef.current.abort();
      translateAbortControllerRef.current = null;
    }
    if (avatarSpeechTimeoutRef.current) {
      clearTimeout(avatarSpeechTimeoutRef.current);
      avatarSpeechTimeoutRef.current = null;
    }
    setIsAvatarSpeaking(false);
    setCurrentSubtitle('');
    autoMutedRef.current = false;
    onConnectionChange?.(false);
  }, [onConnectionChange, setIsRecording]);

  useEffect(() => {
    onStopAvailable?.(disconnectFromSession);
  }, [onStopAvailable, disconnectFromSession]);

  const handleStartConversation = () => {
    if (isLoading || isConnected) return;
    void connectToSession('voice');
  };

  const handleSendChatMessage = async () => {
    const trimmed = chatInput.trim();
    if (!trimmed || isSendingChat) {
      return;
    }
    if (!isConnected || !sessionRef.current) {
      setError((prev) => prev ?? 'まず会話を開始してください');
      return;
    }
    setIsSendingChat(true);
    try {
      const session = sessionRef.current;
      if (!session) {
        throw new Error('セッションに接続できませんでした');
      }
      setChatInput('');
      session.sendMessage({
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: trimmed }],
      });
      pushTranscript('user', trimmed, 'text');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'テキスト送信に失敗しました';
      setError(message);
    } finally {
      setIsSendingChat(false);
    }
  };

  const handleChatKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSendChatMessage();
    }
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

  const statusText = (() => {
    if (isLoading) {
      return 'AIソムリエに接続中...';
    }
    if (!isConnected) {
      return isChatMode
        ? 'チャットボタンからメッセージを送ると接続します'
        : 'マイクボタンを押して会話を始めてください';
    }
    if (isDelegating) {
      return '購入情報を調査中です…';
    }
    if (isMuted) {
      return 'ミュート中（AIには聞こえていません）';
    }
    return 'お話しください 🎤';
  })();

  const subtitleFallback = isConnected
    ? isChatMode
      ? 'テキストでAIソムリエが回答します'
      : 'AIソムリエが話すとここに字幕がリアルタイム表示されます'
    : 'まずはマイクボタンで会話を始めましょう';

  const baseSubtitle = (currentSubtitle?.trim() || subtitleFallback).trim();
  const reasoningSummaryDisplay =
    reasoningSummaryJa && reasoningSummaryJa.trim().length > 0
      ? reasoningSummaryJa.trim()
      : '';
  const avatarImageSrc =
    isAvatarSpeaking && isMouthOpenFrame ? '/ai-avatar/open.png' : '/ai-avatar/close.png';
  const renderChatComposer = (mode: 'full' | 'compact') => {
    if (!isConnected) {
      return null;
    }
    const layoutClass = 'flex flex-row items-stretch gap-3';
    const buttonClass = mode === 'compact' ? 'h-11 px-4' : 'h-12 px-6';
    const inputClass = cn(
      'flex-1 rounded-2xl border border-border/60 bg-background/80 px-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30',
      'h-12',
    );

    return (
      <div className={cn('w-full', mode === 'full' && 'max-w-3xl mx-auto px-1 sm:px-0')}>
        <div className={layoutClass}>
          <Input
            ref={chatInputRef}
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
            onKeyDown={handleChatKeyDown}
            placeholder="テキストで補足したい内容を入力してください"
            className={inputClass}
            disabled={isSendingChat}
          />
          <Button
            type="button"
            onClick={() => void handleSendChatMessage()}
            disabled={isSendingChat || !chatInput.trim()}
            className={cn('flex items-center justify-center gap-2 rounded-2xl', buttonClass)}
          >
            {isSendingChat ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            送信
          </Button>
        </div>
      </div>
    );
  };

  useEffect(() => () => {
    try {
      sessionRef.current?.close();
    } catch {}
  }, []);

  // Minimal embed start screen (only microphone button)
  if (embedMinimal && !isConnected) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-10">
        <Button
          onClick={handleStartConversation}
          disabled={isLoading}
          size="xl"
          className={cn(
            'relative h-20 w-20 sm:h-24 sm:w-24 lg:h-28 lg:w-28 rounded-full p-0',
            'bg-gradient-to-br from-primary-400 via-primary-500 to-primary-600',
            'shadow-2xl hover:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)]',
            'hover:scale-105 active:scale-100',
            'transition-all duration-300',
            'border-4 border-primary-200/20',
            'disabled:opacity-70',
          )}
        >
          <motion.div
            animate={isLoading ? { rotate: 360 } : {}}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            {isLoading ? (
              <Loader2 className="h-10 w-10 sm:h-12 sm:w-12 lg:h-14 lg:w-14" />
            ) : (
              <Mic className="h-10 w-10 sm:h-12 sm:w-12 lg:h-14 lg:w-14" />
            )}
          </motion.div>
          <span className="sr-only">音声で相談を開始</span>
        </Button>
        {error && (
          <p className="mt-4 text-sm text-destructive font-medium">
            {error}
          </p>
        )}
      </div>
    );
  }

  // Minimal embed connected screen (subtitles + mute/disconnect only)
  if (embedMinimal && isConnected) {
    return (
      <div className="w-full h-full flex flex-col items-center gap-4 px-4 py-6 overflow-hidden">
        <div className="w-full flex-1 min-h-0 flex flex-col items-center justify-center gap-4">
          <div className="relative w-44 h-44 sm:w-52 sm:h-52 rounded-2xl border border-border/60 bg-muted/10 shadow-sm overflow-hidden shrink-0">
            <Image
              src={avatarImageSrc}
              alt="Sakescope ソムリエのアバター"
              fill
              sizes="(max-width: 640px) 176px, 208px"
              className="object-contain"
              priority
            />
          </div>

          <div className="w-full max-w-md flex-1 min-h-0 rounded-2xl border border-border/60 bg-background/80 px-5 py-4 shadow-inner overflow-y-auto">
            <p className="whitespace-pre-wrap text-sm sm:text-base leading-relaxed text-foreground">
              {baseSubtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center gap-4 pb-2 shrink-0">
          <Button
            onClick={handleToggleMute}
            variant={isMuted ? 'secondary' : 'default'}
            size="icon-lg"
            className={cn(
              'h-14 w-14 rounded-full shadow-lg',
              !isMuted &&
                'bg-gradient-to-br from-emerald-500 via-emerald-600 to-emerald-700 hover:from-emerald-400 hover:via-emerald-500 hover:to-emerald-600',
            )}
          >
            {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            <span className="sr-only">{isMuted ? 'ミュート解除' : 'ミュート'}</span>
          </Button>

          <Button
            onClick={handleStopConversation}
            variant="destructive"
            size="icon-lg"
            className="h-14 w-14 rounded-full shadow-lg"
          >
            <PhoneOff className="h-5 w-5" />
            <span className="sr-only">終了</span>
          </Button>
        </div>
      </div>
    );
  }

  const conversationWidthClass = isConnected
    ? isFullscreenActive
      ? 'max-w-full sm:max-w-4xl lg:max-w-5xl'
      : 'max-w-2xl sm:max-w-4xl lg:max-w-5xl'
    : 'max-w-xl sm:max-w-3xl';
  const avatarSizeClass = isConnected
    ? isFullscreenActive
      ? 'w-[320px] h-[320px] sm:w-[420px] sm:h-[420px]'
      : 'w-[300px] h-[300px] sm:w-[380px] sm:h-[380px]'
    : 'w-[240px] h-[240px] sm:w-[320px] sm:h-[320px]';
  const summaryWidthClass = isConnected ? 'max-w-3xl' : 'max-w-2xl';
  const summaryHeightClass = isFullscreenActive
    ? 'max-h-[16vh] min-h-[96px] h-auto sm:h-[19vh] sm:min-h-[128px] sm:max-h-[24vh]'
    : 'max-h-[14vh] min-h-[96px] h-auto sm:h-40 sm:max-h-none';

  // Full variant (大画面表示)
  const fullContent = (
    <div
      className={cn(
        'flex flex-col items-center w-full mx-auto space-y-6 px-3 sm:px-0',
        conversationWidthClass,
        isFullscreenActive && 'min-h-[90vh] px-0 !max-w-full overflow-hidden justify-center',
      )}
    >
      {!isConnected ? (
        <>
          <motion.div
            className="flex flex-col items-center gap-4 sm:gap-5"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex flex-col items-center gap-3 sm:gap-4">
              <Button
                onClick={handleStartConversation}
                disabled={isLoading}
                size="xl"
                className={cn(
                  'relative h-20 w-20 sm:h-24 sm:w-24 lg:h-28 lg:w-28 rounded-full p-0',
                  'bg-gradient-to-br from-primary-400 via-primary-500 to-primary-600',
                  'shadow-2xl hover:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)]',
                  'hover:scale-105 active:scale-100',
                  'transition-all duration-300',
                  'border-4 border-primary-200/20',
                  'disabled:opacity-70',
                )}
              >
                <motion.div
                  animate={isLoading ? { rotate: 360 } : {}}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                  {isLoading ? (
                    <Loader2 className="h-10 w-10 sm:h-12 sm:w-12 lg:h-14 lg:w-14" />
                  ) : (
                    <Mic className="h-10 w-10 sm:h-12 sm:w-12 lg:h-14 lg:w-14" />
                  )}
                </motion.div>
              </Button>

              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-12 sm:h-14 rounded-full px-5 sm:px-6 border-border/60 bg-background/80 shadow-md hover:-translate-y-0.5 transition-all"
              >
                <Link href="/text-chat" className="flex items-center">
                  <MessageSquare className="h-5 w-5 mr-2" />
                  チャット
                </Link>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center max-w-sm">
              マイクボタンでは音声が出ますのでご注意ください。チャットボタンからテキストチャットでの会話もできます。
            </p>
          </motion.div>

          <motion.div
            className="text-center space-y-2 sm:space-y-3 px-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h3 className="text-lg sm:text-xl font-semibold text-foreground tracking-tight">
              {statusText}
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
        </>
      ) : (
        <motion.div
          key="avatar-stage"
          className="w-full"
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <Card
            className={cn(
              'shadow-2xl border-border/30 bg-card/90 backdrop-blur',
              isFullscreenActive && 'rounded-none border-0 shadow-none bg-background h-full w-full',
            )}
          >
            <CardContent
              className={cn(
                'p-6 sm:p-10 flex flex-col items-center gap-6 sm:gap-8',
                isFullscreenActive &&
                  'min-h-[90vh] w-full pb-6 px-4 gap-5 sm:gap-8 justify-center items-center',
              )}
            >

              <div className={cn('relative w-full flex flex-col items-center', isFullscreenActive && 'mt-2')}>
                <motion.div
                  className="absolute inset-6 sm:inset-8 rounded-[2.5rem] border border-primary/40"
                  animate={
                    isAvatarSpeaking
                      ? { scale: [1, 1.03, 1], opacity: [0.5, 0.85, 0.5] }
                      : { opacity: 0.25 }
                  }
                  transition={{
                    duration: isAvatarSpeaking ? 1.2 : 0.6,
                    repeat: isAvatarSpeaking ? Infinity : 0,
                    ease: 'easeInOut',
                  }}
                />
                <div className="absolute inset-0 rounded-[2.5rem] bg-gradient-to-b from-primary/15 via-primary/5 to-transparent blur-xl opacity-70" />
                <div className={cn('relative flex items-center justify-center', avatarSizeClass)}>
                  <Image
                    src={avatarImageSrc}
                    alt="AIソムリエのアバター"
                    fill
                    sizes="(max-width: 768px) 240px, 320px"
                    className="object-contain drop-shadow-2xl pointer-events-none select-none"
                    priority
                  />
                </div>
                {isDelegating && (
                  <Badge
                    variant="secondary"
                    className="absolute -bottom-4 flex items-center gap-2 px-4 py-2 text-xs"
                  >
                    <Activity className="h-4 w-4 animate-pulse" />
                    購入候補を調査中
                  </Badge>
                )}
              </div>

              <motion.div
                className={cn('w-full', summaryWidthClass, isFullscreenActive && 'flex flex-col items-stretch')}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className={cn(
                  'rounded-2xl border border-border/60 bg-background/80 px-5 py-4 shadow-inner',
                  isFullscreenActive && 'h-full flex flex-col'
                )}>
                  {reasoningSummaryDisplay && (
                    <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-primary flex items-center gap-2 mb-2">
                      推論サマリ
                      {isTranslatingSummary && <Loader2 className="h-3 w-3 animate-spin" />}
                    </div>
                  )}
                  <div className={cn(
                    'overflow-y-auto pr-2 space-y-2 text-sm sm:text-base leading-relaxed text-foreground font-medium',
                    summaryHeightClass,
                  )}>
                    {reasoningSummaryDisplay && (
                      <p className="whitespace-pre-wrap">
                        {reasoningSummaryDisplay}
                      </p>
                    )}
                    {baseSubtitle && (!reasoningSummaryDisplay || baseSubtitle !== reasoningSummaryDisplay) && (
                      <p className="whitespace-pre-wrap">
                        {baseSubtitle}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>

              <div className={cn(isFullscreenActive && 'w-full px-3')}>
                {renderChatComposer('full')}
              </div>

              <div className="w-full flex flex-col items-center gap-3 sm:gap-4">
                {/* モバイル：丸ボタン横並び */}
                <div className="flex sm:hidden items-center justify-center gap-4">
                  <Button
                    onClick={handleToggleMute}
                    variant={isMuted ? 'secondary' : 'default'}
                    size="icon-lg"
                    className={cn(
                      'h-14 w-14 rounded-full shadow-lg',
                      !isMuted &&
                        'bg-gradient-to-br from-emerald-500 via-emerald-600 to-emerald-700 hover:from-emerald-400 hover:via-emerald-500 hover:to-emerald-600'
                    )}
                  >
                    {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                    <span className="sr-only">{isMuted ? 'ミュート解除' : 'ミュート'}</span>
                  </Button>
                  <Button
                    onClick={handleStopConversation}
                    variant="destructive"
                    size="icon-lg"
                    className="h-14 w-14 rounded-full shadow-lg"
                  >
                    <PhoneOff className="h-5 w-5" />
                    <span className="sr-only">終了</span>
                  </Button>
                </div>

                {/* タブレット以上：従来の横並びラージボタン */}
                <div className="hidden sm:flex w-full flex-col sm:flex-row gap-3">
                  <Button
                    onClick={handleToggleMute}
                    variant={isMuted ? 'secondary' : 'default'}
                    className={cn(
                      'flex-1 h-12 sm:h-14 text-base font-semibold shadow-lg',
                      !isMuted &&
                        'bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-500 hover:from-emerald-400 hover:via-emerald-500 hover:to-emerald-400',
                    )}
                  >
                    {isMuted ? (
                      <MicOff className="mr-2 h-5 w-5" />
                    ) : (
                      <Mic className="mr-2 h-5 w-5" />
                    )}
                    {isMuted ? 'ミュート解除' : 'ミュート'}
                  </Button>
                  <Button
                    onClick={handleStopConversation}
                    variant="destructive"
                    className="flex-1 h-12 sm:h-14 text-base font-semibold shadow-lg"
                  >
                    <PhoneOff className="mr-2 h-5 w-5" />
                    終了
                  </Button>
                </div>

                <div className="text-center space-y-2">
                  <p
                    className={cn(
                      'text-sm leading-relaxed',
                      error ? 'text-muted-foreground/70 line-through' : 'text-muted-foreground',
                    )}
                  >
                    {statusText}
                  </p>
                  {error && (
                    <p className="text-destructive text-sm font-semibold">
                      エラー: {error}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
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

        <p
          className={cn(
            'text-sm mb-4 leading-relaxed',
            error ? 'text-destructive font-medium' : 'text-muted-foreground',
          )}
        >
          {error ?? statusText}
        </p>

        {renderChatComposer('compact')}

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

  return (
    <>
      {isCompact ? compactContent : fullContent}
    </>
  );
}
