/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from '@supabase/supabase-js';

const LINE_PUSH_ENDPOINT = 'https://api.line.me/v2/bot/message/push';

type LineMessage = {
  type: 'text';
  text: string;
};

type Supabase = SupabaseClient<any, any, any>;

type GiftContext = {
  giftId: string;
  origin: string;
  occasion?: string | null;
  recipientName?: string | null;
};

function formatGiftContext({ occasion, recipientName }: GiftContext) {
  const parts: string[] = [];
  if (recipientName) {
    parts.push(`宛先: ${recipientName}`);
  }
  if (occasion) {
    parts.push(`シーン: ${occasion}`);
  }
  return parts.join(' / ');
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
  const { supabase, userId, giftId, origin, recipientName, occasion } = options;
  const contextLine = formatGiftContext({ occasion, recipientName, giftId, origin });
  const progressUrl = `${origin.replace(/\/$/, '')}/gift`;
  const messages: LineMessage[] = [
    { type: 'text', text: 'ギフトリンクが開かれ、会話が開始されました。' },
    { type: 'text', text: `進捗を見る: ${progressUrl}` },
  ];
  if (contextLine) {
    messages.unshift({ type: 'text', text: contextLine });
  }
  return pushLineMessagesForUser({ supabase, userId, messages });
}

export async function notifyGiftRecommendationReady(options: GiftContext & { supabase: Supabase; userId: string }) {
  const { supabase, userId, giftId, origin, recipientName, occasion } = options;
  const url = `${origin.replace(/\/$/, '')}/gift/result/${giftId}`;
  const contextLine = formatGiftContext({ occasion, recipientName, giftId, origin });
  const messages: LineMessage[] = [
    { type: 'text', text: 'ギフト推薦が完成しました！' },
    { type: 'text', text: `結果を見る: ${url}` },
  ];
  if (contextLine) {
    messages.unshift({ type: 'text', text: contextLine });
  }
  return pushLineMessagesForUser({ supabase, userId, messages });
}
