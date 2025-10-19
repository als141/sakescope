import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase';

const schema = z.object({
  sessionId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = schema.parse(await req.json());
    const supabase = createServerSupabaseClient();

    const { data: session, error: sessionError } = await supabase
      .from('gift_sessions')
      .select('gift_id, age_confirmed')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Gift session not found' },
        { status: 404 },
      );
    }

    if (!session.age_confirmed) {
      await supabase
        .from('gift_sessions')
        .update({
          age_confirmed: true,
        })
        .eq('id', sessionId);
    }

    await supabase
      .from('gifts')
      .update({
        status: 'INTAKE_STARTED',
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.gift_id)
      .in('status', ['OPENED', 'LINK_CREATED']);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to mark age confirmation', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request format', details: error.errors },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
