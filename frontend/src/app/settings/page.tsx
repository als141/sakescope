'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowLeft, Save, Check, Settings as SettingsIcon, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
    <div className="min-h-screen relative overflow-hidden bg-background">
      {/* Background Effects */}
      <div className="fixed inset-0 -z-10">
        <motion.div
          className="absolute inset-0 opacity-20"
          animate={{
            background: [
              'radial-gradient(circle at 20% 80%, oklch(0.68 0.15 70) 0%, transparent 50%)',
              'radial-gradient(circle at 80% 20%, oklch(0.78 0.12 60) 0%, transparent 50%)',
            ],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      </div>

      <div className="relative z-10 px-6 sm:px-10 lg:px-12 py-12 sm:py-16">
        {/* Header */}
        <header className="max-w-3xl mx-auto mb-12">
          <Link href="/">
            <Button variant="ghost" size="lg" className="mb-8 -ml-2 group">
              <ArrowLeft className="mr-2.5 h-5 w-5 group-hover:-translate-x-1 transition-transform" />
              戻る
            </Button>
          </Link>
          
          <div className="flex items-center gap-5 mb-5">
            <div className="rounded-2xl bg-primary/10 p-4 border border-primary/20">
              <SettingsIcon className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold gradient-text tracking-tight">設定</h1>
          </div>
          <p className="text-muted-foreground text-lg sm:text-xl leading-relaxed font-light">
            あなたの好みを設定して、より精度の高いレコメンドを受け取りましょう
          </p>
        </header>

        {/* Settings Card */}
        <motion.div
          className="max-w-3xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Card className="shadow-2xl border-border/30">
            <CardHeader className="space-y-3">
              <CardTitle className="text-3xl">好みの設定</CardTitle>
              <CardDescription className="text-base leading-relaxed">
                AIソムリエが参考にする、あなたの日本酒の好みを設定します
              </CardDescription>
            </CardHeader>

            <Separator />

            <CardContent className="pt-10 space-y-10">
              {/* Flavor Preference */}
              <div className="space-y-4">
                <Label htmlFor="flavor" className="text-lg font-semibold">
                  味の好み
                </Label>
                <Select
                  value={prefs.flavor_preference}
                  onValueChange={(value) =>
                    setPrefs((p) => ({ ...p, flavor_preference: value as Flavor }))
                  }
                >
                  <SelectTrigger 
                    id="flavor" 
                    className="w-full h-14 text-base rounded-xl border-2 hover:border-primary/50 transition-colors"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="dry" className="py-4 text-base">
                      <div className="flex items-center justify-between w-full gap-4">
                        <span className="font-medium">辛口</span>
                        <Badge variant="outline" size="sm">
                          キレのある
                        </Badge>
                      </div>
                    </SelectItem>
                    <SelectItem value="sweet" className="py-4 text-base">
                      <div className="flex items-center justify-between w-full gap-4">
                        <span className="font-medium">甘口</span>
                        <Badge variant="outline" size="sm">
                          まろやか
                        </Badge>
                      </div>
                    </SelectItem>
                    <SelectItem value="balanced" className="py-4 text-base">
                      <div className="flex items-center justify-between w-full gap-4">
                        <span className="font-medium">バランス型</span>
                        <Badge variant="outline" size="sm">
                          どちらも楽しめる
                        </Badge>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  日本酒の味わいの甘辛度を選択してください
                </p>
              </div>

              <Separator className="opacity-50" />

              {/* Body Preference */}
              <div className="space-y-4">
                <Label htmlFor="body" className="text-lg font-semibold">
                  ボディ
                </Label>
                <Select
                  value={prefs.body_preference}
                  onValueChange={(value) =>
                    setPrefs((p) => ({ ...p, body_preference: value as Body }))
                  }
                >
                  <SelectTrigger 
                    id="body" 
                    className="w-full h-14 text-base rounded-xl border-2 hover:border-primary/50 transition-colors"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="light" className="py-4 text-base">
                      <div className="flex items-center justify-between w-full gap-4">
                        <span className="font-medium">軽快</span>
                        <Badge variant="outline" size="sm">
                          すっきり
                        </Badge>
                      </div>
                    </SelectItem>
                    <SelectItem value="medium" className="py-4 text-base">
                      <div className="flex items-center justify-between w-full gap-4">
                        <span className="font-medium">中程度</span>
                        <Badge variant="outline" size="sm">
                          バランス良い
                        </Badge>
                      </div>
                    </SelectItem>
                    <SelectItem value="rich" className="py-4 text-base">
                      <div className="flex items-center justify-between w-full gap-4">
                        <span className="font-medium">濃厚</span>
                        <Badge variant="outline" size="sm">
                          しっかり
                        </Badge>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  日本酒の口当たりや厚みを選択してください
                </p>
              </div>

              <Separator className="opacity-50" />

              {/* Price Range */}
              <div className="space-y-4">
                <Label htmlFor="price" className="text-lg font-semibold">
                  価格帯
                </Label>
                <Select
                  value={prefs.price_range}
                  onValueChange={(value) =>
                    setPrefs((p) => ({ ...p, price_range: value as Price }))
                  }
                >
                  <SelectTrigger 
                    id="price" 
                    className="w-full h-14 text-base rounded-xl border-2 hover:border-primary/50 transition-colors"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="budget" className="py-4 text-base">
                      <div className="flex items-center justify-between w-full gap-4">
                        <span className="font-medium">お手頃</span>
                        <Badge variant="outline" size="sm">
                          〜¥2,000
                        </Badge>
                      </div>
                    </SelectItem>
                    <SelectItem value="mid" className="py-4 text-base">
                      <div className="flex items-center justify-between w-full gap-4">
                        <span className="font-medium">中価格帯</span>
                        <Badge variant="outline" size="sm">
                          ¥2,000〜¥5,000
                        </Badge>
                      </div>
                    </SelectItem>
                    <SelectItem value="premium" className="py-4 text-base">
                      <div className="flex items-center justify-between w-full gap-4">
                        <span className="font-medium">高級</span>
                        <Badge variant="outline" size="sm">
                          ¥5,000〜
                        </Badge>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  普段購入する価格帯を選択してください
                </p>
              </div>

              <Separator className="opacity-50" />

              {/* Food Pairing */}
              <div className="space-y-4">
                <Label htmlFor="food" className="text-lg font-semibold">
                  一緒に楽しむ料理
                </Label>
                <Input
                  id="food"
                  placeholder="刺身, 天ぷら, 焼き鳥 など"
                  value={foodPairingText}
                  onChange={(e) => setFoodPairingText(e.target.value)}
                  className="w-full h-14 text-base rounded-xl border-2 hover:border-primary/50 transition-colors"
                />
                <p className="text-sm text-muted-foreground leading-relaxed">
                  カンマ区切りで入力してください（例: 刺身, 天ぷら, 焼き鳥）
                </p>
                {foodPairingText && (
                  <div className="flex flex-wrap gap-2 pt-3">
                    {foodPairingText.split(',').map((food, i) => {
                      const trimmed = food.trim();
                      return trimmed ? (
                        <Badge key={i} variant="secondary" size="lg">
                          {trimmed}
                        </Badge>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
            </CardContent>

            <Separator />

            {/* Save Button */}
            <CardContent className="pt-8 pb-8">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                <p className="text-base text-muted-foreground leading-relaxed">
                  設定は自動的にローカルに保存されます
                </p>
                <div className="flex items-center gap-4 w-full sm:w-auto">
                  <motion.div
                    initial={false}
                    animate={saved ? { scale: [0, 1.2, 1], opacity: [0, 1, 1] } : {}}
                    transition={{ duration: 0.4 }}
                  >
                    {saved && (
                      <div className="flex items-center gap-2.5 text-base text-emerald-500 font-medium">
                        <Check className="h-5 w-5" />
                        <span>保存しました</span>
                      </div>
                    )}
                  </motion.div>
                  <Button
                    onClick={save}
                    size="lg"
                    className="w-full sm:w-auto"
                  >
                    <Save className="h-5 w-5" />
                    保存
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Info Alert */}
          <Alert className="mt-8 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10 backdrop-blur-sm shadow-lg">
            <Sparkles className="h-6 w-6 text-primary" />
            <AlertDescription className="ml-0 mt-3">
              <p className="text-base leading-relaxed">
                <strong className="text-foreground font-semibold">ヒント:</strong> これらの設定はAIソムリエへの初期情報として使用されます。
                会話の中でさらに詳しい好みを伝えることで、より精度の高いレコメンドが得られます。
              </p>
            </AlertDescription>
          </Alert>
        </motion.div>
      </div>
    </div>
  );
}
