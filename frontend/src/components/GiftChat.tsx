'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type {
  RealtimeSession,
  RealtimeSessionEventTypes,
} from '@openai/agents-realtime';
import { Mic, MicOff, Send, Loader2, Sparkles, Headphones } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    if (isConnected && !isMuted && composerRef.current) {
      composerRef.current.focus();
    }
  }, [isConnected, isMuted]);

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
      addMessage({
        id: `system-${Date.now().toString(36)}`,
        role: 'assistant',
        text: 'こんにちは！日本酒ギフトの好みについて、気軽にお話ししましょう。',
        mode: 'voice',
        timestamp: new Date(),
      });
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

  const handleRetryConnect = () => {
    if (isConnecting || isConnected || isFinished) {
      return;
    }
    connectedSessionRef.current = null;
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

  const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSendMessage();
    }
  };

  if (isFinished) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4 py-10">
        <Card className="w-full max-w-2xl glass shadow-2xl border-border/40">
          <CardHeader className="space-y-4 text-center">
            <div className="flex justify-center">
              <div className="rounded-full bg-primary/10 p-3 border border-primary/30">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">会話は終了しました！</CardTitle>
            <p className="text-sm text-muted-foreground">
              ありがとうございました。まもなく送り主へ推薦結果が共有されます。
            </p>
          </CardHeader>
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
                <CardTitle className="text-xl font-semibold">日本酒ギフトアシスタント</CardTitle>
                <p className="text-sm text-muted-foreground">どんな相手に贈るのか、落ち着いて教えてください。</p>
              </div>
            </div>
            <Badge variant="secondary" className="px-3 py-1 text-[10px] tracking-[0.3em] uppercase">
              {isConnected ? (isMuted ? 'TEXT' : 'VOICE') : isConnecting ? 'CONNECTING' : 'STANDBY'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-3xl border border-border/40 bg-muted/30">
            <ScrollArea ref={scrollAreaRef} className="h-[420px] px-5 py-6">
              <div className="space-y-4">
                {messages.length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-10">
                    AIとの会話内容がここに表示されます。
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
                        'h-9 w-9 border shadow-sm',
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
                          : 'bg-background border border-border/60 text-foreground',
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
              className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-center justify-between gap-3"
            >
              <span className="flex-1">{error}</span>
              {!isConnected && !isConnecting && (
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

          <div className="rounded-3xl border border-border/50 bg-background/80 p-4 space-y-3">
            <label className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              テキストで補足
            </label>
            <textarea
              ref={composerRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isMuted ? 'マイクをオンにすると声で回答できます' : 'テキストで伝えたい内容を入力してください'}
              className="w-full min-h-[80px] resize-none rounded-2xl border border-border/60 bg-background px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
              disabled={isInputDisabled}
            />
            <div className="flex items-center justify-between gap-3">
              <Button
                onClick={handleSendMessage}
                disabled={isInputDisabled || input.trim().length === 0}
                className="h-11 px-6 rounded-2xl"
              >
                {isCompleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    送信
                  </>
                )}
              </Button>
              <p className="text-[11px] text-muted-foreground">Enterで送信 / Shift+Enterで改行</p>
            </div>
          </div>

          <div className="flex items-center justify-between">
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
                  ? 'テキストで追加できます'
                  : 'AIはあなたの声を聞いています'}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
