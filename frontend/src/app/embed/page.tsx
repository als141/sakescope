'use client';

import { useState } from 'react';
import VoiceChat from '@/components/VoiceChat';
import SakeDisplay from '@/components/SakeDisplay';
import type { Sake, PurchaseOffer } from '@/domain/sake/types';

export default function EmbedPage() {
  const [isRecording, setIsRecording] = useState(false);
  const [recommendedSake, setRecommendedSake] = useState<Sake | null>(null);
  const [purchaseOffer, setPurchaseOffer] = useState<PurchaseOffer | null>(null);
  const [isVoiceConnected, setIsVoiceConnected] = useState(false);

  return (
    <div className="min-h-screen bg-background/95 text-foreground flex items-center justify-center px-4 py-6">
      <div className="w-full max-w-4xl rounded-3xl border border-border/40 bg-card/80 backdrop-blur-xl shadow-[0_25px_120px_rgba(0,0,0,0.35)] overflow-hidden">
        <div className="flex flex-col gap-6 p-6 sm:p-10">
          <header className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.45em] text-muted-foreground">Sakescope</p>
              <h1 className="text-2xl font-semibold">AI Voice Sommelier</h1>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <p>{isVoiceConnected ? 'Session active' : 'Tap mic to start'}</p>
              <p className="font-mono tracking-wide text-primary">
                {recommendedSake?.name ?? 'Realtime'}
              </p>
            </div>
          </header>

          {recommendedSake && (
            <SakeDisplay
              sake={recommendedSake}
              offer={purchaseOffer}
              onReset={() => {
                setRecommendedSake(null);
                setPurchaseOffer(null);
              }}
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
      </div>
    </div>
  );
}
