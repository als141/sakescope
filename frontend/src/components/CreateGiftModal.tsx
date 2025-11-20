'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, Copy, Check, Loader2, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { CreateGiftRequest, CreateGiftResponse } from '@/types/gift';

const budgetPresets = [
  { label: '1,000円〜3,000円', min: 1000, max: 3000 },
  { label: '3,000円〜5,000円', min: 3000, max: 5000 },
  { label: '5,000円〜10,000円', min: 5000, max: 10000 },
];

const isCreateGiftResponse = (payload: unknown): payload is CreateGiftResponse => {
  if (!payload || typeof payload !== 'object') return false;
  const record = payload as Record<string, unknown>;
  const hasLineShareUrl =
    record.lineShareUrl == null || typeof record.lineShareUrl === 'string';
  return typeof record.giftId === 'string' && typeof record.shareUrl === 'string' && hasLineShareUrl;
};

interface CreateGiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (payload: CreateGiftResponse) => void;
}

export default function CreateGiftModal({ isOpen, onClose, onCreated }: CreateGiftModalProps) {
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string>('');
  const [lineShareUrl, setLineShareUrl] = useState<string | null>(null);
  const [copiedTarget, setCopiedTarget] = useState<'web' | 'line' | null>(null);
  const [formData, setFormData] = useState<CreateGiftRequest>({
    occasion: '',
    recipientFirstName: '',
    budgetMin: 1000,
    budgetMax: 3000,
    message: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const budgetMinClean = Math.max(1, Number.isFinite(formData.budgetMin) ? formData.budgetMin : 0);
      const budgetMaxClean = Math.max(
        budgetMinClean,
        Number.isFinite(formData.budgetMax) ? formData.budgetMax : budgetMinClean,
      );

      const response = await fetch('/api/gift/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          budgetMin: budgetMinClean,
          budgetMax: budgetMaxClean,
        }),
      });

      const data: unknown = await response.json();

      if (response.status === 401) {
        throw new Error('ギフト機能をご利用いただくにはサインインが必要です。サインイン後にもう一度お試しください。');
      }

      if (!response.ok) {
        const errorMessage =
          typeof data === 'object' && data && 'error' in data
            ? typeof (data as Record<string, unknown>).error === 'string'
              ? ((data as Record<string, unknown>).error as string)
              : 'ギフトの作成に失敗しました'
            : 'ギフトの作成に失敗しました';
        throw new Error(errorMessage);
      }

      if (!isCreateGiftResponse(data)) {
        throw new Error('ギフトの作成に失敗しました');
      }

      setShareUrl(data.shareUrl);
      setLineShareUrl(data.lineShareUrl ?? null);
      setCopiedTarget(null);
      setStep('success');
      onCreated?.(data);
    } catch (err) {
      console.error('Error creating gift:', err);
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async (target: 'web' | 'line') => {
    const value = target === 'web' ? shareUrl : lineShareUrl;
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedTarget(target);
      setTimeout(() => setCopiedTarget(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleLineShare = () => {
    const lineShareIntentUrl = lineShareUrl
      ? `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(lineShareUrl)}`
      : null;
    if (!lineShareIntentUrl) return;
    try {
      window.open(lineShareIntentUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('Failed to open LINE share', err);
    }
  };

  const handleClose = () => {
    setStep('form');
    setFormData({
      occasion: '',
      recipientFirstName: '',
      budgetMin: 1000,
      budgetMax: 3000,
      message: '',
    });
    setError(null);
    setShareUrl('');
    setLineShareUrl(null);
    setCopiedTarget(null);
    setIsLoading(false);
    onClose();
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      handleClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-2">
              <Gift className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>日本酒ギフトを贈る</DialogTitle>
              <DialogDescription>
                {step === 'form'
                  ? '相手の好みを聞き取り、最適な日本酒を推薦します'
                  : 'ギフトリンクが生成されました'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {step === 'form' ? (
            <motion.form
              key="form"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              onSubmit={handleSubmit}
              className="space-y-4 mt-4"
            >
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="occasion">用途（任意）</Label>
                <Input
                  id="occasion"
                  placeholder="例：父の日、誕生日、記念日"
                  value={formData.occasion}
                  onChange={(e) =>
                    setFormData({ ...formData, occasion: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="recipientFirstName">
                  贈る相手の呼び名（任意）
                </Label>
                <Input
                  id="recipientFirstName"
                  placeholder="例：お父さん、太郎さん"
                  value={formData.recipientFirstName}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      recipientFirstName: e.target.value,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  フルネームや個人情報は入力しないでください
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label>よく使う予算帯</Label>
                  <div className="flex flex-wrap gap-2">
                    {budgetPresets.map((preset) => {
                      const isActive =
                        formData.budgetMin === preset.min && formData.budgetMax === preset.max;
                      return (
                        <Button
                          key={preset.label}
                          type="button"
                          variant={isActive ? 'secondary' : 'outline'}
                          size="sm"
                          className="rounded-full"
                          onClick={() =>
                            setFormData({
                              ...formData,
                              budgetMin: preset.min,
                              budgetMax: preset.max,
                            })
                          }
                        >
                          {preset.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="budgetMin">予算下限（円）</Label>
                  <Input
                    id="budgetMin"
                    type="number"
                    min="0"
                    step="1"
                    value={formData.budgetMin}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        budgetMin: Number.isFinite(Number(e.target.value))
                          ? Number(e.target.value)
                          : 0,
                      })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="budgetMax">予算上限（円）</Label>
                  <Input
                    id="budgetMax"
                    type="number"
                    min="0"
                    step="1"
                    value={formData.budgetMax}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        budgetMax: Number.isFinite(Number(e.target.value))
                          ? Number(e.target.value)
                          : 0,
                      })
                    }
                    required
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                ※予算は相手に表示されません。0円も入力できますが送信時は1円以上に丸めます。
              </p>

              <div className="space-y-2">
                <Label htmlFor="message">メッセージ（任意）</Label>
                <textarea
                  id="message"
                  placeholder="例：いつもありがとう"
                  value={formData.message}
                  onChange={(e) =>
                    setFormData({ ...formData, message: e.target.value })
                  }
                  className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 min-h-[90px]"
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  className="flex-1"
                  disabled={isLoading}
                >
                  キャンセル
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      作成中...
                    </>
                  ) : (
                    <>
                      <Gift className="mr-2 h-4 w-4" />
                      ギフトリンクを作成
                    </>
                  )}
                </Button>
              </div>
            </motion.form>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-4 mt-4"
            >
              <Alert>
                <Check className="h-4 w-4" />
                <AlertDescription>
                  ギフトリンクが生成されました！LINE用をそのまま送るのが推奨です。
                </AlertDescription>
              </Alert>

              <Tabs defaultValue={lineShareUrl ? 'line' : 'web'} className="w-full">
                <TabsList>
                  {lineShareUrl ? <TabsTrigger value="line">LINE用</TabsTrigger> : null}
                  <TabsTrigger value="web">PC/ブラウザ用</TabsTrigger>
                </TabsList>

                {lineShareUrl ? (
                  <TabsContent value="line" className="space-y-2">
                    <Label>LINE用URL</Label>
                    <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                      <Input value={lineShareUrl} readOnly className="font-mono text-sm flex-1" />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => handleCopy('line')}
                        >
                          {copiedTarget === 'line' ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="default"
                          size="sm"
                          className="gap-2"
                          onClick={handleLineShare}
                        >
                          <Share2 className="h-4 w-4" />
                          LINEで共有
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      受け手はLINEミニアプリで開きます。72時間以内・1回のみ有効です。
                    </p>
                  </TabsContent>
                ) : null}

                <TabsContent value="web" className="space-y-2">
                  <Label>ブラウザ用URL（PC向け）</Label>
                  <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                    <Input value={shareUrl} readOnly className="font-mono text-sm flex-1" />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => handleCopy('web')}
                    >
                      {copiedTarget === 'web' ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    PCブラウザで確認する場合はこちらを使用します（同じく72時間有効）。
                  </p>
                </TabsContent>
              </Tabs>

              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <h4 className="font-semibold text-sm">使い方</h4>
                <ol className="text-sm space-y-1 list-decimal list-inside text-muted-foreground">
                  <li>LINE用タブのURLをコピー、または「LINEで共有」で送信します</li>
                  <li>相手がリンクを開き、好みについて会話します</li>
                  <li>会話が終わると、あなたに推薦結果が届きます</li>
                  <li>結果はマイページから確認できます</li>
                </ol>
              </div>

              <Button onClick={handleClose} className="w-full">
                閉じる
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
