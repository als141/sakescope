import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import type { WebhookEvent } from '@clerk/nextjs/server';
import { createServerSupabaseClient } from '@/lib/supabase';

const CLERK_WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
const LINE_PROVIDER_SLUG = process.env.CLERK_LINE_OAUTH_SLUG ?? process.env.NEXT_PUBLIC_CLERK_LINE_OAUTH_SLUG;

export async function POST(req: NextRequest) {
  if (!CLERK_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing Clerk webhook secret' }, { status: 500 });
  }

  const payload = await req.text();
  const svixId = req.headers.get('svix-id');
  const svixTimestamp = req.headers.get('svix-timestamp');
  const svixSignature = req.headers.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 });
  }

  let event: WebhookEvent;
  try {
    const wh = new Webhook(CLERK_WEBHOOK_SECRET);
    event = wh.verify(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as WebhookEvent;
  } catch (err) {
    console.error('Failed to verify Clerk webhook', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'user.created' || event.type === 'user.updated') {
    await handleUserSync(event).catch((error) => {
      console.error('Failed syncing Clerk user', error);
    });
  }

  return NextResponse.json({ ok: true });
}

async function handleUserSync(event: WebhookEvent) {
  if (!LINE_PROVIDER_SLUG) {
    return;
  }

  const data = event.data as WebhookEvent['data'] & {
    external_accounts?: Array<{
      provider?: string;
      provider_user_id?: string;
      label?: string | null;
    }>;
  };

  const externalAccounts = data.external_accounts ?? [];
  const lineAccount = externalAccounts.find((account) => account.provider === LINE_PROVIDER_SLUG);

  const supabase = createServerSupabaseClient();

  if (!lineAccount) {
    await supabase.from('user_line_accounts').delete().eq('user_id', data.id);
    return;
  }

  if (!lineAccount.provider_user_id) {
    return;
  }

  await supabase.from('user_line_accounts').upsert({
    user_id: data.id,
    line_user_id: lineAccount.provider_user_id,
    display_name: lineAccount.label ?? null,
    friend_flag: true,
    linked_at: new Date().toISOString(),
  });
}
