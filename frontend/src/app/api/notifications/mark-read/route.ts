import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase';

const requestSchema = z
  .object({
    notificationId: z.number().int().positive().optional(),
    giftId: z.string().uuid().optional(),
  })
  .refine((value) => Boolean(value.notificationId) || Boolean(value.giftId), {
    message: 'notificationId or giftId is required',
  });

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Invalid request',
        detail: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const supabase = createServerSupabaseClient();
  const now = new Date().toISOString();

  const query = parsed.data.notificationId
    ? supabase
        .from('notifications')
        .update({ read_at: now })
        .eq('id', parsed.data.notificationId)
        .eq('user_id', userId)
        .is('read_at', null)
        .select('id')
    : supabase
        .from('notifications')
        .update({ read_at: now })
        .eq('user_id', userId)
        .eq('type', 'gift_recommend_ready')
        .is('read_at', null)
        .contains('payload', { gift_id: parsed.data.giftId })
        .select('id');

  const { data, error } = await query;
  if (error) {
    console.error('Failed to mark notifications read', error);
    return NextResponse.json({ error: 'Failed to update notification state' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, updated: data?.length ?? 0 });
}

