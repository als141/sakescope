import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: giftId } = await context.params;
  const supabase = createServerSupabaseClient();

  const { data: gift, error: giftError } = await supabase
    .from('gifts')
    .select('*')
    .eq('id', giftId)
    .single();

  if (giftError || !gift) {
    return NextResponse.json({ error: 'Gift not found' }, { status: 404 });
  }

  if (gift.sender_user_id !== userId) {
    return NextResponse.json({ error: 'Gift not found' }, { status: 404 });
  }

  let recommendation: { recommendations: unknown; created_at: string | null } | null = null;

  if (['RECOMMEND_READY', 'NOTIFIED', 'CLOSED'].includes(gift.status)) {
    const { data: rec, error: recError } = await supabase
      .from('gift_recommendations')
      .select('recommendations, created_at')
      .eq('gift_id', giftId)
      .maybeSingle();

    if (recError) {
      console.warn('Failed to load gift recommendation', recError);
    } else if (rec) {
      recommendation = {
        recommendations: rec.recommendations,
        created_at: rec.created_at ?? null,
      };
    }
  }

  return NextResponse.json({
    gift,
    recommendation,
  });
}
