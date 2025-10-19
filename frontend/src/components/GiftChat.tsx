'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type {
  RealtimeSession,
  RealtimeSessionEventTypes,
} from '@openai/agents-realtime';
import {
  Mic,
  MicOff,
  Send,
  Loader2,
  MessageSquare,
  Sparkles,
  Volume2,
  Radio,
  CheckCircle2,
  Clock,
  Headphones,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { IntakeSummary } from '@/types/gift';
import type { PurchaseOffer, Sake, ShopListing } from '@/domain/sake/types';
import type { AgentRuntimeContext } from '@/infrastructure/openai/agents/context';
import {
  createGiftRealtimeBundle,
  type GiftAgentBundle,
} from '@/infrastructure/openai/realtime/giftSessionFactory';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  mode: 'text' | 'voice';
  timestamp: Date;
};

type RecommendationViewModel = {
  summary: string;
  offer: PurchaseOffer | null;
};

interface GiftChatProps {
  giftId: string;
  sessionId: string;
  onCompleted?: (payload: {
    summary: string;
    intakeSummary: IntakeSummary | null;
  }) => void;
}

const TEXT_PREFIX = '[TEXT]';

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

  for (const key of ['message', 'error', 'details', 'reason']) {
    if (key in (input as Record<string, unknown>)) {
      const msg = extractErrorMessage(
        (input as Record<string, unknown>)[key],
        seen,
      );
      if (msg) return msg;
    }
  }

  for (const value of Object.values(input as Record<string, unknown>)) {
    const msg = extractErrorMessage(value, seen);
    if (msg) return msg;
  }

  return undefined;
}

function transformRecommendationPayload(payload: unknown): RecommendationViewModel | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  const record = payload as Record<string, unknown>;
  const sakePayload = record.sake;
  const shopsPayload = record.shops;
  const summary = typeof record.summary === 'string' ? record.summary : null;
  const reasoning = typeof record.reasoning === 'string' ? record.reasoning : null;

  if (!sakePayload || typeof sakePayload !== 'object' || !Array.isArray(shopsPayload)) {
    return null;
  }

  const sakeRecord = sakePayload as Record<string, unknown>;
  const shopList = shopsPayload as Array<Record<string, unknown>>;

  const sake: Sake = {
    id: typeof sakeRecord.id === 'string' ? sakeRecord.id : undefined,
    name: typeof sakeRecord.name === 'string' ? sakeRecord.name : '日本酒',
    brewery: typeof sakeRecord.brewery === 'string' ? sakeRecord.brewery : undefined,
    region: typeof sakeRecord.region === 'string' ? sakeRecord.region : undefined,
    type: typeof sakeRecord.type === 'string' ? sakeRecord.type : undefined,
    alcohol: typeof sakeRecord.alcohol === 'number' ? sakeRecord.alcohol : undefined,
    sakeValue: typeof sakeRecord.sake_value === 'number' ? sakeRecord.sake_value : undefined,
    acidity: typeof sakeRecord.acidity === 'number' ? sakeRecord.acidity : undefined,
    description: typeof sakeRecord.description === 'string' ? sakeRecord.description : undefined,
    tastingNotes: Array.isArray(sakeRecord.tasting_notes)
      ? sakeRecord.tasting_notes.filter((note): note is string => typeof note === 'string')
      : undefined,
    foodPairing: Array.isArray(sakeRecord.food_pairing)
      ? sakeRecord.food_pairing.filter((item): item is string => typeof item === 'string')
      : undefined,
    servingTemperature: Array.isArray(sakeRecord.serving_temperature)
      ? sakeRecord.serving_temperature.filter((item): item is string => typeof item === 'string')
      : undefined,
    imageUrl: typeof sakeRecord.image_url === 'string' ? sakeRecord.image_url : '',
    originSources: Array.isArray(sakeRecord.origin_sources)
      ? sakeRecord.origin_sources.filter((item): item is string => typeof item === 'string')
      : undefined,
    priceRange: typeof sakeRecord.price_range === 'string' ? sakeRecord.price_range : undefined,
    flavorProfile:
      sakeRecord.flavor_profile && typeof sakeRecord.flavor_profile === 'object'
        ? (sakeRecord.flavor_profile as Record<string, number | null>)
        : undefined,
  };

  const shops: ShopListing[] = shopList
    .map<ShopListing | null>((shop) => {
      const retailer = typeof shop.retailer === 'string' ? shop.retailer : null;
      const url = typeof shop.url === 'string' ? shop.url : null;
      if (!retailer || !url) {
        return null;
      }
      return {
        retailer,
        url,
        price: typeof shop.price === 'number' ? shop.price : undefined,
        priceText: typeof shop.price_text === 'string' ? shop.price_text : undefined,
        currency: typeof shop.currency === 'string' ? shop.currency : undefined,
        availability: typeof shop.availability === 'string' ? shop.availability : undefined,
        deliveryEstimate: typeof shop.delivery_estimate === 'string'
          ? shop.delivery_estimate
          : undefined,
        source: typeof shop.source === 'string' ? shop.source : undefined,
        notes: typeof shop.notes === 'string' ? shop.notes : undefined,
      };
    })
    .filter((shop): shop is ShopListing => Boolean(shop));

  const offer: PurchaseOffer = {
    sake,
    shops,
    summary: summary ?? 'ギフトに最適な一本です。',
    reasoning: reasoning ?? '',
    tastingHighlights: Array.isArray(record.tasting_highlights)
      ? record.tasting_highlights.filter((item): item is string => typeof item === 'string')
      : undefined,
    servingSuggestions: Array.isArray(record.serving_suggestions)
      ? record.serving_suggestions.filter((item): item is string => typeof item === 'string')
      : undefined,
    updatedAt: new Date().toISOString(),
  };

  return {
    summary: summary ?? reasoning ?? 'ギフトに最適な日本酒を見つけました。',
    offer,
  };
}

