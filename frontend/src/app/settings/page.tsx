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

      <div className="relative z-10 px-6 sm:px-10 lg:px-12 py-10 sm:py-12">
        {/* Header */}
        <header className="max-w-3xl mx-auto mb-10">
          <Link href="/">
            <Button variant="ghost" className="mb-6 -ml-2 hover:scale-105 transition-all">
              <ArrowLeft className="mr-2 h-4 w-4" />
              戻る
            </Button>
          </Link>
          
          <div className="flex items-center gap-4 mb-3">
            <div className="rounded-full bg-primary/10 p-3">
              <SettingsIcon className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold gradient-text">設定</h1>
          </div>
          <p className="text-muted-foreground text-base sm:text-lg">
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
          <Card className="shadow-2xl border-border/50">
            <CardHeader>
              <CardTitle>好みの設定</CardTitle>
              <CardDescription>
                AIソムリエが参考にする、あなたの日本酒の好みを設定します
              </CardDescription>
            </CardHeader>

            <Separator />

            <CardContent className="pt-6 space-y-6">
              {/* Flavor Preference */}
              <div className="space-y-3">
                <Label htmlFor="flavor" className="text-base font-medium">
                  味の好み
                </Label>
                <Select
                  value={prefs.flavor_preference}
                  onValueChange={(value) =>
                    setPrefs((p) => ({ ...p, flavor_preference: value as Flavor }))
                  }
                >
                  <SelectTrigger id="flavor" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dry">
                      <div className="flex items-center gap-2">
                        <span>辛口</span>
                        <Badge variant="outline" className="text-xs">キレのある</Badge>
                      </div>
                    </SelectItem>
                    <SelectItem value="sweet">
                      <div className="flex items-center gap-2">
                        <span>甘口</span>
                        <Badge variant="outline" className="text-xs">まろやか</Badge>
                      </div>
                    </SelectItem>
                    <SelectItem value="balanced">
                      <div className="flex items-center gap-2">
                        <span>バランス型</span>
                        <Badge variant="outline" className="text-xs">どちらも楽しめる</Badge>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  日本酒の味わいの甘辛度を選択してください
                </p>
              </div>

              <Separator />

              {/* Body Preference */}
              <div className="space-y-3">
                <Label htmlFor="body" className="text-base font-medium">
                  ボディ
                </Label>
                <Select
                  value={prefs.body_preference}
                  onValueChange={(value) =>
                    setPrefs((p) => ({ ...p, body_preference: value as Body }))
                  }
                >
                  <SelectTrigger id="body" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">
                      <div className="flex items-center gap-2">
                        <span>軽快</span>
                        <Badge variant="outline" className="text-xs">すっきり</Badge>
                      </div>
                    </SelectItem>
                    <SelectItem value="medium">
                      <div className="flex items-center gap-2">
                        <span>中程度</span>
                        <Badge variant="outline" className="text-xs">バランス良い</Badge>
                      </div>
                    </SelectItem>
                    <SelectItem value="rich">
                      <div className="flex items-center gap-2">
                        <span>濃厚</span>
                        <Badge variant="outline" className="text-xs">しっかり</Badge>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  日本酒の口当たりや厚みを選択してください
                </p>
              </div>

              <Separator />

              {/* Price Range */}
              <div className="space-y-3">
                <Label htmlFor="price" className="text-base font-medium">
                  価格帯
                </Label>
                <Select
                  value={prefs.price_range}
                  onValueChange={(value) =>
                    setPrefs((p) => ({ ...p, price_range: value as Price }))
                  }
                >
                  <SelectTrigger id="price" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="budget">
                      <div className="flex items-center gap-2">
                        <span>お手頃</span>
                        <Badge variant="outline" className="text-xs">〜¥2,000</Badge>
                      </div>
                    </SelectItem>
                    <SelectItem value="mid">
                      <div className="flex items-center gap-2">
                        <span>中価格帯</span>
                        <Badge variant="outline" className="text-xs">¥2,000〜¥5,000</Badge>
                      </div>
                    </SelectItem>
                    <SelectItem value="premium">
                      <div className="flex items-center gap-2">
                        <span>高級</span>
                        <Badge variant="outline" className="text-xs">¥5,000〜</Badge>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  普段購入する価格帯を選択してください
                </p>
              </div>

              <Separator />

              {/* Food Pairing */}
              <div className="space-y-3">
                <Label htmlFor="food" className="text-base font-medium">
                  一緒に楽しむ料理
                </Label>
                <Input
                  id="food"
                  placeholder="刺身, 天ぷら, 焼き鳥 など"
                  value={foodPairingText}
                  onChange={(e) => setFoodPairingText(e.target.value)}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  カンマ区切りで入力してください（例: 刺身, 天ぷら, 焼き鳥）
                </p>
                {foodPairingText && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {foodPairingText.split(',').map((food, i) => {
                      const trimmed = food.trim();
                      return trimmed ? (
                        <Badge key={i} variant="secondary">
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
            <CardContent className="pt-6 pb-6">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  設定は自動的にローカルに保存されます
                </p>
                <div className="flex items-center gap-3">
                  <motion.div
                    initial={false}
                    animate={saved ? { scale: [0, 1.2, 1], opacity: [0, 1, 1] } : {}}
                    transition={{ duration: 0.4 }}
                  >
                    {saved && (
                      <div className="flex items-center gap-2 text-sm text-emerald-500">
                        <Check className="h-4 w-4" />
                        <span>保存しました</span>
                      </div>
                    )}
                  </motion.div>
                  <Button
                    onClick={save}
                    size="lg"
                    className="bg-gradient-to-r from-primary via-primary/90 to-primary/80 hover:shadow-xl transition-all"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    保存
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Info Alert */}
          <Alert className="mt-6 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10 backdrop-blur-sm">
            <Sparkles className="h-5 w-5 text-primary" />
            <AlertDescription className="ml-0 mt-2">
              <p className="text-sm leading-relaxed">
                <strong className="text-foreground">ヒント:</strong> これらの設定はAIソムリエへの初期情報として使用されます。
                会話の中でさらに詳しい好みを伝えることで、より精度の高いレコメンドが得られます。
              </p>
            </AlertDescription>
          </Alert>
        </motion.div>
      </div>
    </div>
  );
}
