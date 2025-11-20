'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type {
  RealtimeSession,
  RealtimeSessionEventTypes,
} from '@openai/agents-realtime';
import { Mic, MicOff, Send, Loader2, Sparkles, PhoneOff, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
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
  const chatInputRef = useRef<HTMLInputElement | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAttemptedConnect, setHasAttemptedConnect] = useState(false);
  const [isSendingChat, setIsSendingChat] = useState(false);

  // Avatar animation state
  const [isAvatarSpeaking, setIsAvatarSpeaking] = useState(false);
  const [isMouthOpenFrame, setIsMouthOpenFrame] = useState(false);
  const avatarSpeechTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mouthAnimationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    const bundle = createGiftRealtimeBundle(giftId, sessionId, {
      onError: (msg) => {
        setError(msg);
      },
      onGiftIntakeCompleted: ({ summary, intakeSummary: intake }) => {
        setIsFinished(true);
        setIsCompleting(false);
        setIsConnected(false);
        onCompleted?.({ summary, intakeSummary: intake });

        // Delay closing the session to allow the tool output (function call result)
        // to be sent to the server before the connection is severed.
        // This prevents "WebRTC data channel is not connected" errors.
        setTimeout(() => {
          connectedSessionRef.current = null;
          try {
            sessionRef.current?.close();
          } catch {
            // ignore close errors
          }
        }, 1000);
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
      if (type === 'response.output_audio.delta') {
        openAvatarMouth();
        return;
      }
      if (type === 'response.output_audio.done') {
        scheduleAvatarMouthClose();
        return;
      }
      if (type === 'response.output_audio_transcript.delta') {
        const transcriptDelta = (event as { delta?: unknown }).delta;
        if (typeof transcriptDelta === 'string' && transcriptDelta.length > 0) {
          upsertAssistantMessage(itemId, transcriptDelta, 'voice', { append: true });
          openAvatarMouth();
        }
        return;
      }
      if (type === 'response.output_audio_transcript.done') {
        const transcript = (event as { transcript?: unknown }).transcript;
        if (typeof transcript === 'string') {
          upsertAssistantMessage(itemId, transcript, 'voice');
          scheduleAvatarMouthClose(320);
        }
        return;
      }
      if (type === 'response.completed') {
        scheduleAvatarMouthClose();
        return;
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
  }, [giftId, sessionId, upsertAssistantMessage, appendUserMessage, addMessage, onCompleted, openAvatarMouth, scheduleAvatarMouthClose]);

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
  }, [realtimeModel]);

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

  const handleSendChatMessage = async () => {
    const trimmed = chatInput.trim();
    if (!trimmed || !sessionRef.current || !isConnected || isSendingChat) {
      return;
    }
    setIsSendingChat(true);
    setChatInput('');
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
    } finally {
      setIsSendingChat(false);
    }
  };

  const handleChatKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSendChatMessage();
    }
  };

  const handleStopConversation = () => {
    if (sessionRef.current) {
      try {
        sessionRef.current.close();
      } catch { }
    }
    setIsConnected(false);
    setIsFinished(true);
    // Note: We don't call onCompleted here because that's for successful completion
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

  const avatarImageSrc =
    isAvatarSpeaking && isMouthOpenFrame ? '/ai-avatar/open.png' : '/ai-avatar/close.png';

  const statusText = (() => {
    if (isConnecting) return '接続中...';
    if (isCompleting) return '情報整理中...';
    if (isMuted) return 'ミュート中';
    return 'お話しください 🎤';
  })();

  // Layout classes matching VoiceChat
  const isFullscreenActive = true; // Always full screen style for Gift Mode on mobile
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

  const renderChatComposer = () => {
    if (!isConnected) {
      return null;
    }
    const layoutClass = 'flex flex-row items-stretch gap-3';
    const buttonClass = 'h-12 px-6';
    const inputClass = cn(
      'flex-1 rounded-2xl border border-border/60 bg-background/80 px-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30',
      'h-12',
    );

    return (
      <div className={cn('w-full')}>
        <div className={layoutClass}>
          <Input
            ref={chatInputRef}
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
            onKeyDown={handleChatKeyDown}
            placeholder={isMuted ? 'テキストで好みを教えてください' : 'テキストで補足したい内容を入力してください'}
            className={inputClass}
            disabled={isSendingChat || isCompleting}
          />
          <Button
            type="button"
            onClick={() => void handleSendChatMessage()}
            disabled={isSendingChat || !chatInput.trim() || isCompleting}
            className={cn('flex items-center justify-center gap-2 rounded-2xl', buttonClass)}
          >
            {isSendingChat ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            送信
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div
      className={cn(
        'flex flex-col items-center w-full mx-auto space-y-6 px-3 sm:px-0',
        conversationWidthClass,
        isFullscreenActive && 'fixed inset-0 z-50 h-[100dvh] bg-background px-0 !max-w-full overflow-hidden justify-center',
      )}
    >
      {!isConnected && !hasAttemptedConnect ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="mt-4 text-muted-foreground">接続準備中...</p>
        </div>
      ) : (
        <motion.div
          key="avatar-stage"
          className="w-full h-full"
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
                'h-full w-full pb-6 px-4 gap-5 sm:gap-8 justify-center items-center',
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
                {isCompleting && (
                  <Badge
                    variant="secondary"
                    className="absolute -bottom-4 flex items-center gap-2 px-4 py-2 text-xs"
                  >
                    <Activity className="h-4 w-4 animate-pulse" />
                    情報整理中
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
                  <div className={cn(
                    'overflow-y-auto pr-2 space-y-2 text-sm sm:text-base leading-relaxed text-foreground font-medium',
                    summaryHeightClass,
                  )}>
                    <p className="whitespace-pre-wrap">
                      {subtitleText}
                    </p>
                  </div>
                </div>
              </motion.div>

              <div className={cn(isFullscreenActive && 'w-full px-3')}>
                {renderChatComposer()}
              </div>

              <div className="w-full flex flex-col items-center gap-3 sm:gap-4">
                {/* モバイル：丸ボタン（ミュートのみ） */}
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
                </div>

                {/* タブレット以上：ラージボタン（ミュートのみ） */}
                <div className="hidden sm:flex w-full flex-col sm:flex-row gap-3 justify-center">
                  <Button
                    onClick={handleToggleMute}
                    variant={isMuted ? 'secondary' : 'default'}
                    className={cn(
                      'flex-1 max-w-xs h-12 sm:h-14 text-base font-semibold shadow-lg',
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
}