export default function GiftChat({ giftId, sessionId, onCompleted }: GiftChatProps) {
  const sessionRef = useRef<RealtimeSession<AgentRuntimeContext> | null>(null);
  const bundleRef = useRef<GiftAgentBundle | null>(null);
  const assistantMessageIdsRef = useRef<Set<string>>(new Set());
  const userMessageIdsRef = useRef<Set<string>>(new Set());
  const pendingEchoRef = useRef<Set<string>>(new Set());
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completionSummary, setCompletionSummary] = useState<string | null>(null);
  const [intakeSummary, setIntakeSummary] = useState<IntakeSummary | null>(null);
const [recommendation, setRecommendation] = useState<RecommendationViewModel | null>(null);
const [recommendationStatus, setRecommendationStatus] = useState<'idle' | 'pending' | 'ready' | 'error'>('idle');
const [lastServerStatus, setLastServerStatus] = useState<string | null>(null);
const [hasAttemptedConnect, setHasAttemptedConnect] = useState(false);

  const isInputDisabled = !isConnected || isMuted || isCompleting || isFinished;

  const addMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => {
      const exists = prev.some((m) => m.id === message.id && m.role === message.role);
      if (exists) {
        return prev.map((m) => (m.id === message.id && m.role === message.role ? { ...m, text: message.text, timestamp: message.timestamp } : m));
      }
      return [...prev, message];
    });
  }, []);

  const appendUserMessage = useCallback((text: string, mode: 'text' | 'voice') => {
    const trimmed = text.startsWith(TEXT_PREFIX)
      ? text.slice(TEXT_PREFIX.length).trim()
      : text.trim();
    if (!trimmed) return;
    const id = `user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    addMessage({
      id,
      role: 'user',
      text: trimmed,
      mode,
      timestamp: new Date(),
    });
  }, [addMessage]);

  const appendAssistantMessage = useCallback((id: string, text: string, mode: 'text' | 'voice') => {
    if (!text.trim()) return;
    addMessage({
      id,
      role: 'assistant',
      text,
      mode,
      timestamp: new Date(),
    });
  }, [addMessage]);

  useEffect(() => {
    if (!scrollAreaRef.current) return;
    const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
    if (viewport instanceof HTMLElement) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const bundle = createGiftRealtimeBundle(giftId, sessionId, {
      onError: (msg) => {
        setError(msg);
      },
      onGiftIntakeCompleted: ({ summary, intakeSummary: intake }) => {
        setCompletionSummary(summary);
        setIntakeSummary(intake);
        setIsFinished(true);
        setIsCompleting(false);
        setIsConnected(false);
        onCompleted?.({ summary, intakeSummary: intake });
        try {
          sessionRef.current?.close();
        } catch {
          // ignore close errors
        }
      },
    });

    bundleRef.current = bundle;
    sessionRef.current = bundle.session;
    setHasAttemptedConnect(false);

    type SessionEvents = RealtimeSessionEventTypes<AgentRuntimeContext>;

    const extractTextFromContent = (content: unknown[]): { text: string; mode: 'text' | 'voice' } | null => {
      const fragments: string[] = [];
      let mode: 'text' | 'voice' = 'text';
      for (const piece of content) {
        if (!piece || typeof piece !== 'object') continue;
        const part = piece as Record<string, unknown>;
        if (part.type === 'output_text' && typeof part.text === 'string') {
          fragments.push(part.text);
          mode = 'text';
        } else if (part.type === 'output_audio' && typeof part.transcript === 'string') {
          fragments.push(part.transcript);
          mode = 'voice';
        } else if (part.type === 'input_text' && typeof part.text === 'string') {
          fragments.push(part.text);
        }
      }
      if (fragments.length === 0) {
        return null;
      }
      return {
        text: fragments.join('\n').trim(),
        mode,
      };
    };

    const handleHistoryAdded = (item: unknown) => {
      if (!item || typeof item !== 'object') return;
      const record = item as Record<string, unknown>;
      if (record.type !== 'message') return;
      const role = typeof record.role === 'string' ? record.role : null;
      if (!role || (role !== 'user' && role !== 'assistant')) {
        return;
      }
      const rawContent = Array.isArray(record.content) ? record.content : [];
      const parsed = extractTextFromContent(rawContent);
      if (!parsed || !parsed.text) {
        return;
      }

      const itemId = typeof record.itemId === 'string'
        ? record.itemId
        : `${role}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

      if (role === 'assistant') {
        if (assistantMessageIdsRef.current.has(itemId) && parsed.mode === 'voice') {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === itemId && m.role === 'assistant'
                ? { ...m, text: parsed.text, timestamp: new Date() }
                : m,
            ),
          );
          return;
        }
        assistantMessageIdsRef.current.add(itemId);
        appendAssistantMessage(itemId, parsed.text, parsed.mode);
      } else {
        const cleaned = parsed.text.startsWith(TEXT_PREFIX)
          ? parsed.text.slice(TEXT_PREFIX.length).trim()
          : parsed.text;
        if (!cleaned) return;
        if (pendingEchoRef.current.has(cleaned)) {
          pendingEchoRef.current.delete(cleaned);
          return;
        }
        if (userMessageIdsRef.current.has(itemId)) {
          return;
        }
        userMessageIdsRef.current.add(itemId);
        appendUserMessage(cleaned, parsed.mode);
      }
    };

    const handleError = (event: SessionEvents['error'][0]) => {
      const msg = extractErrorMessage(event) ?? '通信エラーが発生しました';
      setError(msg);
      setIsConnecting(false);
    };

    bundle.session.on('history_added', handleHistoryAdded);
    bundle.session.on('error', handleError);
    bundle.session.on('agent_tool_start', (...[, , tool]: SessionEvents['agent_tool_start']) => {
      if (tool.name === 'complete_gift_intake') {
        setIsCompleting(true);
      }
    });
    bundle.session.on('agent_tool_end', (...[, , tool]: SessionEvents['agent_tool_end']) => {
      if (tool.name === 'complete_gift_intake') {
        setIsCompleting(false);
      }
    });

    return () => {
      try {
        bundle.session.close();
      } catch {
        // ignore errors during cleanup
      }
      bundleRef.current = null;
      sessionRef.current = null;
    };
  }, [giftId, sessionId, appendAssistantMessage, appendUserMessage, addMessage, onCompleted]);

  const connectToSession = useCallback(async () => {
    if (!sessionRef.current) return;
    setIsConnecting(true);
    setError(null);
    try {
      const response = await fetch('/api/client-secret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json().catch(() => null) as { value?: string; error?: unknown } | null;
      if (!response.ok || !data?.value) {
        const details =
          typeof data?.error === 'string'
            ? data.error
            : '接続用キーの取得に失敗しました';
        throw new Error(details);
      }

      await sessionRef.current.connect({ apiKey: data.value });
      sessionRef.current.mute(false);
      setIsMuted(false);
      setIsConnected(true);
      setIsConnecting(false);
      addMessage({
        id: `system-${Date.now().toString(36)}`,
        role: 'assistant',
        text: 'こんにちは！日本酒ギフトの好みについて、気軽にお話ししましょう。',
        mode: 'voice',
        timestamp: new Date(),
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '接続に失敗しました';
      setError(message);
      setIsConnecting(false);
      setIsConnected(false);
      try {
        sessionRef.current?.close();
      } catch {
        // ignore
      }
    }
  }, [addMessage]);

  useEffect(() => {
    if (
      !sessionRef.current ||
      isConnected ||
      isConnecting ||
      isFinished ||
      hasAttemptedConnect
    ) {
      return;
    }
    setHasAttemptedConnect(true);
    void connectToSession();
  }, [connectToSession, isConnected, isConnecting, isFinished, hasAttemptedConnect]);

  const handleToggleMute = () => {
    if (!sessionRef.current || !isConnected) return;
    const nextMuted = !isMuted;
    try {
      sessionRef.current.mute(nextMuted);
      setIsMuted(nextMuted);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'ミュート切り替えに失敗しました';
      setError(message);
    }
  };

  const handleRetryConnect = () => {
    if (isConnecting || isConnected || isFinished) {
      return;
    }
    setHasAttemptedConnect(false);
    setError(null);
  };

  const handleSendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || !sessionRef.current || !isConnected || isMuted) {
      return;
    }
    setInput('');
    pendingEchoRef.current.add(trimmed);
    appendUserMessage(trimmed, 'text');
    try {
      sessionRef.current.sendMessage(
        {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: `${TEXT_PREFIX} ${trimmed}` }],
        },
        {
          response: {
            modalities: ['text'],
            instructions:
              'ユーザーがテキスト入力を行ったので、テキストのみで短く応答してください。音声は生成しないでください。',
          },
        },
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'メッセージ送信に失敗しました';
      setError(message);
    }
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSendMessage();
    }
  };

  useEffect(() => {
    if (!isFinished) return;
    setRecommendationStatus('pending');
    let active = true;

    const fetchRecommendation = async () => {
      try {
        const res = await fetch(`/api/gift/${giftId}/recommendation`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!res.ok) {
          throw new Error(`推薦結果の取得に失敗しました (${res.status})`);
        }
        const data = await res.json() as {
          status: string;
          recommendation: unknown;
        };
        if (!active) return;
        setLastServerStatus(data.status);
        if (data.status === 'RECOMMEND_READY' && data.recommendation) {
          const transformed = transformRecommendationPayload(data.recommendation);
          if (transformed) {
            setRecommendation(transformed);
            setRecommendationStatus('ready');
            return true;
          }
        }
        if (data.status === 'CLOSED') {
          setRecommendationStatus('error');
          setError('推薦結果の取得に失敗しました。時間をおいて再度アクセスしてください。');
          return true;
        }
        return false;
      } catch (err) {
        if (!active) return true;
        console.error('Failed to fetch gift recommendation', err);
        setRecommendationStatus('error');
        setError(
          err instanceof Error
            ? err.message
            : '推薦結果の取得に失敗しました。時間をおいて再度お試しください。',
        );
        return true;
      }
    };

    let cancelled = false;
    void (async () => {
      const completed = await fetchRecommendation();
      if (completed) {
        cancelled = true;
        return;
      }
      const interval = setInterval(async () => {
        const done = await fetchRecommendation();
        if (done) {
          clearInterval(interval);
          cancelled = true;
        }
      }, 5000);
      if (cancelled) {
        clearInterval(interval);
      }
    })();

    return () => {
      active = false;
    };
  }, [giftId, isFinished]);

  const completionHints = useMemo(() => {
    if (!intakeSummary) return [];
    const hints: string[] = [];
    if (intakeSummary.sweetness_dryness) {
      hints.push(`好みの味わい: ${intakeSummary.sweetness_dryness}`);
    }
    if (Array.isArray(intakeSummary.aroma) && intakeSummary.aroma.length > 0) {
      hints.push(`香り: ${intakeSummary.aroma.join(' / ')}`);
    }
    if (Array.isArray(intakeSummary.temperature_preference) && intakeSummary.temperature_preference.length > 0) {
      hints.push(`飲みたい温度: ${intakeSummary.temperature_preference.join(' / ')}`);
    }
    if (Array.isArray(intakeSummary.food_pairing) && intakeSummary.food_pairing.length > 0) {
      hints.push(`一緒に食べたいもの: ${intakeSummary.food_pairing.join(' / ')}`);
    }
    if (intakeSummary.notes) {
      hints.push(intakeSummary.notes);
    }
    return hints;
  }, [intakeSummary]);

  if (isFinished) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4 py-10">
        <Card className="w-full max-w-3xl glass shadow-2xl border-border/40">
          <CardHeader className="space-y-3 text-center">
            <div className="flex justify-center">
              <div className="rounded-full bg-primary/10 p-3 border border-primary/30">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">
              ありがとうございました！
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              いただいたお話をもとに、日本酒ソムリエが最適な1本を選定しています。
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {completionSummary && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm leading-relaxed space-y-2">
                <div className="flex items-center gap-2 text-primary font-semibold">
                  <MessageSquare className="h-4 w-4" />
                  会話のまとめ
                </div>
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {completionSummary}
                </p>
              </div>
            )}

            {completionHints.length > 0 && (
              <div className="rounded-xl border border-border/40 bg-muted/40 p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Radio className="h-4 w-4" />
                  贈り主にお伝えするポイント
                </div>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  {completionHints.map((hint) => (
                    <li key={hint}>{hint}</li>
                  ))}
                </ul>
              </div>
            )}

            <AnimatePresence>
              {recommendationStatus === 'pending' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="rounded-xl border border-border/40 bg-background/90 p-4 flex items-center gap-3 text-sm text-muted-foreground shadow-inner"
                >
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <div>
                    日本酒ソムリエが購入先を調べています…
                    <div className="text-xs text-muted-foreground/80 mt-1">
                      {lastServerStatus === 'HANDOFFED'
                        ? '在庫やギフト包装が整うショップを整理しています。'
                        : '少々お待ちください。'}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {recommendationStatus === 'ready' && recommendation && recommendation.offer && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    推薦が届きました
                  </Badge>
                </div>
                <div className="rounded-2xl border border-border/40 bg-background/95 p-5 shadow-lg space-y-4">
                  <div className="flex flex-col gap-2">
                    <h3 className="text-xl font-semibold gradient-text">
                      {recommendation.offer.sake.name}
                    </h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                      {recommendation.summary}
                    </p>
                  </div>

                  <div className="space-y-3 text-sm text-muted-foreground">
                    {recommendation.offer.sake.tastingNotes && recommendation.offer.sake.tastingNotes.length > 0 && (
                      <div>
                        <div className="font-semibold text-foreground flex items-center gap-2 text-sm">
                          <Sparkles className="h-4 w-4" />
                          味わいの特徴
                        </div>
                        <p className="leading-relaxed mt-1">
                          {recommendation.offer.sake.tastingNotes.join(' / ')}
                        </p>
                      </div>
                    )}
                    {recommendation.offer.servingSuggestions && recommendation.offer.servingSuggestions.length > 0 && (
                      <div>
                        <div className="font-semibold text-foreground flex items-center gap-2 text-sm">
                          <Headphones className="h-4 w-4" />
                          美味しい楽しみ方
                        </div>
                        <p className="leading-relaxed mt-1">
                          {recommendation.offer.servingSuggestions.join(' / ')}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Volume2 className="h-4 w-4" />
                      ギフト対応ショップ
                    </div>
                    <div className="space-y-2">
                      {recommendation.offer.shops.map((shop) => (
                        <a
                          key={`${shop.retailer}-${shop.url}`}
                          href={shop.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block rounded-xl border border-border/30 bg-muted/40 px-4 py-3 hover:bg-muted/60 transition-colors"
                        >
                          <div className="flex items-center justify-between text-sm font-medium text-foreground">
                            <span>{shop.retailer}</span>
                            {shop.price ? (
                              <span className="text-primary font-semibold">
                                ¥{shop.price.toLocaleString()}
                              </span>
                            ) : shop.priceText ? (
                              <span className="text-primary font-semibold">{shop.priceText}</span>
                            ) : null}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground space-y-1">
                            {shop.availability && <div>在庫: {shop.availability}</div>}
                            {shop.deliveryEstimate && <div>お届け目安: {shop.deliveryEstimate}</div>}
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {recommendationStatus === 'error' && (
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                推薦結果を取得できませんでした。時間をおいて再度アクセスするか、贈り主にご連絡ください。
              </div>
            )}

            <div className="text-xs text-muted-foreground text-center">
              このページは閉じても構いません。贈り主の方が同じリンクから結果を確認できます。
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-3xl glass shadow-2xl border-border/40">
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-2 border border-primary/20">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl font-semibold">
                  日本酒ギフトアシスタント
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  どんな方に贈るのか教えてください。価格の話題は大丈夫です。
                </p>
              </div>
            </div>
            <Badge
              variant={isConnected ? 'default' : 'outline'}
              className={cn(
                'gap-1',
                isConnected ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' : 'text-muted-foreground',
              )}
            >
              {isConnected ? (
                <>
                  <Radio className="h-3.5 w-3.5 animate-pulse" />
                  接続中
                </>
              ) : (
                <>
                  <Clock className="h-3.5 w-3.5" />
                  接続準備中
                </>
              )}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-xl border border-border/40 bg-background/70 shadow-inner">
            <ScrollArea ref={scrollAreaRef} className="h-[420px] p-5">
              <div className="space-y-4">
                {messages.length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-10">
                    こんにちは！接続が完了すると、ここに会話が表示されます。
                  </div>
                )}
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className={cn(
                      'flex gap-3',
                      message.role === 'assistant' ? 'flex-row' : 'flex-row-reverse',
                    )}
                  >
                    <Avatar
                      className={cn(
                        'h-9 w-9 border',
                        message.role === 'assistant'
                          ? 'border-primary/30 bg-primary/10'
                          : 'border-border bg-background',
                      )}
                    >
                      <AvatarFallback className="text-xs">
                        {message.role === 'assistant' ? 'AI' : 'YOU'}
                      </AvatarFallback>
                    </Avatar>
                    <div
                      className={cn(
                        'rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm max-w-[75%] whitespace-pre-wrap',
                        message.role === 'assistant'
                          ? 'bg-primary/10 border border-primary/20 text-foreground'
                          : 'bg-muted border border-border/60 text-foreground',
                      )}
                    >
                      {message.mode === 'voice' && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                          <Headphones className="h-3 w-3" />
                          音声からの内容
                        </div>
                      )}
                      {message.text}
                    </div>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-center justify-between gap-3"
            >
              <span className="flex-1">{error}</span>
              {!isConnected && !isConnecting && !isFinished && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetryConnect}
                  className="border-destructive/40 text-destructive hover:text-destructive"
                >
                  再接続
                </Button>
              )}
            </motion.div>
          )}

          <div className="flex items-center gap-3">
            <Input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isMuted
                  ? 'マイクをオンにすると会話できます'
                  : 'テキストで伝えたい場合はこちらに入力'
              }
              disabled={isInputDisabled}
            />
            <Button
              onClick={handleSendMessage}
              disabled={isInputDisabled || input.trim().length === 0}
            >
              {isCompleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <Button
              onClick={handleToggleMute}
              variant={isMuted ? 'secondary' : 'default'}
              className={cn(
                'flex items-center gap-2 px-4',
                !isMuted && 'bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600',
              )}
              disabled={!isConnected || isCompleting}
            >
              {isMuted ? (
                <>
                  <MicOff className="h-4 w-4" />
                  マイクをオン
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4" />
                  マイクをミュート
                </>
              )}
            </Button>
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <Loader2
                className={cn(
                  'h-4 w-4',
                  isCompleting ? 'animate-spin text-primary' : 'opacity-0',
                )}
              />
              {isCompleting
                ? '聞き取った内容を整理しています…'
                : isMuted
                  ? 'マイクをオンにすると声で会話できます'
                  : '会話中です'}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
