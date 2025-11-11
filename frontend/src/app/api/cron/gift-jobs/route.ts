import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import type { Response as OpenAIResponse } from 'openai/resources/responses/responses';
import { createServerSupabaseClient } from '@/lib/supabase';
import {
  markGiftJobFailed,
  parseResponsePayload,
  recordGiftJobEvent,
} from '@/server/giftJobService';
import { notifyGiftRecommendationReady } from '@/server/line/pushClient';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TEXT_MODEL = process.env.OPENAI_TEXT_MODEL ?? 'gpt-5-mini';
const MAX_BATCH = 3;

export const runtime = 'nodejs';
export const maxDuration = 120;

function extractOutputText(response: OpenAIResponse): string {
  if (response.output_text && response.output_text.trim().length > 0) {
    return response.output_text;
  }
  for (const item of response.output ?? []) {
    if (item.type !== 'message') continue;
    for (const content of item.content ?? []) {
      if (content.type === 'output_text' && typeof content.text === 'string') {
        return content.text;
      }
    }
  }
  throw new Error('Response does not contain output_text');
}

export async function GET(req: NextRequest) {
  if (!OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'OpenAI API key not configured' },
      { status: 500 },
    );
  }

  const supabase = createServerSupabaseClient();
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  const { data: jobs, error } = await supabase
    .from('gift_jobs')
    .select('*, gifts!inner(id, sender_user_id, recipient_first_name, occasion, status)')
    .in('status', ['QUEUED', 'RUNNING'])
    .order('created_at', { ascending: true })
    .limit(MAX_BATCH);

  if (error) {
    console.error('Failed to load gift jobs', error);
    return NextResponse.json({ error: 'Failed to load jobs' }, { status: 500 });
  }

  if (!jobs || jobs.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
  let completed = 0;
  let failed = 0;

  const nowTs = Date.now();

  for (const job of jobs) {
    try {
      if (job.timeout_at && new Date(job.timeout_at).getTime() < nowTs) {
        await markGiftJobFailed(supabase, job.id, {
          reason: 'ジョブがタイムアウトしました',
          giftId: job.gift_id,
        });
        failed += 1;
        continue;
      }

      const response = await openai.responses.retrieve(job.response_id);
      if (response.status === 'in_progress' || response.status === 'queued') {
        if (job.status !== 'RUNNING') {
          await supabase
            .from('gift_jobs')
            .update({ status: 'RUNNING', started_at: new Date().toISOString() })
            .eq('id', job.id);
          await recordGiftJobEvent(supabase, job.id, {
            event_type: 'status',
            label: '推論開始',
            message: 'OpenAI がギフト推薦の推論を開始しました。',
          });
        }
        continue;
      }

      if (response.status === 'completed') {
        const rawText = extractOutputText(response);
        const parsed = parseResponsePayload(rawText);
        await supabase.from('gift_recommendations').upsert({
          gift_id: job.gift_id,
          recommendations: parsed,
          model: response.model ?? TEXT_MODEL,
          created_at: new Date().toISOString(),
        });

        await supabase
          .from('gifts')
          .update({ status: 'RECOMMEND_READY', updated_at: new Date().toISOString() })
          .eq('id', job.gift_id);

        await supabase.from('notifications').insert({
          user_id: job.gifts.sender_user_id,
          type: 'gift_recommend_ready',
          payload: {
            gift_id: job.gift_id,
            recipient_name: job.gifts.recipient_first_name,
            occasion: job.gifts.occasion,
          },
        });

        await notifyGiftRecommendationReady({
          supabase,
          userId: job.gifts.sender_user_id,
          giftId: job.gift_id,
          origin,
          recipientName: job.gifts.recipient_first_name,
          occasion: job.gifts.occasion,
        });

        await supabase
          .from('gift_jobs')
          .update({ status: 'COMPLETED', completed_at: new Date().toISOString() })
          .eq('id', job.id);

        await recordGiftJobEvent(supabase, job.id, {
          event_type: 'final',
          label: '推薦完了',
          message: 'ギフト推薦が完了しました。',
          payload: { model: response.model },
        });
        completed += 1;
        continue;
      }

      // failed or cancelled
      const reason = response.error?.message || response.incomplete_details?.reason || 'Responses job failed';
      await markGiftJobFailed(supabase, job.id, {
        reason,
        giftId: job.gift_id,
      });
      failed += 1;
    } catch (err) {
      console.error(`Failed to process gift job ${job.id}`, err);
      await markGiftJobFailed(supabase, job.id, {
        reason: err instanceof Error ? err.message : 'Unknown error',
        giftId: job.gift_id,
      });
      failed += 1;
    }
  }

  return NextResponse.json({ processed: jobs.length, completed, failed });
}
