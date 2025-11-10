import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase';
import { notifyGiftRecommendationReady } from '@/server/line/pushClient';

const handoffSchema = z.object({
  sessionId: z.string().uuid(),
  intakeSummary: z.record(z.unknown()).nullable().optional(),
  handoffSummary: z.string().min(1, 'handoffSummary must not be empty').optional(),
  additionalNotes: z.string().nullable().optional(),
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

    // Trigger text worker in the background (non-blocking)
    // We'll call the text-worker API with gift mode enabled
    const metadataPayload: Record<string, unknown> = {
      gift_mode: true,
      budget_min: gift.budget_min,
      budget_max: gift.budget_max,
      preferences: normalizedIntake,
      recipient_name: gift.recipient_first_name,
      occasion: gift.occasion,
      additional_notes: additionalNotes ?? null,
    };

    if (handoffSummary) {
      metadataPayload.summary = handoffSummary;
    }

    if (additionalNotes) {
      metadataPayload.notes = additionalNotes;
    }

    const textWorkerPayload = {
      mode: 'gift',
      gift_id: giftId,
      handoff_summary:
        handoffSummary ??
        'ギフト受け取り側からの嗜好情報に基づき、最適な日本酒を推薦してください。',
      metadata: metadataPayload,
      trace_group_id: `gift-${giftId}`,
    };

    // Fire and forget - call text worker in background
    fetch(`${req.nextUrl.origin}/api/text-worker`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(textWorkerPayload),
    })
      .then(async (response) => {
        if (response.ok) {
          const result = await response.json();

          // Save recommendation to database
          await supabase.from('gift_recommendations').upsert({
            gift_id: giftId,
            recommendations: result,
            model: 'text-agent',
          });

          // Update gift status to RECOMMEND_READY
          await supabase
            .from('gifts')
            .update({
              status: 'RECOMMEND_READY',
              updated_at: new Date().toISOString(),
            })
            .eq('id', giftId);

          // Create notification for sender
          await supabase.from('notifications').insert({
            user_id: gift.sender_user_id,
            type: 'gift_recommend_ready',
            payload: {
              gift_id: giftId,
              occasion: gift.occasion,
              recipient_name: gift.recipient_first_name,
            },
          });

          await notifyGiftRecommendationReady({
            supabase,
            userId: gift.sender_user_id,
            giftId,
            origin: req.nextUrl.origin,
            recipientName: gift.recipient_first_name,
            occasion: gift.occasion,
          });

          console.log(`Gift recommendation ready for gift ${giftId}`);
        } else {
          console.error('Text worker failed:', await response.text());

          // Update gift status to error state (use CLOSED for now)
          await supabase
            .from('gifts')
            .update({
              status: 'CLOSED',
              updated_at: new Date().toISOString(),
            })
            .eq('id', giftId);
        }
      })
      .catch((error) => {
        console.error('Error calling text worker:', error);
      });

    return NextResponse.json({
      success: true,
      message: 'Handoff triggered successfully',
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
