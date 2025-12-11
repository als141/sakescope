'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import Script from 'next/script';
import { useSearchParams } from 'next/navigation';
import { ChatKit, useChatKit } from '@openai/chatkit-react';
import { Mic, MessageSquare } from 'lucide-react';
import VoiceChat from '@/components/VoiceChat';
import SakeDisplay from '@/components/SakeDisplay';
import type { Sake, PurchaseOffer } from '@/domain/sake/types';
import { Button } from '@/components/ui/button';

type TokenState = {
  secret: string | null;
  expiresAt: number;
};

const CHATKIT_DOMAIN_KEY =
  process.env.NEXT_PUBLIC_TEXT_CHATKIT_DOMAIN_KEY ?? 'sakescope-text';

const presetPrompts = [
  '新潟でキレのある辛口を2本だけ知りたい',
  '香り華やかで冷酒に向く日本酒をおすすめして',
  '燗にしておいしい純米酒を食事と合わせたい',
  'お祝い席に映える1本を提案して',
];

function ModeSelectScreen({
  onSelect,
}: {
  onSelect: (mode: 'voice' | 'text') => void;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-md text-center space-y-8">
        <div className="space-y-3">
          <h1 className="text-3xl sm:text-4xl font-bold gradient-text tracking-tight">
            Sakescope
          </h1>
          <p className="text-base text-muted-foreground/80 leading-relaxed">
            日本酒選びの相談を、AIソムリエが丁寧にお手伝いします。
          </p>
        </div>

        <div className="grid gap-3">
          <Button
            type="button"
            variant="outline"
            size="xl"
            className="h-auto w-full px-6 py-5 flex flex-col items-start gap-2 text-left bg-background/80"
            onClick={() => onSelect('voice')}
          >
            <div className="flex items-center gap-3">
              <Mic className="h-5 w-5" />
              <span className="text-base font-semibold">音声で相談する</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              話しかけるだけで、好みに合う一本を一緒に探します。
            </p>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="xl"
            className="h-auto w-full px-6 py-5 flex flex-col items-start gap-2 text-left bg-background/80"
            onClick={() => onSelect('text')}
          >
            <div className="flex items-center gap-3">
              <MessageSquare className="h-5 w-5" />
              <span className="text-base font-semibold">チャットで相談する</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              静かな場所でも気軽に。文章でゆっくり相談できます。
            </p>
          </Button>
        </div>

        <p className="text-xs text-muted-foreground/70 leading-relaxed">
          音声相談を選ぶと、マイクの許可が必要になります。いつでもチャットに切り替えられます。
        </p>
      </div>
    </div>
  );
}

