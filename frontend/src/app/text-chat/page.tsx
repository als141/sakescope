'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { ChatKit, useChatKit } from '@openai/chatkit-react';
import { feedbackFormUrl } from '@/lib/feedback';

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
  const router = useRouter();
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
      leftAction: {
        icon: 'back-small',
        onClick: () => router.push('/'),
      },
      rightAction: {
        icon: 'star',
        onClick: () => {
          window.open(feedbackFormUrl, '_blank', 'noopener,noreferrer');
        },
      },
    },
    history: {
      enabled: true,
      showDelete: false,
      showRename: true,
    },
    startScreen: {
      greeting:
        '条件を伝えると、原商株式会社「越後名門酒会」のストアから実在する商品ページ付きで提案します。',
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
      <div className="min-h-screen bg-background">
        {tokenError && (
          <div className="mx-auto max-w-4xl px-4 py-3 text-sm text-destructive border border-destructive/30 bg-destructive/10 rounded-md mt-3">
            {tokenError}
          </div>
        )}
        <div className="h-[calc(100vh-0px)] w-full">
          <ChatKit control={control} className="h-full w-full" />
        </div>
      </div>
    </>
  );
}

export default function TextChatPage() {
  return <TextChatCanvas />;
}
