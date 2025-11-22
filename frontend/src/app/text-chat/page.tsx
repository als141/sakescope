'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { ChatKit, useChatKit } from '@openai/chatkit-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

const CHATKIT_DOMAIN_KEY =
  process.env.NEXT_PUBLIC_TEXT_CHATKIT_DOMAIN_KEY ?? 'sakescope-text';

type TokenState = {
  secret: string | null;
  expiresAt: number;
};

const presetPrompts = [
  '新潟でキレのある辛口を2本だけ知りたい',
  '香り華やかで冷酒に向く日本酒をおすすめして',
  '燗にしておいしい純米酒を食事と合わせたい',
  'お祝い席に映える1本を提案して',
];

function TextChatCanvas() {
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
        const message =
          error instanceof Error ? error.message : 'Token refresh failed';
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
      enabled: true,
      title: {
        enabled: true,
        text: 'Sake Concierge',
      },
    },
    history: {
      enabled: true,
      showDelete: false,
      showRename: true,
    },
    startScreen: {
      greeting:
        '条件を伝えると allowed_domains の検索結果から実在ストアページ付きで提案します。',
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
      <div className="min-h-screen bg-gradient-to-b from-background via-background to-background/90">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild className="h-10 w-10">
              <Link href="/">
                <ArrowLeft className="h-5 w-5" />
                <span className="sr-only">戻る</span>
              </Link>
            </Button>
            <div>
              <p className="text-sm text-muted-foreground">テキストで相談</p>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-semibold text-foreground">
                  Sake Concierge
                </h1>
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <p className="text-xs text-muted-foreground">
                OpenAI Agent Builder + ChatKit
              </p>
            </div>
          </div>

          {tokenError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
              {tokenError}
            </div>
          )}

          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <p className="text-sm text-muted-foreground">
                allowed_domains の情報だけを参照し、必ずストアページのリンク付きで提案します。
              </p>
            </CardHeader>
            <CardContent className="min-h-[520px] flex flex-col gap-3">
              <ChatKit
                control={control}
                className="flex-1 min-h-[420px] border border-border bg-background rounded-xl"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

export default function TextChatPage() {
  return <TextChatCanvas />;
}
