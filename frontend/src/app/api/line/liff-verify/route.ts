import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import crypto from 'crypto';
import { createServerSupabaseClient } from '@/lib/supabase';

export const runtime = 'nodejs';

const bodySchema = z.object({
  idToken: z.string().min(10),
  accessToken: z.string().min(10),
});

type VerifyIdTokenResponse = {
  sub: string;
  name?: string;
};

async function verifyIdToken(idToken: string, clientId: string) {
  const res = await fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      id_token: idToken,
      client_id: clientId,
    }),
  });

  if (!res.ok) {
    throw new Error('LINE IDトークンの検証に失敗しました。');
  }

  return (await res.json()) as VerifyIdTokenResponse;
}

async function fetchFriendStatus(accessToken: string) {
  try {
    const res = await fetch('https://api.line.me/friendship/v1/status', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      return { friendFlag: null, error: `status ${res.status}` };
    }

    const data = (await res.json()) as { friendFlag: boolean };
    return { friendFlag: data.friendFlag, error: null };
  } catch (error) {
    return {
      friendFlag: null,
      error: error instanceof Error ? error.message : 'unknown error',
    };
  }
}

async function issueLinkToken(lineUserId: string, channelAccessToken: string) {
  const res = await fetch(`https://api.line.me/v2/bot/user/${lineUserId}/linkToken`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${channelAccessToken}`,
    },
  });

  if (!res.ok) {
    throw new Error('linkTokenの発行に失敗しました。');
  }

  const data = (await res.json()) as { linkToken: string };
  return data.linkToken;
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const env = {
      loginChannelId: process.env.LINE_LOGIN_CHANNEL_ID,
      messagingToken: process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN,
    };

    if (!env.loginChannelId || !env.messagingToken) {
      return NextResponse.json(
        { error: 'LINE連携用の環境変数が設定されていません。' },
        { status: 500 },
      );
    }

    const body = bodySchema.parse(await req.json());
    const tokenInfo = await verifyIdToken(body.idToken, env.loginChannelId);
    const lineUserId = tokenInfo.sub;

    if (!lineUserId) {
      return NextResponse.json(
        { error: 'LINEユーザーIDを取得できませんでした。' },
        { status: 400 },
      );
    }

    const { friendFlag, error: friendCheckError } = await fetchFriendStatus(body.accessToken);

    if (friendFlag === false) {
      return NextResponse.json(
        { error: '連携前にLINE公式アカウントを友だち追加してください。' },
        { status: 400 },
      );
    }

    const supabase = createServerSupabaseClient();

    const { data: existingAccount } = await supabase
      .from('user_line_accounts')
      .select('line_user_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (existingAccount?.line_user_id === lineUserId) {
      return NextResponse.json({ status: 'already_linked' });
    }

    const linkToken = await issueLinkToken(lineUserId, env.messagingToken);
    const nonce = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await supabase.from('line_link_nonces').delete().eq('user_id', userId);

    const { error: nonceError } = await supabase.from('line_link_nonces').insert({
      nonce,
      user_id: userId,
      line_user_id: lineUserId,
      expires_at: expiresAt,
    });

    if (nonceError) {
      console.error('Failed to store LINE nonce', nonceError);
      return NextResponse.json(
        { error: '連携用ノンスの保存に失敗しました。' },
        { status: 500 },
      );
    }

    const accountLinkUrl = `https://access.line.me/dialog/bot/accountLink?linkToken=${linkToken}&nonce=${nonce}`;

    return NextResponse.json({ accountLinkUrl, expiresAt, friendFlag, friendCheckError });
  } catch (error) {
    console.error('Error during LIFF verification', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