export default function EmbedPageClient() {
  const searchParams = useSearchParams();
  const modeParam = searchParams.get('mode');
  const initialMode: 'voice' | 'text' =
    modeParam === 'text' ? 'text' : 'voice';
  const skipSelect = searchParams.get('skipSelect') === '1';
  const [mode, setMode] = useState<'voice' | 'text'>(initialMode);
  const [hasSelectedMode, setHasSelectedMode] = useState(skipSelect);

  const [isRecording, setIsRecording] = useState(false);
  const [recommendedSake, setRecommendedSake] = useState<Sake | null>(null);
  const [purchaseOffer, setPurchaseOffer] = useState<PurchaseOffer | null>(null);
  const [isVoiceConnected, setIsVoiceConnected] = useState(false);

  const tokenRef = useRef<TokenState>({ secret: null, expiresAt: 0 });
  const [tokenError, setTokenError] = useState<string | null>(null);

  const getClientSecret = useCallback(
    async (currentSecret: string | null) => {
      const now = Date.now();
      if (
        currentSecret &&
        tokenRef.current.secret === currentSecret &&
        tokenRef.current.expiresAt - 5_000 > now
      ) {
        return tokenRef.current.secret;
      }

      const endpoint = currentSecret
        ? '/api/text-chatkit/refresh'
        : '/api/text-chatkit/start';

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: currentSecret ? { 'Content-Type': 'application/json' } : undefined,
          body: currentSecret ? JSON.stringify({ currentClientSecret: currentSecret }) : undefined,
        });

        if (!response.ok) {
          const detailText = await response.text().catch(() => '');
          let message = 'Failed to fetch client secret';
          try {
            const parsed = JSON.parse(detailText);
            message = parsed?.error || message;
            if (parsed?.detail) {
              message += ` (${parsed.detail})`;
            }
          } catch {
            if (detailText) {
              message = `${message}: ${detailText}`;
            }
          }
          throw new Error(message);
        }

        const data = await response.json();
        tokenRef.current = {
          secret: data.client_secret,
          expiresAt: now + (data.expires_in ?? 900) * 1000,
        };
        setTokenError(null);
        return tokenRef.current.secret!;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Token refresh failed';
        setTokenError(message);
        throw error;
      }
    },
    [],
  );

  const startScreenPrompts = useMemo(
    () => presetPrompts.map((prompt) => ({ label: prompt, prompt })),
    [],
  );

  const { control } = useChatKit({
    api: {
      getClientSecret,
    },
    theme: {
      colorScheme: 'light',
      radius: 'soft',
      density: 'spacious',
    },
    header: {
      enabled: false,
    },
    history: {
      enabled: false,
    },
    startScreen: {
      greeting:
        '日本酒のこと、気軽に相談してください。',
      prompts: startScreenPrompts,
    },
    composer: {
      placeholder: '例: 夏の魚料理に合う爽やかな1本を探している',
      attachments: {
        enabled: false,
      },
    },
    disclaimer: {
      text: '必ず提案内のリンクを開いて確認してください。実在するストアページのみを案内します。',
      highContrast: true,
    },
  });

  const isTextMode = mode === 'text';
  const shouldCenterVoiceStart =
    mode === 'voice' && !isVoiceConnected && !recommendedSake;

  return (
    <>
      <Script
        src="https://cdn.platform.openai.com/deployments/chatkit/chatkit.js"
        strategy="beforeInteractive"
        data-domain-key={CHATKIT_DOMAIN_KEY}
      />
      {!hasSelectedMode ? (
        <ModeSelectScreen
          onSelect={(selected) => {
            setMode(selected);
            setHasSelectedMode(true);
          }}
        />
      ) : (
        <div className="h-screen bg-background text-foreground flex flex-col">
          {/* Header - selection後にタブ表示 */}
          <div className="flex-shrink-0 border-b border-border/40 bg-background/80 backdrop-blur">
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center justify-between gap-3 p-3 sm:p-4">
                <div className="flex flex-col items-start">
                  <p className="text-xs text-muted-foreground tracking-[0.25em] uppercase">
                    Sakescope
                  </p>
                  <h1 className="text-base sm:text-lg font-semibold">
                    日本酒ソムリエ相談
                  </h1>
                </div>
                <div className="inline-flex items-center rounded-full border border-border/60 bg-muted/10 p-1">
                  <button
                    type="button"
                    className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                      mode === 'voice'
                        ? 'bg-foreground text-background'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={() => setMode('voice')}
                  >
                    音声
                  </button>
                  <button
                    type="button"
                    className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                      mode === 'text'
                        ? 'bg-foreground text-background'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={() => setMode('text')}
                  >
                    チャット
                  </button>
                </div>
              </div>
              {mode === 'voice' && (
                <div className="text-xs text-muted-foreground flex items-center justify-between px-3 sm:px-4 pb-3">
                  <span>{isVoiceConnected ? '会話中' : 'マイクを許可して開始'}</span>
                  <span className="font-mono tracking-wide text-primary">
                    {recommendedSake?.name ?? 'Realtime'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Main Content */}
          <div className={isTextMode ? 'flex-1 overflow-hidden' : 'flex-1 overflow-auto flex justify-center'}>
            <div
              className={
                isTextMode
                  ? 'w-full h-full flex flex-col'
                  : 'w-full max-w-6xl p-3 sm:p-4 min-h-full flex flex-col'
              }
            >
              {mode === 'voice' ? (
                <div
                  className={
                    shouldCenterVoiceStart
                      ? 'flex flex-col flex-1 items-center justify-center overflow-hidden'
                      : 'flex flex-col gap-4 flex-1 overflow-y-auto'
                  }
                >
                  {recommendedSake && (
                    <SakeDisplay
                      sake={recommendedSake}
                      offer={purchaseOffer}
                      onReset={() => {
                        setRecommendedSake(null);
                        setPurchaseOffer(null);
                      }}
                      showPreferenceMap
                    />
                  )}

                  <VoiceChat
                    variant="full"
                    isRecording={isRecording}
                    setIsRecording={setIsRecording}
                    embedMinimal
                    onSakeRecommended={(sake) => {
                      setRecommendedSake(sake);
                    }}
                    onOfferReady={(offer) => {
                      setRecommendedSake(offer.sake);
                      setPurchaseOffer(offer);
                    }}
                    onConnectionChange={setIsVoiceConnected}
                  />
                </div>
              ) : (
                <div className="relative flex-1 w-full flex flex-col min-h-0">
                  {tokenError && (
                    <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive m-2">
                      {tokenError}
                    </div>
                  )}
                  <ChatKit
                    control={control}
                    className="flex-1 w-full h-full rounded-none border-0"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
