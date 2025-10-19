import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@clerk/nextjs/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { generateToken, hashToken } from '@/lib/tokenUtils';

const requestSchema = z
  .object({
    expiresInHours: z.number().int().positive().max(168).optional(),
  })
  .optional();

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: giftId } = await context.params;

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request format', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const expiresInHours = parsed.data?.expiresInHours ?? 72;

  try {
    const supabase = createServerSupabaseClient();

    const { data: gift, error: giftError } = await supabase
      .from('gifts')
      .select('id')
      .eq('id', giftId)
      .eq('sender_user_id', userId)
      .single();

    if (giftError || !gift) {
      return NextResponse.json(
        { error: 'Gift not found' },
        { status: 404 },
      );
    }

    const token = generateToken(32);
    const tokenHash = await hashToken(token);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiresInHours);

    const { error: tokenError } = await supabase.from('gift_tokens').insert({
      gift_id: giftId,
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
    });

    if (tokenError) {
      console.error('Failed to create gift token:', tokenError);
      return NextResponse.json(
        { error: 'Failed to create token' },
        { status: 500 },
      );
    }

    const shareUrl = `${req.nextUrl.origin}/gift/${token}`;

    return NextResponse.json({
      shareUrl,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('Failed to generate gift link:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
