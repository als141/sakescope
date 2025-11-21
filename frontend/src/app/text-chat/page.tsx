'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Send, Loader2, Search, Brain, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type ChatRole = 'user' | 'assistant';

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  citations?: string[];
};

type TraceStepState = 'pending' | 'active' | 'done';

type TraceStep = { id: string; label: string; state: TraceStepState; note?: string };

const SYSTEM_PRIMER = `
あなたは日本酒のソムリエAIです。回答は必ず日本語で行い、簡潔な結論と根拠をセットにしてください。
- 必ず web_search ツールを使って最新の情報を調べ、指定された allowed_domains の範囲のみで根拠を集めること。
- モデル名や検索ドメインなどの内部情報はユーザーに明かさないこと。
- 取得した根拠を要約し、必要に応じて出典URLを番号付きで示すこと。
- ユーザーの嗜好を丁寧に掘り下げ、季節感や飲み方の提案も添えること。
`;

const presetPrompts = [
  '新潟でキレのある辛口を2本だけ知りたい',
  '香り華やかで冷酒に向く日本酒をおすすめして',
  '燗にしておいしい純米酒を食事と合わせたい',
  'お祝い席に映える1本を提案して',
];

const createId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export default function TextChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reasoning, setReasoning] = useState('');
  const [traceSteps, setTraceSteps] = useState<TraceStep[]>([
    { id: 'search', label: '調査', state: 'pending' },
    { id: 'reason', label: '整理', state: 'pending' },
    { id: 'answer', label: '回答', state: 'pending' },
  ]);
  const assistantIdRef = useRef<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const decoderRef = useRef(new TextDecoder());
  const bufferRef = useRef('');

  const scrollToBottom = useCallback(() => {
    viewportRef.current?.scrollTo({ top: viewportRef.current.scrollHeight, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, reasoning, scrollToBottom]);

  const resetTrace = useCallback(() => {
    setTraceSteps([
      { id: 'search', label: '調査', state: 'pending' },
      { id: 'reason', label: '整理', state: 'pending' },
      { id: 'answer', label: '回答', state: 'pending' },
    ]);
    setReasoning('');
  }, []);

  const updateTrace = useCallback((id: string, updater: (prev: TraceStep) => TraceStep) => {
    setTraceSteps((prev) => prev.map((step) => (step.id === id ? updater(step) : step)));
  }, []);

  const buildPayload = (userContent: string) => {
    const history = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
    return [
      { role: 'system', content: SYSTEM_PRIMER },
      ...history,
      { role: 'user', content: userContent },
    ];
  };

  const pushAssistantShell = useCallback(() => {
    const id = createId('assistant');
    assistantIdRef.current = id;
    setMessages((prev) => [...prev, { id, role: 'assistant', content: '' }]);
  }, []);

  const appendAssistantDelta = useCallback((delta: string) => {
    const id = assistantIdRef.current;
    if (!id || !delta) return;
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === id ? { ...msg, content: (msg.content + delta).trimStart() } : msg,
      ),
    );
  }, []);

  const finalizeAssistant = useCallback((content: string, citations?: string[]) => {
    const id = assistantIdRef.current;
    const finalId = id ?? createId('assistant');
    setMessages((prev) => {
      const exists = prev.some((m) => m.id === finalId);
      if (exists) {
        return prev.map((m) =>
          m.id === finalId ? { ...m, content: content.trim(), citations: citations ?? [] } : m,
        );
      }
      return [...prev, { id: finalId, role: 'assistant', content: content.trim(), citations }];
    });
    assistantIdRef.current = null;
  }, []);

  const handleEvent = useCallback(
    (eventName: string, data: any) => {
      switch (eventName) {
        case 'delta':
          if (typeof data?.delta === 'string') {
            appendAssistantDelta(data.delta);
            updateTrace('answer', (s) => ({ ...s, state: 'active' }));
          }
          if (data?.final && typeof data?.text === 'string') {
            finalizeAssistant(data.text, data.citations);
            updateTrace('answer', (s) => ({ ...s, state: 'done' }));
            setIsStreaming(false);
          }
          break;
        case 'reasoning':
          if (typeof data?.delta === 'string') {
            setReasoning((prev) => prev + data.delta);
            updateTrace('reason', (s) => ({ ...s, state: 'active' }));
          }
          break;
        case 'search':
          if (data?.status === 'searching') {
            updateTrace('search', (s) => ({ ...s, state: 'active', note: data.query || '' }));
          } else if (data?.status === 'completed') {
            updateTrace('search', (s) => ({ ...s, state: 'done', note: data.query || s.note }));
          }
          break;
        case 'done':
          if (typeof data?.text === 'string') {
            finalizeAssistant(data.text, data.citations);
          }
          setIsStreaming(false);
          updateTrace('answer', (s) => ({ ...s, state: 'done' }));
          break;
        case 'error':
          setError(typeof data?.message === 'string' ? data.message : '予期しないエラーが発生しました');
          setIsStreaming(false);
          break;
        default:
          break;
      }
    },
    [appendAssistantDelta, finalizeAssistant, updateTrace],
  );

  const parseSseChunk = useCallback(
    (chunk: string) => {
      const events = chunk.split('\n\n');
      for (const rawEvent of events) {
        if (!rawEvent.trim()) continue;
        const lines = rawEvent.split('\n');
        let eventName = 'message';
        const dataLines: string[] = [];
        for (const line of lines) {
          if (line.startsWith('event:')) {
            eventName = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            dataLines.push(line.slice(5).trim());
          }
        }
        if (dataLines.length === 0) continue;
        const dataStr = dataLines.join('\n');
        try {
          const parsed = JSON.parse(dataStr);
          handleEvent(eventName, parsed);
        } catch {
          // ignore malformed event
        }
      }
    },
    [handleEvent],
  );

  const readStream = useCallback(
    async (reader: ReadableStreamDefaultReader<Uint8Array>) => {
      const decoder = decoderRef.current;
      let buffer = bufferRef.current;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';
        for (const part of parts) {
          parseSseChunk(part);
        }
      }
      if (buffer.trim()) {
        parseSseChunk(buffer);
      }
      bufferRef.current = '';
    },
    [parseSseChunk],
  );

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    setError(null);
    setIsStreaming(true);
    resetTrace();
    controllerRef.current?.abort();
    controllerRef.current = new AbortController();
    const userId = createId('user');
    setMessages((prev) => [...prev, { id: userId, role: 'user', content: trimmed }]);
    setInput('');
    pushAssistantShell();

    try {
      const res = await fetch('/api/grok-sake-chat?stream=1', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({ messages: buildPayload(trimmed) }),
        signal: controllerRef.current?.signal,
      });

      if (!res.body) {
        throw new Error('応答ストリームを開始できませんでした');
      }

      const reader = res.body.getReader();
      await readStream(reader);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : '送信中に問題が発生しました。時間をおいて再試行してください。';
      setError(msg);
      setIsStreaming(false);
      finalizeAssistant('回答を取得できませんでした。時間をおいて再試行してください。');
    } finally {
      controllerRef.current = null;
    }
  }, [buildPayload, finalizeAssistant, input, isStreaming, pushAssistantShell, readStream, resetTrace]);

  const handlePreset = (prompt: string) => {
    setInput(prompt);
  };

  const isEmpty = messages.length === 0;
  const headerSub = useMemo(
    () => (isEmpty ? '気になる条件を1文で伝えてください。最短で答えます。' : '続けて相談できます。入力後に送信してください。'),
    [isEmpty],
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-background/90">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" asChild className="h-10 w-10">
            <Link href="/">
              <ArrowLeft className="h-5 w-5" />
              <span className="sr-only">戻る</span>
            </Link>
          </Button>
          <div>
            <p className="text-sm text-muted-foreground">テキストで相談</p>
            <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Sake Concierge</h1>
          </div>
        </div>

        <div className="grid gap-4 lg:gap-6 grid-cols-1 lg:grid-cols-[1.75fr_1fr]">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <p className="text-sm text-muted-foreground">{headerSub}</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div
                ref={viewportRef}
                className="min-h-[320px] max-h-[60vh] overflow-y-auto pr-1 space-y-3"
              >
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      'flex flex-col gap-1',
                      message.role === 'user' ? 'items-end' : 'items-start',
                    )}
                  >
                    <div
                      className={cn(
                        'rounded-2xl px-4 py-3 text-sm leading-relaxed max-w-[92%] sm:max-w-[82%]',
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted/60 text-foreground border border-border/60',
                      )}
                    >
                      {message.content}
                      {message.citations && message.citations.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {message.citations.map((url, index) => (
                            <Badge key={url} variant="secondary" className="text-[11px]">
                              出典 {index + 1}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {error && (
                  <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {error}
                  </div>
                )}
                {isStreaming && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                    回答を生成しています...
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {presetPrompts.map((prompt) => (
                  <Button
                    key={prompt}
                    variant="secondary"
                    size="sm"
                    className="rounded-full text-xs"
                    onClick={() => handlePreset(prompt)}
                    type="button"
                  >
                    {prompt}
                  </Button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="例: 夏の魚料理に合う爽やかな1本を探している"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void handleSend();
                    }
                  }}
                  disabled={isStreaming}
                  className="h-12 rounded-full px-4"
                />
                <Button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={isStreaming || input.trim().length === 0}
                  className="h-12 px-5 rounded-full"
                >
                  {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Search className="h-4 w-4" />
                  進行ログ
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {traceSteps.map((step) => (
                  <div
                    key={step.id}
                    className={cn(
                      'flex items-center justify-between rounded-xl border px-3 py-2 text-sm',
                      step.state === 'done' && 'border-border/60 bg-muted/40',
                      step.state === 'active' && 'border-primary/40 bg-primary/5',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {step.id === 'search' ? (
                        <Search className="h-4 w-4 text-muted-foreground" />
                      ) : step.id === 'reason' ? (
                        <Brain className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Sparkles className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="font-medium">{step.label}</span>
                    </div>
                    <Badge variant="outline" className="text-[11px]">
                      {step.state === 'pending'
                        ? '待機中'
                        : step.state === 'active'
                          ? '進行中'
                          : '完了'}
                    </Badge>
                  </div>
                ))}
                {reasoning && (
                  <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-3 text-sm leading-relaxed">
                    <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                      <Brain className="h-4 w-4" />
                      推論メモ
                    </div>
                    <p className="whitespace-pre-wrap">{reasoning.trim()}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
