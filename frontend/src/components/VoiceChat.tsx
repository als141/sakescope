'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, MessageSquare, Loader } from 'lucide-react';
import { RealtimeAgent, RealtimeSession } from '@openai/agents/realtime';
import { SakeData } from '@/data/sakeData';

interface VoiceChatProps {
  isRecording: boolean;
  setIsRecording: (recording: boolean) => void;
  onSakeRecommended: (sake: SakeData) => void;
}

export default function VoiceChat({ isRecording, setIsRecording, onSakeRecommended }: VoiceChatProps) {
  const [session, setSession] = useState<RealtimeSession | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [transcript, setTranscript] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const agentRef = useRef<RealtimeAgent | null>(null);

  // Initialize agent and create session
  useEffect(() => {
    const initializeAgent = async () => {
      if (agentRef.current) return;

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
        - 十分な情報を聞き取った後に、具体的な日本酒の推薦を行う
        - 推薦する際は、なぜその日本酒がおすすめなのかを説明する
        - 1つの日本酒に絞って詳しく紹介する`
      });

      agentRef.current = agent;
      
      const newSession = new RealtimeSession(agent);
      setSession(newSession);

      // Listen to raw transport events for finalized user input transcription
      newSession.on('transport_event', (event: any) => {
        if (event?.type === 'conversation.item.input_audio_transcription.completed' && event.transcript) {
          setTranscript(prev => [...prev, `You: ${event.transcript}`]);
        }
      });

      // Track history additions to capture assistant text outputs
      newSession.on('history_added', (item: any) => {
        if (item?.type === 'message' && item.role === 'assistant') {
          const texts = (item.content || [])
            .filter((c: any) => c?.type === 'output_text' && typeof c.text === 'string')
            .map((c: any) => c.text)
            .join('');
          if (texts) {
            setTranscript(prev => [...prev, `AI: ${texts}`]);

            const textLower = texts.toLowerCase();
            if (textLower.includes('獺祭') || textLower.includes('だっさい')) {
              const mockSake = {
                id: "sake-001",
                name: "獺祭 純米大吟醸磨き三割九分",
                brewery: "旭酒造",
                region: "山口県",
                type: "純米大吟醸",
                alcohol: 16.0,
                sakeValue: 6,
                acidity: 1.1,
                flavor_profile: {
                  sweetness: 3,
                  lightness: 4,
                  complexity: 4,
                  fruitiness: 4
                },
                tasting_notes: ["華やかな吟醸香", "上品な甘み", "クリアな後味", "洋梨のような香り"],
                food_pairing: ["刺身", "寿司", "白身魚の料理", "軽い前菜"],
                serving_temp: ["冷酒", "常温"],
                price_range: "¥3,000-5,000",
                description: "山田錦を39%まで磨いた贅沢な純米大吟醸。フルーティーで華やかな香りと、透明感のある味わいが特徴的な逸品。",
                image_url: "/images/sake-dassai.jpg"
              };
              setTimeout(() => onSakeRecommended(mockSake), 1000);
            }
          }
        }
      });

      newSession.on('error', (event: any) => {
        console.error('Session error:', event);
        setError('Connection error occurred');
        setIsConnected(false);
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

      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.value) {
        const details = (data && (data.error || data.details)) || 'Failed to get client secret';
        throw new Error(typeof details === 'string' ? details : JSON.stringify(details));
      }
      
      await session.connect({
        apiKey: data.value
      });
      // Ensure we are unmuted when starting
      session.mute(false);

      setIsConnected(true);
      setIsLoading(false);
      setIsRecording(true);
    } catch (error: any) {
      console.error('Failed to connect:', error);
      setError(error?.message || 'Failed to connect to AI assistant');
      setIsLoading(false);
    }
  };

  const disconnectFromSession = () => {
    if (session) {
      session.close();
      setIsConnected(false);
      setIsRecording(false);
    }
  };

  const toggleRecording = () => {
    if (!isConnected) {
      connectToSession();
      return;
    }
    if (!session) return;

    if (isRecording) {
      session.mute(true);
      setIsRecording(false);
    } else {
      session.mute(false);
      setIsRecording(true);
    }
  };

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
      {/* Microphone Button */}
      <div className="relative">
        {/* Pulse rings for active recording */}
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
          onClick={toggleRecording}
          className={`
            relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300
            ${isRecording 
              ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/50' 
              : isConnected 
                ? 'bg-orange-500 hover:bg-orange-600 shadow-lg shadow-orange-500/50'
                : 'bg-gray-700 hover:bg-gray-600 shadow-lg'
            }
          `}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader className="w-8 h-8 text-white animate-spin" />
          ) : isRecording ? (
            <MicOff className="w-8 h-8 text-white" />
          ) : (
            <Mic className="w-8 h-8 text-white" />
          )}
        </motion.button>
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
            : isRecording 
              ? 'お話しください 🎤'
              : isConnected
                ? 'AIソムリエと接続済み'
                : 'マイクボタンを押してスタート'
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
      {transcript.length > 0 && (
        <motion.div
          className="w-full max-w-2xl space-y-2 max-h-60 overflow-y-auto"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: 0.5 }}
        >
          {transcript.map((message, index) => (
            <motion.div
              key={index}
              className={`p-3 rounded-lg glass ${
                message.startsWith('You:') 
                  ? 'ml-8 bg-gray-700/30' 
                  : 'mr-8 bg-orange-500/20'
              }`}
              initial={{ opacity: 0, x: message.startsWith('You:') ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <p className="text-sm text-gray-200">{message}</p>
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
