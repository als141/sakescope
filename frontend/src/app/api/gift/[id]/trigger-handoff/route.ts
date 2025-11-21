import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase';
import { enqueueGiftRecommendationJob } from '@/server/giftJobService';
import type { Gift } from '@/types/gift';

const handoffSchema = z.object({
  sessionId: z.string().uuid(),
  intakeSummary: z.record(z.unknown()).nullable().optional(),
  handoffSummary: z.string().min(1, 'handoffSummary must not be empty').optional(),
  additionalNotes: z.string().nullable().optional(),
  conversationLog: z.string().nullable().optional(),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: giftId } = await context.params;
    const body = await req.json();
    const {
      sessionId,
      intakeSummary,
      handoffSummary,
      additionalNotes,
      conversationLog,
    } = handoffSchema.parse(body);

    const supabase = createServerSupabaseClient();

    // Verify gift and session exist
    const { data: gift, error: giftError } = await supabase
      .from('gifts')
      .select('*, gift_sessions!inner(*)')
      .eq('id', giftId)
      .eq('gift_sessions.id', sessionId)
      .single();

    if (giftError || !gift) {
      return NextResponse.json(
        { error: 'Invalid gift or session' },
        { status: 404 }
      );
    }

    const normalizedIntake: Record<string, unknown> =
      intakeSummary && typeof intakeSummary === 'object'
        ? { ...intakeSummary }
        : {};

    if (handoffSummary) {
      normalizedIntake.__summary = handoffSummary;
    }
    if (additionalNotes) {
      normalizedIntake.__additional_notes = additionalNotes;
    }
    if (conversationLog) {
      normalizedIntake.__conversation_log = conversationLog;
    }

    const completedAt = new Date().toISOString();

    const { error: sessionUpdateError } = await supabase
      .from('gift_sessions')
      .update({
        intake_summary: Object.keys(normalizedIntake).length > 0 ? normalizedIntake : null,
        completed_at: completedAt,
      })
      .eq('id', sessionId);

    if (sessionUpdateError) {
      console.error('Failed to update gift session', sessionUpdateError);
      return NextResponse.json(
        { error: 'Failed to update gift session' },
        { status: 500 },
      );
    }

    const { error: giftStatusError } = await supabase
      .from('gifts')
      .update({
        status: 'HANDOFFED',
        updated_at: completedAt,
      })
      .eq('id', giftId);

    if (giftStatusError) {
      console.error('Failed to update gift status', giftStatusError);
      return NextResponse.json(
        { error: 'Failed to update gift status' },
        { status: 500 },
      );
    }

    // Invalidate all tokens for this gift now that会話完了
    const { error: tokenConsumeError } = await supabase
      .from('gift_tokens')
      .update({ consumed_at: completedAt })
      .eq('gift_id', giftId)
      .is('consumed_at', null);

    if (tokenConsumeError) {
      console.error('Failed to consume gift tokens on handoff', tokenConsumeError);
      // Do not fail the request; logging only to avoid blocking handoff
    }

    const metadataPayload: Record<string, unknown> = {
      gift_mode: true,
      budget_min: gift.budget_min,
      budget_max: gift.budget_max,
      recipient_name: gift.recipient_first_name,
      occasion: gift.occasion,
      additional_notes: additionalNotes ?? null,
      preferences: normalizedIntake,
      conversation_log: conversationLog ?? null,
    };

    if (handoffSummary) {
      metadataPayload.summary = handoffSummary;
    }

    const giftRecord: Gift = {
      id: gift.id,
      sender_user_id: gift.sender_user_id,
      recipient_first_name: gift.recipient_first_name,
      occasion: gift.occasion,
      budget_min: gift.budget_min,
      budget_max: gift.budget_max,
      message_to_recipient: gift.message_to_recipient,
      status: gift.status,
      created_at: gift.created_at,
      updated_at: gift.updated_at,
    };

    const job = await enqueueGiftRecommendationJob(supabase, {
      gift: giftRecord,
      metadata: metadataPayload,
      handoffSummary,
      additionalNotes,
      preferences: normalizedIntake,
      traceGroupId: `gift-${giftId}`,
    });

    return NextResponse.json({
      success: true,
      message: 'Handoff triggered successfully',
      jobId: job.id,
      responseId: job.response_id,
    });
  } catch (error) {
    console.error('Error in gift handoff:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request format', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
