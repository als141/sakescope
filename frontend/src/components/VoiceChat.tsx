'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, MessageSquare, Loader, PhoneOff } from 'lucide-react';
import { RealtimeAgent, RealtimeSession, tool } from '@openai/agents/realtime';
import type { RealtimeSessionEventTypes, TransportEvent } from '@openai/agents/realtime';
import { z } from 'zod';
import { SakeData } from '@/data/sakeData';
import { getSakeRecommendations } from '@/data/sakeData';

interface VoiceChatProps {
  isRecording: boolean;
  setIsRecording: (recording: boolean) => void;
  onSakeRecommended: (sake: SakeData) => void;
  preferences?: {
    flavor_preference?: 'dry' | 'sweet' | 'balanced';
    body_preference?: 'light' | 'medium' | 'rich';
    price_range?: 'budget' | 'mid' | 'premium';
    food_pairing?: string[];
  };
}

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

export default function VoiceChat({ isRecording, setIsRecording, onSakeRecommended, preferences }: VoiceChatProps) {
  const [session, setSession] = useState<RealtimeSession | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // Only store assistant text outputs (no user transcripts)
  const [aiMessages, setAiMessages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const agentRef = useRef<RealtimeAgent | null>(null);

  // Initialize agent and create session
  useEffect(() => {
    const initializeAgent = async () => {
      if (agentRef.current) return;
      type SessionEvents = RealtimeSessionEventTypes;

      // Define a function tool the model can call to fetch sake recommendations
      const findSakeTool = tool({
        name: 'find_sake_recommendations',
        description: 'お客様の好みに基づいて日本酒を推薦します',
        parameters: z.object({
          flavor_preference: z.enum(['dry', 'sweet', 'balanced']),
          body_preference: z.enum(['light', 'medium', 'rich']),
          price_range: z.enum(['budget', 'mid', 'premium']),
          // Optional fields are not supported by the API; use nullable required field instead
          food_pairing: z.array(z.string()).nullable(),
        }),
        async execute(input) {
          const prefs = input as {
            flavor_preference: 'dry'|'sweet'|'balanced';
            body_preference: 'light'|'medium'|'rich';
            price_range: 'budget'|'mid'|'premium';
            food_pairing: string[] | null;
          };
          const recs = getSakeRecommendations({
            flavor_preference: prefs.flavor_preference,
            body_preference: prefs.body_preference,
            price_range: prefs.price_range,
            food_pairing: prefs.food_pairing ?? undefined,
          });
          // Return structured JSON the model can use to explain
          return JSON.stringify({ recommendations: recs });
        }
      });

      const agent = new RealtimeAgent({
        name: '日本酒ソムリエ',
        instructions: `あなたは日本酒の専門知識を持つ親しみやすいAIソムリエです。
        
        ## あなたの役割
        - 日本酒を愛する情熱的なソムリエとして、お客様の好みや要望を聞き取る
        - 対話を通じてお客様の好みを理解し、最適な日本酒を推薦する
        - 日本酒の知識を分かりやすく、楽しく伝える
        
        ## 対話の流れ
        1. まず挨拶をして、お客様がどのような日本酒をお探しかを尋ねる
        2. 以下の項目について質問して好みを把握する：
           - 味の好み（辛口・甘口・バランス型）
           - ボディの好み（軽快・中程度・濃厚）
           - 価格帯（お手頃・中価格帯・高級）
           - 一緒に楽しむ料理
           - 飲む場面・シーン
        3. 情報が十分集まったら、日本酒を推薦する
        
        ## 話し方
        - 親しみやすく、専門知識を持ちながらも堅苦しくない
        - 日本酒の魅力を伝える情熱を持って話す
        - 相手の話をよく聞き、質問を通じて理解を深める
        - 日本酒の専門用語は分かりやすく説明する
        
        ## 重要なルール
        - 十分な情報を聞き取ったら、具体的な日本酒の推薦を必ずツールで行う
        - 推薦時は必ずツール find_sake_recommendations を関数呼び出しで使用する（画面表示はツール結果で行う）
        - ツール引数は: flavor_preference, body_preference, price_range は必須。food_pairing は null 可
        - 引数が不足している場合は、会話やユーザー設定から推定し、無ければ既定値（flavor=balanced, body=medium, price=mid, food_pairing=null）を用いる
        - ツール結果に基づき、1つの日本酒に絞って詳しく紹介し、なぜその日本酒がおすすめなのかを説明する
        - ツールを呼ばずに日本酒名を直接提示・否定（見つからない等）しない
        - 万一結果が空の場合でも、条件を緩和して再度ツールを呼び直し、必ず最も近い候補を提示する`,
        tools: [findSakeTool],
      });

      agentRef.current = agent;
      
      // Request audio output; transcript text is still received via session events
      const newSession = new RealtimeSession(agent, {
        config: {
          outputModalities: ['audio']
        }
      });
      setSession(newSession);

      // Do not store or render user speech transcripts — UI shows only AI output
      newSession.on('transport_event', (event: TransportEvent) => {
        void event; // Intentionally ignore finalized user input transcription events
      });

      // Append assistant's final text per turn (from output_text or audio transcript)
      newSession.on('agent_end', (...[, , finalText]: SessionEvents['agent_end']) => {
        if (typeof finalText === 'string' && finalText.trim()) {
          setAiMessages(prev => [...prev, finalText.trim()]);
        }
      });

      // When the tool finishes, update the UI with the top recommendation
      newSession.on('agent_tool_end', (...args: SessionEvents['agent_tool_end']) => {
        const [, , , result] = args;
        try {
          const parsed = JSON.parse(result);
          const recs = parsed?.recommendations as SakeData[] | undefined;
          if (recs && recs.length > 0) {
            onSakeRecommended(recs[0]);
          }
        } catch {}
      });

      newSession.on('error', (event: SessionEvents['error'][0]) => {
        // Extract readable message if present
        const rawMsg = extractErrorMessage(event);

        // Known benign noise seen in browsers with Realtime: ignore gracefully
        const isBenign = rawMsg && /Unable to add filesystem/i.test(rawMsg);

        if (isBenign) {
          console.warn('[Realtime] Ignored benign error:', rawMsg);
          return; // Do not surface to UI or drop connection
        }

        console.error('Session error:', rawMsg ?? event);
        setError(rawMsg || 'Connection error occurred');
        // Do not force disconnect on transient errors; keep session unless transport actually closes
        setIsLoading(false);
      });
    };

    initializeAgent();
  }, [onSakeRecommended]);

  const connectToSession = async () => {
    if (!session) return;
    
    setIsLoading(true);
    setError(null);

    try {
      // Get client secret from our API
      const response = await fetch('/api/client-secret', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json().catch(() => null) as
        | { value?: string; error?: unknown; details?: unknown }
        | null;
      if (!response.ok || !data?.value) {
        const details = (data && (data.error || data.details)) || 'Failed to get client secret';
        throw new Error(typeof details === 'string' ? details : JSON.stringify(details));
      }
      
      await session.connect({
        apiKey: data.value
      });
      // Ensure we are unmuted when starting
      session.mute(false);

      // Provide saved preferences to the model as context so it can call the tool easily
      if (preferences) {
        const prefText = `ユーザー設定: 味=${preferences.flavor_preference ?? '未設定'}, ボディ=${preferences.body_preference ?? '未設定'}, 価格帯=${preferences.price_range ?? '未設定'}, 料理=${preferences.food_pairing?.join(' / ') ?? '未設定'}`;
        session.sendMessage({
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: prefText }],
        });
      }

      setIsConnected(true);
      setIsLoading(false);
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to connect:', error);
      const message =
        error instanceof Error ? error.message : 'Failed to connect to AI assistant';
      setError(message || 'Failed to connect to AI assistant');
      setIsLoading(false);
    }
  };

  const disconnectFromSession = () => {
    if (session) {
      session.close();
      setIsConnected(false);
      setIsRecording(false);
      setIsLoading(false);
      setError(null);
    }
  };

  const handleStartConversation = () => {
    if (isLoading || isConnected) return;
    connectToSession();
  };

  const handleStopConversation = () => {
    if (!isConnected) return;
    disconnectFromSession();
  };

  const handleToggleMute = () => {
    if (!isConnected || !session) return;
    const nextRecordingState = !isRecording;
    try {
      session.mute(!nextRecordingState);
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

  // Clean up on unmount
  useEffect(() => {
    return () => {
      try {
        session?.close();
      } catch {}
    };
  }, [session]);

  return (
    <div className="flex flex-col items-center space-y-6">
      {/* Controls */}
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
                        ease: 'easeOut'
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
                        delay: 0.5
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

      {/* Status Text */}
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
                : 'お話しください 🎤'
          }
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

      {/* Conversation History */}
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
              key={index}
              className="flex items-start gap-3 mr-8"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(index * 0.05, 0.3) }}
            >
              <div className="shrink-0 mt-1 rounded-full bg-orange-500/20 p-2">
                <MessageSquare className="w-4 h-4 text-orange-300" />
              </div>
              <div className="flex-1 rounded-2xl bg-gradient-to-br from-orange-500/15 to-amber-400/10 border border-orange-400/20 p-4 shadow-sm">
                <div className="mb-1 text-xs uppercase tracking-wider text-orange-300/80">AIソムリエ</div>
                <p className="text-sm leading-relaxed text-gray-100 whitespace-pre-wrap">{message}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Connection Status Indicator */}
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
}
