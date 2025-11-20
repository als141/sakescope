/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from '@supabase/supabase-js';

const LINE_PUSH_ENDPOINT = 'https://api.line.me/v2/bot/message/push';

type FlexMessage = {
  type: 'flex';
  altText: string;
  contents: Record<string, any>;
};

type LineMessage =
  | {
    type: 'text';
    text: string;
  }
  | FlexMessage;

type Supabase = SupabaseClient<any, any, any>;

type GiftContext = {
  giftId: string;
  origin: string;
  occasion?: string | null;
  recipientName?: string | null;
};

function createGiftStartedFlexMessage({
  giftId,
  origin,
  occasion,
  recipientName,
}: GiftContext): FlexMessage {
  const progressUrl = `${origin.replace(/\/$/, '')}/gift`;

  return {
    type: 'flex',
    altText: 'ギフトリンクが開かれ、会話が開始されました',
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '🎁 会話が開始されました',
            weight: 'bold',
            size: 'md',
            color: '#1DB446',
          },
          {
            type: 'text',
            text: 'お相手がギフトリンクを開き、AIソムリエとの会話を始めました。',
            wrap: true,
            size: 'sm',
            margin: 'md',
            color: '#666666',
          },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'lg',
            spacing: 'sm',
            contents: [
              {
                type: 'box',
                layout: 'baseline',
                contents: [
                  {
                    type: 'text',
                    text: '宛先',
                    color: '#aaaaaa',
                    size: 'xs',
                    flex: 2,
                  },
                  {
                    type: 'text',
                    text: recipientName || '未設定',
                    wrap: true,
                    color: '#666666',
                    size: 'xs',
                    flex: 5,
                  },
                ],
              },
              {
                type: 'box',
                layout: 'baseline',
                contents: [
                  {
                    type: 'text',
                    text: 'シーン',
                    color: '#aaaaaa',
                    size: 'xs',
                    flex: 2,
                  },
                  {
                    type: 'text',
                    text: occasion || '未設定',
                    wrap: true,
                    color: '#666666',
                    size: 'xs',
                    flex: 5,
                  },
                ],
              },
            ],
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'primary',
            height: 'sm',
            action: {
              type: 'uri',
              label: '進捗を見る',
              uri: progressUrl,
            },
            color: '#2c2c2c',
          },
        ],
        flex: 0,
      },
    },
  };
}

function createGiftReadyFlexMessage({
  giftId,
  origin,
  occasion,
  recipientName,
}: GiftContext): FlexMessage {
  const url = `${origin.replace(/\/$/, '')}/gift/result/${giftId}`;

  return {
    type: 'flex',
    altText: 'ギフト推薦が完了しました！',
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '✨ ギフト推薦完了',
            weight: 'bold',
            size: 'md',
            color: '#d4a373', // Gold/Brownish color for premium feel
          },
          {
            type: 'text',
            text: 'AIソムリエによる日本酒の選定が完了しました。結果をご確認ください。',
            wrap: true,
            size: 'sm',
            margin: 'md',
            color: '#666666',
          },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'lg',
            spacing: 'sm',
            contents: [
              {
                type: 'box',
                layout: 'baseline',
                contents: [
                  {
                    type: 'text',
                    text: '宛先',
                    color: '#aaaaaa',
                    size: 'xs',
                    flex: 2,
                  },
                  {
                    type: 'text',
                    text: recipientName || '未設定',
                    wrap: true,
                    color: '#666666',
                    size: 'xs',
                    flex: 5,
                  },
                ],
              },
              {
                type: 'box',
                layout: 'baseline',
                contents: [
                  {
                    type: 'text',
                    text: 'シーン',
                    color: '#aaaaaa',
                    size: 'xs',
                    flex: 2,
                  },
                  {
                    type: 'text',
                    text: occasion || '未設定',
                    wrap: true,
                    color: '#666666',
                    size: 'xs',
                    flex: 5,
                  },
                ],
              },
            ],
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'primary',
            height: 'sm',
            action: {
              type: 'uri',
              label: '結果を見る',
              uri: url,
            },
            color: '#d4a373',
          },
        ],
        flex: 0,
      },
    },
  };
}

async function getLineUserId(
  supabase: Supabase,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('user_line_accounts')
    .select('line_user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch user_line_accounts', error);
    return null;
  }

  return data?.line_user_id ?? null;
}

async function pushLineMessagesForUser({
  supabase,
  userId,
  messages,
}: {
  supabase: Supabase;
  userId: string;
  messages: LineMessage[];
}) {
  const channelAccessToken = process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN;
  if (!channelAccessToken) {
    return false;
  }

  const lineUserId = await getLineUserId(supabase, userId);
  if (!lineUserId) {
    return false;
  }

  try {
    const res = await fetch(LINE_PUSH_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({
        to: lineUserId,
        messages,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => 'unknown error');
      console.error('Failed to push LINE message', errText);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to call LINE push API', error);
    return false;
  }
}

export async function notifyGiftLinkOpened(options: GiftContext & { supabase: Supabase; userId: string }) {
  const { supabase, userId, ...context } = options;
  const message = createGiftStartedFlexMessage(context);
  return pushLineMessagesForUser({ supabase, userId, messages: [message] });
}

export async function notifyGiftRecommendationReady(options: GiftContext & { supabase: Supabase; userId: string }) {
  const { supabase, userId, ...context } = options;
  const message = createGiftReadyFlexMessage(context);
  return pushLineMessagesForUser({ supabase, userId, messages: [message] });
}
