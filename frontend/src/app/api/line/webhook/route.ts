import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServerSupabaseClient } from '@/lib/supabase';

export const runtime = 'nodejs';

type LineEvent = {
  type: string;
  source?: {
    userId?: string;
  };
  link?: {
    result?: string;
    nonce?: string;
  };
};

function verifySignature(body: string, signature: string, secret: string) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(body);
  const digest = hmac.digest('base64');
  return digest === signature;
}

async function fetchLineProfile(lineUserId: string, channelAccessToken: string) {
  const res = await fetch(`https://api.line.me/v2/bot/profile/${lineUserId}`, {
    headers: {
      Authorization: `Bearer ${channelAccessToken}`,
    },
  });

  if (!res.ok) {
    return null;
  }

  return res.json() as Promise<{ displayName?: string }>;
}

async function pushConfirmationMessage(lineUserId: string, channelAccessToken: string) {
  await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${channelAccessToken}`,
    },
    body: JSON.stringify({
      to: lineUserId,
      messages: [
        {
          type: 'text',
          text: 'SakescopeとLINEアカウントの連携が完了しました。',
        },
      ],
    }),
  }).catch((error) => {
    console.error('Failed to send LINE confirmation message', error);
  });
}

export async function POST(req: NextRequest) {
  const channelSecret = process.env.LINE_MESSAGING_CHANNEL_SECRET;
  const channelAccessToken = process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN;

  if (!channelSecret || !channelAccessToken) {
    return new NextResponse('LINE credentials are not configured.', { status: 500 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get('x-line-signature') ?? '';

  if (!verifySignature(rawBody, signature, channelSecret)) {
    return new NextResponse('Invalid signature', { status: 403 });
  }

  let payload: { events?: LineEvent[] };

  try {
    payload = JSON.parse(rawBody);
  } catch (error) {
    console.error('Invalid LINE webhook payload', error);
    return new NextResponse('Invalid payload', { status: 400 });
  }
  const supabase = createServerSupabaseClient();

  await Promise.all(
    (payload.events ?? []).map(async (event) => {
      if (event.type === 'accountLink') {
        await handleAccountLinkEvent(event, supabase, channelAccessToken);
      } else if (event.type === 'follow') {
        await updateFriendFlag(event.source?.userId, true, supabase);
      } else if (event.type === 'unfollow') {
        await updateFriendFlag(event.source?.userId, false, supabase);
      }
    })
  );

  return NextResponse.json({ ok: true });
}

async function handleAccountLinkEvent(
  event: LineEvent,
  supabase: ReturnType<typeof createServerSupabaseClient>,
  channelAccessToken: string,
) {
  if (event.link?.result !== 'ok') {
    return;
  }

  const nonce = event.link?.nonce;
  const lineUserId = event.source?.userId;

  if (!nonce || !lineUserId) {
    return;
  }

  const nowIso = new Date().toISOString();

  const { data: nonceRecord } = await supabase
    .from('line_link_nonces')
    .select('user_id, line_user_id')
    .eq('nonce', nonce)
    .gt('expires_at', nowIso)
    .maybeSingle();

  if (!nonceRecord) {
    console.warn('Received accountLink event with unknown nonce');
    return;
  }

  const profile = await fetchLineProfile(lineUserId, channelAccessToken);

  const { error: upsertError } = await supabase.from('user_line_accounts').upsert({
    user_id: nonceRecord.user_id,
    line_user_id: lineUserId,
    display_name: profile?.displayName ?? null,
    friend_flag: true,
    linked_at: new Date().toISOString(),
  });

  if (upsertError) {
    console.error('Failed to upsert user_line_accounts', upsertError);
  }

  await supabase.from('line_link_nonces').delete().eq('nonce', nonce);

  await pushConfirmationMessage(lineUserId, channelAccessToken);
}

async function updateFriendFlag(
  lineUserId: string | undefined,
  friendFlag: boolean,
  supabase: ReturnType<typeof createServerSupabaseClient>,
) {
  if (!lineUserId) return;

  const { error } = await supabase
    .from('user_line_accounts')
    .update({ friend_flag: friendFlag })
    .eq('line_user_id', lineUserId);

  if (error) {
    console.error('Failed to update friend flag', error);
  }
}
