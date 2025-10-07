'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Settings, Volume2 } from 'lucide-react';
import Link from 'next/link';
import VoiceChat from '@/components/VoiceChat';
import SakeDisplay from '@/components/SakeDisplay';
import { SakeData } from '@/data/sakeData';

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [recommendedSake, setRecommendedSake] = useState<SakeData | null>(null);
  const [preferences, setPreferences] = useState<{
    flavor_preference?: 'dry' | 'sweet' | 'balanced';
    body_preference?: 'light' | 'medium' | 'rich';
    price_range?: 'budget' | 'mid' | 'premium';
    food_pairing?: string[];
  } | null>(null);

  useEffect(() => {
    try {
      const v = localStorage.getItem('sakePreferences');
      if (v) {
        const p = JSON.parse(v);
        setPreferences({
          flavor_preference: p.flavor_preference,
          body_preference: p.body_preference,
          price_range: p.price_range,
          food_pairing: Array.isArray(p.food_pairing) ? p.food_pairing : undefined,
        });
      }
    } catch {}
  }, []);

  // Deterministic RNG to avoid hydration mismatches
  function mulberry32(a: number) {
    return function () {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const seeded = mulberry32(20250907);
  const orbs = Array.from({ length: 5 }).map(() => {
    const width = seeded() * 200 + 50;
    const height = seeded() * 200 + 50;
    const left = `${(seeded() * 100).toFixed(6)}%`;
    const top = `${(seeded() * 100).toFixed(6)}%`;
    const duration = seeded() * 10 + 10;
    const deltaX = seeded() * 400 - 200;
    const deltaY = seeded() * 400 - 200;
    return { width, height, left, top, duration, deltaX, deltaY };
  });

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 -z-10">
        <motion.div
          className="absolute inset-0 opacity-10"
          animate={{
            background: [
              'radial-gradient(circle at 20% 80%, #d97706 0%, transparent 50%)',
              'radial-gradient(circle at 80% 20%, #fbbf24 0%, transparent 50%)',
              'radial-gradient(circle at 40% 40%, #d97706 0%, transparent 50%)',
            ],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
        
        {/* Floating Orbs */}
        {orbs.map((o, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-gradient-to-r from-orange-400 to-amber-400 opacity-20"
            style={{
              width: o.width,
              height: o.height,
              left: o.left,
              top: o.top,
            }}
            animate={{
              x: [0, o.deltaX],
              y: [0, o.deltaY],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: o.duration,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.header
          className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <motion.h1 
            className="text-2xl sm:text-3xl font-bold gradient-text"
            whileHover={{ scale: 1.05 }}
          >
            Sakescope
          </motion.h1>
          
          <Link href="/settings">
            <motion.span
              className="p-3 rounded-full glass hover:bg-gray-700/50 transition-colors inline-flex"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <Settings className="w-6 h-6 text-amber-400" />
            </motion.span>
          </Link>
        </motion.header>

        {/* Main Interface */}
        <AnimatePresence mode="wait">
          {!recommendedSake ? (
            <motion.div
              key="voice-interface"
              className="text-center space-y-8 max-w-2xl"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.6 }}
            >
              {/* Welcome Message */}
              <motion.div
                className="space-y-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.6 }}
              >
                <h2 className="text-4xl sm:text-6xl font-bold gradient-text float">
                  最高の一杯を
                  <br />
                  一緒に見つけましょう
                </h2>
                <p className="text-lg sm:text-xl text-gray-300 max-w-xl mx-auto">
                  AIソムリエとの音声対話を通じて、あなたの好みにぴったりの日本酒をお探しします
                </p>
              </motion.div>

              {/* Voice Chat Component */}
              <VoiceChat
                isRecording={isRecording}
                setIsRecording={setIsRecording}
                onSakeRecommended={setRecommendedSake}
                preferences={preferences || undefined}
              />

              {/* Instructions */}
              <motion.div
                className="flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-gray-400"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8, duration: 0.6 }}
              >
                <div className="flex items-center gap-2">
                  <Mic className="w-4 h-4" />
                  <span>音声で対話</span>
                </div>
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4" />
                  <span>AIが応答</span>
                </div>
              </motion.div>
            </motion.div>
          ) : (
            <SakeDisplay
              sake={recommendedSake}
              onReset={() => setRecommendedSake(null)}
            />
          )}
        </AnimatePresence>

        {/* Footer */}
        <motion.footer
          className="absolute bottom-0 left-0 right-0 p-6 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.6 }}
        >
          <p className="text-sm text-gray-500">
            Powered by OpenAI Realtime API • 日本酒の新しい体験
          </p>
        </motion.footer>
      </div>
    </div>
  );
}
