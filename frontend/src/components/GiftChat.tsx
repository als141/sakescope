'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  RealtimeSession,
  RealtimeSessionEventTypes,
} from '@openai/agents-realtime';
import { Mic, MicOff, Send, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { IntakeSummary } from '@/types/gift';
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

export default function GiftChat({ giftId, sessionId, onCompleted }: GiftChatProps) {
  const realtimeModel =
    process.env.NEXT_PUBLIC_OPENAI_REALTIME_MODEL ?? 'gpt-realtime-mini';
  const sessionRef = useRef<RealtimeSession<AgentRuntimeContext> | null>(null);
  const connectedSessionRef = useRef<RealtimeSession<AgentRuntimeContext> | null>(null);
  const bundleRef = useRef<GiftAgentBundle | null>(null);
  const assistantMessageIdsRef = useRef<Set<string>>(new Set());
  const userMessageIdsRef = useRef<Set<string>>(new Set());
  const pendingEchoRef = useRef<Set<string>>(new Set());
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
const composerRef = useRef<HTMLInputElement | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAttemptedConnect, setHasAttemptedConnect] = useState(false);

  const isInputDisabled = !isConnected || isCompleting || isFinished;

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

  const upsertAssistantMessage = useCallback(
    (
      id: string,
      text: string,
      mode: 'text' | 'voice',
      options: { append?: boolean } = {},
    ) => {
      if (!id || typeof text !== 'string') {
        return;
      }
      const { append = false } = options;
      assistantMessageIdsRef.current.add(id);
      setMessages((prev) => {
        const index = prev.findIndex((message) => message.id === id && message.role === 'assistant');
        if (index === -1) {
          const next: ChatMessage = {
            id,
            role: 'assistant',
            text,
            mode,
            timestamp: new Date(),
          };
          return [...prev, next];
        }
        const existing = prev[index];
        const updatedText = append ? `${existing.text}${text}` : text;
        if (updatedText === existing.text && existing.mode === mode) {
          return prev;
        }
        const nextMessage: ChatMessage = {
          ...existing,
          text: updatedText,
          mode,
          timestamp: new Date(),
        };
        const next = [...prev];
        next[index] = nextMessage;
        return next;
      });
    },
    [],
  );

  useEffect(() => {
    if (!scrollAreaRef.current) return;
    const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
    if (viewport instanceof HTMLElement) {
      viewport.scrollTo({
        top: viewport.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages]);

  useEffect(() => {
    const bundle = createGiftRealtimeBundle(giftId, sessionId, {
      onError: (msg) => {
        setError(msg);
      },
      onGiftIntakeCompleted: ({ summary, intakeSummary: intake }) => {
        setIsFinished(true);
        setIsCompleting(false);
        setIsConnected(false);
        onCompleted?.({ summary, intakeSummary: intake });
        connectedSessionRef.current = null;
        try {
          sessionRef.current?.close();
        } catch {
          // ignore close errors
        }
      },
    });

    bundleRef.current = bundle;
    sessionRef.current = bundle.session;
    connectedSessionRef.current = null;
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
        upsertAssistantMessage(itemId, parsed.text, parsed.mode);
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
      connectedSessionRef.current = null;
    };

    const handleTransportEvent = (event: SessionEvents['transport_event'][0]) => {
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
          upsertAssistantMessage(itemId, delta, 'text', { append: true });
        }
        return;
      }
      if (type === 'response.output_text.done') {
        const finalText = (event as { text?: unknown }).text;
        if (typeof finalText === 'string') {
          upsertAssistantMessage(itemId, finalText, 'text');
        }
        return;
      }
      if (type === 'response.output_audio_transcript.delta') {
        const transcriptDelta = (event as { delta?: unknown }).delta;
        if (typeof transcriptDelta === 'string' && transcriptDelta.length > 0) {
          upsertAssistantMessage(itemId, transcriptDelta, 'voice', { append: true });
        }
        return;
      }
      if (type === 'response.output_audio_transcript.done') {
        const transcript = (event as { transcript?: unknown }).transcript;
        if (typeof transcript === 'string') {
          upsertAssistantMessage(itemId, transcript, 'voice');
        }
      }
    };

    bundle.session.on('history_added', handleHistoryAdded);
    bundle.session.on('transport_event', handleTransportEvent);
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
      bundle.session.off('history_added', handleHistoryAdded);
      bundle.session.off('transport_event', handleTransportEvent);
      bundle.session.off('error', handleError);
      if (connectedSessionRef.current === bundle.session) {
        connectedSessionRef.current = null;
      }
      try {
        bundle.session.close();
      } catch {
        // ignore errors during cleanup
      }
      bundleRef.current = null;
      sessionRef.current = null;
    };
  }, [giftId, sessionId, upsertAssistantMessage, appendUserMessage, addMessage, onCompleted]);

  const connectToSession = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) {
      return;
    }
    if (connectedSessionRef.current === session) {
      return;
    }

    connectedSessionRef.current = session;
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

      await session.connect({ apiKey: data.value, model: realtimeModel });
      if (connectedSessionRef.current !== session) {
        setIsConnecting(false);
        try {
          session.close();
        } catch {
          // ignore
        }
        return;
      }
      session.mute(false);
      setIsMuted(false);
      setIsConnected(true);
      setIsConnecting(false);
    } catch (err) {
      if (connectedSessionRef.current === session) {
        connectedSessionRef.current = null;
      }
      const message =
        err instanceof Error ? err.message : '接続に失敗しました';
      setError(message);
      setIsConnecting(false);
      setIsConnected(false);
      try {
        if (session === sessionRef.current) {
          sessionRef.current?.close();
        } else {
          session.close();
        }
      } catch {
        // ignore
      }
    }
  }, [addMessage, realtimeModel]);

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

  const handleSendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || !sessionRef.current || !isConnected) {
      return;
    }
    setInput('');
    pendingEchoRef.current.add(trimmed);
    appendUserMessage(trimmed, 'text');
    try {
      sessionRef.current.sendMessage({
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: `${TEXT_PREFIX} ${trimmed}` }],
      });
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

  const latestAssistantMessage = useMemo(() => {
    const assistantMessages = messages.filter((message) => message.role === 'assistant');
    return assistantMessages[assistantMessages.length - 1]?.text ?? null;
  }, [messages]);

  const subtitleText = latestAssistantMessage
    ?? (isConnecting
      ? 'AIが接続中です…'
      : isMuted
        ? 'マイクをオンにするか、テキストで好みを入力してください'
        : 'AIが耳を傾けています。普段の飲み方や好きな香り・味わいから教えてください。');

  const avatarImageSrc = !isMuted && isConnected
    ? '/ai-avatar/open.png'
    : '/ai-avatar/close.png';

  const statusHelper = isCompleting
    ? '聞き取った内容を整理しています…'
    : isMuted
      ? 'マイクはオフですが、テキストで伝えれば大丈夫です'
      : '会話中です';

  const avatarSizeClass = isConnected
    ? 'w-[300px] h-[300px] sm:w-[380px] sm:h-[380px]'
    : 'w-[240px] h-[240px] sm:w-[300px] sm:h-[300px]';
  const summaryHeightClass =
    'max-h-[14vh] min-h-[96px] h-auto sm:h-[18vh] sm:min-h-[128px] sm:max-h-[22vh]';

  return (
    <div
      className={cn(
        // モバイル: 全画面オーバーレイ
        'fixed inset-0 z-40 h-[100dvh] bg-background overflow-hidden px-3 py-3 flex items-center justify-center',
        // デスクトップ: 従来のセンター寄せ
        'sm:static sm:min-h-screen sm:h-auto sm:overflow-visible sm:px-6 sm:py-12',
      )}
    >
      <Card
        className={cn(
          'w-full h-full max-w-full border-0 shadow-none rounded-none overflow-hidden flex flex-col',
          'sm:h-auto sm:max-w-4xl sm:border-border/40 sm:shadow-2xl sm:rounded-3xl',
        )}
      >
        <CardHeader className="text-center space-y-1 pt-4 pb-2 sm:pt-6 sm:pb-4">
          <div className="flex items-center justify-center gap-3">
            <div className="rounded-full bg-primary/10 p-2 border border-primary/20">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="text-xl font-semibold">日本酒お好みアシスタント</CardTitle>
          </div>
        </CardHeader>
        <CardContent
          className={cn(
            'flex flex-col items-center gap-5 sm:gap-8 flex-1 sm:flex-none h-[calc(100dvh-140px)] sm:h-auto overflow-y-auto sm:overflow-visible px-2 sm:px-6 pb-6 sm:pb-8',
          )}
        >
          <div className="relative w-full flex flex-col items-center">
            <div className={cn('relative flex items-center justify-center', avatarSizeClass)}>
              <Image
                src={avatarImageSrc}
                alt="日本酒お好みアシスタント"
                fill
                sizes="(max-width: 768px) 360px, 420px"
                className="object-contain drop-shadow-2xl pointer-events-none select-none"
                priority
              />
            </div>
            {isCompleting && (
              <Badge variant="secondary" className="mt-2">
                情報整理中…
              </Badge>
            )}
          </div>

          <div className="w-full max-w-2xl sm:max-w-3xl">
            <div className="rounded-2xl border border-border/60 bg-background/80 px-5 py-4 shadow-inner">
              <div
                className={cn(
                  'overflow-y-auto pr-2 text-sm sm:text-base leading-relaxed text-foreground font-medium',
                  summaryHeightClass,
                )}
              >
                <p className="whitespace-pre-wrap">{subtitleText}</p>
              </div>
            </div>
          </div>

          <div className="w-full max-w-2xl sm:max-w-3xl flex flex-row items-stretch gap-3">
            <Input
              ref={composerRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isMuted ? 'テキストで好みを教えてください（マイクはオフです）' : 'テキストで補足したい内容を入力してください'}
              className="flex-1 h-12 rounded-2xl border border-border/60 bg-background/80 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              disabled={isInputDisabled}
            />
            <Button
              onClick={handleSendMessage}
              disabled={isInputDisabled || input.trim().length === 0}
              className="h-12 px-6 rounded-2xl flex items-center gap-2"
            >
              {isCompleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              送信
            </Button>
          </div>

          <div className="text-sm text-muted-foreground text-center space-y-1">
            <p>{statusHelper}</p>
            {error && <p className="text-destructive">{error}</p>}
          </div>

          <div className="flex items-center justify-center gap-3">
            <Button
              onClick={handleToggleMute}
              variant={isMuted ? 'secondary' : 'default'}
              className={cn(
                'flex items-center gap-2 px-4 rounded-2xl',
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
