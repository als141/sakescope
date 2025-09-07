'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';

type Flavor = 'dry' | 'sweet' | 'balanced';
type Body = 'light' | 'medium' | 'rich';
type Price = 'budget' | 'mid' | 'premium';

type Prefs = {
  flavor_preference: Flavor;
  body_preference: Body;
  price_range: Price;
  food_pairing: string[] | null;
};

const DEFAULT_PREFS: Prefs = {
  flavor_preference: 'balanced',
  body_preference: 'medium',
  price_range: 'mid',
  food_pairing: null,
};

export default function SettingsPage() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [foodPairingText, setFoodPairingText] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem('sakePreferences');
      if (v) {
        const parsed = JSON.parse(v);
        setPrefs({
          flavor_preference: parsed.flavor_preference ?? DEFAULT_PREFS.flavor_preference,
          body_preference: parsed.body_preference ?? DEFAULT_PREFS.body_preference,
          price_range: parsed.price_range ?? DEFAULT_PREFS.price_range,
          food_pairing: Array.isArray(parsed.food_pairing) ? parsed.food_pairing : null,
        });
        setFoodPairingText(
          Array.isArray(parsed.food_pairing) ? parsed.food_pairing.join(', ') : ''
        );
      }
    } catch {}
  }, []);

  const save = () => {
    const list = foodPairingText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const next: Prefs = {
      ...prefs,
      food_pairing: list.length > 0 ? list : null,
    };
    localStorage.setItem('sakePreferences', JSON.stringify(next));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="min-h-screen relative overflow-hidden px-4 sm:px-6 lg:px-8">
      <header className="flex items-center justify-between py-6">
        <Link href="/" className="text-gray-300 hover:text-white transition-colors">
          ← 戻る
        </Link>
        <h1 className="text-xl font-semibold text-white">設定</h1>
        <div />
      </header>

      <motion.div
        className="max-w-2xl mx-auto glass p-6 rounded-xl space-y-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="space-y-2">
          <label className="block text-sm text-gray-300">味の好み</label>
          <select
            className="w-full bg-gray-800 text-white p-3 rounded-lg"
            value={prefs.flavor_preference}
            onChange={(e) =>
              setPrefs((p) => ({ ...p, flavor_preference: e.target.value as Flavor }))
            }
          >
            <option value="dry">辛口</option>
            <option value="sweet">甘口</option>
            <option value="balanced">バランス型</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-sm text-gray-300">ボディ</label>
          <select
            className="w-full bg-gray-800 text-white p-3 rounded-lg"
            value={prefs.body_preference}
            onChange={(e) =>
              setPrefs((p) => ({ ...p, body_preference: e.target.value as Body }))
            }
          >
            <option value="light">軽快</option>
            <option value="medium">中程度</option>
            <option value="rich">濃厚</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-sm text-gray-300">価格帯</label>
          <select
            className="w-full bg-gray-800 text-white p-3 rounded-lg"
            value={prefs.price_range}
            onChange={(e) =>
              setPrefs((p) => ({ ...p, price_range: e.target.value as Price }))
            }
          >
            <option value="budget">お手頃</option>
            <option value="mid">中価格帯</option>
            <option value="premium">高級</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-sm text-gray-300">一緒に楽しむ料理（カンマ区切り）</label>
          <input
            className="w-full bg-gray-800 text-white p-3 rounded-lg"
            placeholder="刺身, 天ぷら など"
            value={foodPairingText}
            onChange={(e) => setFoodPairingText(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={save}
            className="px-5 py-3 rounded-lg bg-orange-500 hover:bg-orange-600 text-white"
          >
            保存
          </button>
          {saved && (
            <span className="text-green-400 self-center text-sm">保存しました</span>
          )}
        </div>
      </motion.div>
    </div>
  );
}

