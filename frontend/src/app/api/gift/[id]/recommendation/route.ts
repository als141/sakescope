import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: giftId } = await context.params;
    const supabase = createServerSupabaseClient();

    const { data: gift, error: giftError } = await supabase
      .from('gifts')
      .select('status')
      .eq('id', giftId)
      .single();

    if (giftError || !gift) {
      return NextResponse.json(
        { error: 'Gift not found' },
        { status: 404 },
      );
    }

    let recommendation: unknown = null;
    if (gift.status === 'RECOMMEND_READY' || gift.status === 'NOTIFIED') {
      const { data: recData } = await supabase
        .from('gift_recommendations')
        .select('recommendations')
        .eq('gift_id', giftId)
        .single();
      recommendation = recData?.recommendations ?? null;
    }

    return NextResponse.json({
      status: gift.status,
      recommendation,
    });
  } catch (error) {
    console.error('Failed to fetch gift recommendation', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
