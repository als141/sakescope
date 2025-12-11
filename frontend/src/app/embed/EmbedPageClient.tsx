'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import Script from 'next/script';
import { useSearchParams } from 'next/navigation';
import { ChatKit, useChatKit } from '@openai/chatkit-react';
import VoiceChat from '@/components/VoiceChat';
import SakeDisplay from '@/components/SakeDisplay';
import type { Sake, PurchaseOffer } from '@/domain/sake/types';

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

export default function EmbedPageClient() {
  const searchParams = useSearchParams();
  const initialMode = searchParams.get('mode') === 'text' ? 'text' : 'voice';
  const [mode, setMode] = useState<'voice' | 'text'>(initialMode);

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
        'どんな相談でも受け付けます。',
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

  return (
    <>
      <Script
        src="https://cdn.platform.openai.com/deployments/chatkit/chatkit.js"
        strategy="beforeInteractive"
        data-domain-key={CHATKIT_DOMAIN_KEY}
      />
      <div className="h-screen bg-background text-foreground flex flex-col">
        <div className="flex-1 w-full overflow-hidden">
          <div className="flex flex-col gap-4 h-full p-3 sm:p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.45em] text-muted-foreground">
                  Sakescope
                </p>
                <h1 className="text-xl font-semibold">AI Sommelier</h1>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`px-3 py-2 text-sm rounded-full border ${
                    mode === 'voice'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-foreground/80'
                  }`}
                  onClick={() => setMode('voice')}
                >
                  ボイス
                </button>
                <button
                  type="button"
                  className={`px-3 py-2 text-sm rounded-full border ${
                    mode === 'text'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-foreground/80'
                  }`}
                  onClick={() => setMode('text')}
                >
                  チャットではこちら
                </button>
              </div>
            </div>

            {mode === 'voice' ? (
              <div className="flex flex-col gap-4 flex-1 overflow-y-auto">
                <div className="text-xs text-muted-foreground flex items-center justify-between">
                  <span>{isVoiceConnected ? 'Session active' : 'マイクを許可してスタート'}</span>
                  <span className="font-mono tracking-wide text-primary">
                    {recommendedSake?.name ?? 'Realtime'}
                  </span>
                </div>

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
              <div className="relative flex-1 w-full flex flex-col">
                {tokenError && (
                  <div className="mb-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {tokenError}
                  </div>
                )}
                <ChatKit
                  control={control}
                  className="flex-1 w-full rounded-lg border border-border/50"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
