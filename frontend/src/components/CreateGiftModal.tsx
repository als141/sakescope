'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, Copy, Check, Loader2 } from 'lucide-react';
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
import type { CreateGiftRequest, CreateGiftResponse } from '@/types/gift';

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
  const [copied, setCopied] = useState(false);

  const [formData, setFormData] = useState<CreateGiftRequest>({
    occasion: '',
    recipientFirstName: '',
    budgetMin: 3000,
    budgetMax: 10000,
    message: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/gift/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data: CreateGiftResponse = await response.json();

      if (response.status === 401) {
        throw new Error('ギフト機能をご利用いただくにはサインインが必要です。サインイン後にもう一度お試しください。');
      }

      if (!response.ok) {
        throw new Error(data.error || 'ギフトの作成に失敗しました');
      }

      setShareUrl(data.shareUrl);
      setStep('success');
      onCreated?.(data);
    } catch (err) {
      console.error('Error creating gift:', err);
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleClose = () => {
    setStep('form');
    setFormData({
      occasion: '',
      recipientFirstName: '',
      budgetMin: 3000,
      budgetMax: 10000,
      message: '',
    });
    setError(null);
    setShareUrl('');
    setCopied(false);
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
                <div className="space-y-2">
                  <Label htmlFor="budgetMin">予算下限（円）</Label>
                  <Input
                    id="budgetMin"
                    type="number"
                    min="1000"
                    step="1000"
                    value={formData.budgetMin}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        budgetMin: parseInt(e.target.value) || 1000,
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
                    min="1000"
                    step="1000"
                    value={formData.budgetMax}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        budgetMax: parseInt(e.target.value) || 1000,
                      })
                    }
                    required
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                ※予算は相手に表示されません
              </p>

              <div className="space-y-2">
                <Label htmlFor="message">メッセージ（任意）</Label>
                <Input
                  id="message"
                  placeholder="例：いつもありがとう"
                  value={formData.message}
                  onChange={(e) =>
                    setFormData({ ...formData, message: e.target.value })
                  }
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
                  ギフトリンクが生成されました！このリンクを相手に送ってください。
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label>共有用URL</Label>
                <div className="flex gap-2">
                  <Input value={shareUrl} readOnly className="font-mono text-sm" />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleCopy}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  このリンクは72時間有効で、一度のみ使用できます
                </p>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <h4 className="font-semibold text-sm">使い方</h4>
                <ol className="text-sm space-y-1 list-decimal list-inside text-muted-foreground">
                  <li>上記のURLを相手に送信します</li>
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
