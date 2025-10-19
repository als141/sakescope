'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import GiftChat from '@/components/GiftChat';

export default function GiftPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [giftId, setGiftId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [isAgeConfirming, setIsAgeConfirming] = useState(false);
  const [ageConfirmError, setAgeConfirmError] = useState<string | null>(null);
  const lastValidatedTokenRef = useRef<string | null>(null);

  useEffect(() => {
    async function validateToken() {
      try {
        const response = await fetch('/api/gift/validate-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (data.valid) {
          setIsValid(true);
          setGiftId(data.giftId);
          setSessionId(data.sessionId);
        } else {
          setError(data.error || 'このリンクは無効です');
        }
      } catch (err) {
        console.error('Error validating token:', err);
        setError('リンクの検証中にエラーが発生しました');
        lastValidatedTokenRef.current = null;
      } finally {
        setIsValidating(false);
      }
    }

    if (!token) {
      return;
    }

    if (lastValidatedTokenRef.current === token) {
      return;
    }

    lastValidatedTokenRef.current = token;
    void validateToken();
  }, [token]);

  const handleAgeConfirm = async () => {
    if (!sessionId) {
      setAgeConfirmed(true);
      return;
    }
    setIsAgeConfirming(true);
    setAgeConfirmError(null);
    try {
      const response = await fetch('/api/gift/session/age-confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const message =
          typeof data?.error === 'string'
            ? data.error
            : '年齢確認の登録に失敗しました。時間をおいて再度お試しください。';
        throw new Error(message);
      }
      setAgeConfirmed(true);
    } catch (err) {
      console.error('Failed to confirm age', err);
      setAgeConfirmError(
        err instanceof Error
          ? err.message
          : '年齢確認の登録に失敗しました。時間をおいて再度お試しください。',
      );
    } finally {
      setIsAgeConfirming(false);
    }
  };

  // Validating state
  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">リンクを確認しています...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Invalid token
  if (!isValid || error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              リンクが無効です
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <p className="text-sm text-muted-foreground">
              このリンクは期限切れか、既に使用されています。送り主の方にご確認ください。
            </p>
            <Button onClick={() => router.push('/')} className="w-full">
              ホームに戻る
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Age confirmation required
  if (!ageConfirmed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md"
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-center">年齢確認</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4 text-center">
                <p className="text-lg font-medium">
                  あなたは20歳以上ですか?
                </p>
                <p className="text-sm text-muted-foreground">
                  日本酒は20歳以上の方のみお楽しみいただけます。
                  <br />
                  20歳未満の方の飲酒は法律で禁止されています。
                </p>
              </div>

              <Alert>
                <AlertDescription className="text-xs">
                  このサービスは日本酒のギフト選びをサポートするものです。
                  会話内容は最小限の匿名データとして記録され、送り主への推薦にのみ使用されます。
                </AlertDescription>
              </Alert>

              {ageConfirmError && (
                <Alert variant="destructive">
                  <AlertDescription className="text-sm">
                    {ageConfirmError}
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex flex-col gap-3">
                <Button
                  onClick={handleAgeConfirm}
                  size="lg"
                  className="w-full"
                  disabled={isAgeConfirming}
                >
                  {isAgeConfirming ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      確認中...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-5 w-5" />
                      はい、20歳以上です
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => router.push('/')}
                  variant="outline"
                  size="lg"
                  className="w-full"
                >
                  いいえ
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Show chat interface
  return (
    <div className="min-h-screen bg-background">
      <AnimatePresence>
        {giftId && sessionId && (
          <GiftChat
            giftId={giftId}
            sessionId={sessionId}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
