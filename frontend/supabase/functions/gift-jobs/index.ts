import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.1";

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const TEXT_MODEL = Deno.env.get('OPENAI_TEXT_MODEL') ?? 'gpt-5-mini';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('NEXT_PUBLIC_SUPABASE_URL');
const SERVICE_ROLE_KEY =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY');
const MAX_BATCH = Number(Deno.env.get('GIFT_JOB_MAX_BATCH') ?? '3');
const APP_ORIGIN = Deno.env.get('NEXT_PUBLIC_APP_URL') ?? Deno.env.get('SITE_URL') ?? '';
const LINE_TOKEN = Deno.env.get('LINE_MESSAGING_CHANNEL_ACCESS_TOKEN');

type GiftJobStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

type GiftJobRecord = {
  id: string;
  gift_id: string;
  response_id: string;
  status: GiftJobStatus;
  timeout_at: string | null;
  gifts: {
    id: string;
    sender_user_id: string;
    recipient_first_name: string | null;
    occasion: string | null;
    status: string;
  };
};

type GiftJobEventInput = {
  event_type: string;
  label?: string | null;
  message?: string | null;
  payload?: Record<string, unknown> | null;
};

const jsonResponse = (payload: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(payload), {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

type OpenAIResponsePayload = {
  status?: string;
  model?: string;
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
  error?: { message?: string };
  incomplete_details?: { reason?: string };
};

const extractOutputText = (response: OpenAIResponsePayload): string => {
  if (typeof response?.output_text === 'string' && response.output_text.trim().length > 0) {
    return response.output_text;
  }
  if (Array.isArray(response?.output)) {
    for (const item of response.output) {
      if (item?.type !== 'message') continue;
      for (const content of item?.content ?? []) {
        if (content?.type === 'output_text' && typeof content.text === 'string') {
          return content.text;
        }
      }
    }
  }
  throw new Error('Response does not contain output_text');
};

const parseRecommendationPayload = (raw: string): Record<string, unknown> => {
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error('Failed to parse recommendation payload', error);
    throw new Error('Invalid JSON payload from Responses API');
  }
};

const recordGiftJobEvent = async (
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  event: GiftJobEventInput,
) => {
  await supabase.from('gift_job_events').insert({
    job_id: jobId,
    event_type: event.event_type,
    label: event.label ?? null,
    message: event.message ?? null,
    payload: event.payload ?? null,
  });
};

const markGiftJobFailed = async (
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  options: { reason: string; giftId: string },
) => {
  await supabase
    .from('gift_jobs')
    .update({
      status: 'FAILED',
      last_error: options.reason,
      completed_at: new Date().toISOString(),
    })
    .eq('id', jobId);

  await recordGiftJobEvent(supabase, jobId, {
    event_type: 'error',
    label: 'ジョブ失敗',
    message: options.reason,
  });

  await supabase
    .from('gifts')
    .update({ status: 'CLOSED', updated_at: new Date().toISOString() })
    .eq('id', options.giftId);
};

const getLineUserId = async (
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<string | null> => {
  const { data, error } = await supabase
    .from('user_line_accounts')
    .select('line_user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch user_line_accounts', error);
    return null;
  }

  return data?.line_user_id ?? null;
};

const notifyGiftRecommendationReady = async (
  supabase: ReturnType<typeof createClient>,
  options: {
    userId: string;
    giftId: string;
    recipientName?: string | null;
    occasion?: string | null;
  },
) => {
  if (!LINE_TOKEN) {
    return false;
  }
  const lineUserId = await getLineUserId(supabase, options.userId);
  if (!lineUserId) {
    return false;
  }

  const baseOrigin = APP_ORIGIN.replace(/\/$/, '');
  const url = `${baseOrigin || ''}/gift/result/${options.giftId}`;

  const message = {
    type: 'flex',
    altText: 'ギフト推薦が完了しました！',
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '✨ ギフト推薦完了',
            weight: 'bold',
            size: 'md',
            color: '#d4a373',
          },
          {
            type: 'text',
            text: 'AIソムリエによる日本酒の選定が完了しました。結果をご確認ください。',
            wrap: true,
            size: 'sm',
            margin: 'md',
            color: '#666666',
          },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'lg',
            spacing: 'sm',
            contents: [
              {
                type: 'box',
                layout: 'baseline',
                contents: [
                  {
                    type: 'text',
                    text: '宛先',
                    color: '#aaaaaa',
                    size: 'xs',
                    flex: 2,
                  },
                  {
                    type: 'text',
                    text: options.recipientName || '未設定',
                    wrap: true,
                    color: '#666666',
                    size: 'xs',
                    flex: 5,
                  },
                ],
              },
              {
                type: 'box',
                layout: 'baseline',
                contents: [
                  {
                    type: 'text',
                    text: 'シーン',
                    color: '#aaaaaa',
                    size: 'xs',
                    flex: 2,
                  },
                  {
                    type: 'text',
                    text: options.occasion || '未設定',
                    wrap: true,
                    color: '#666666',
                    size: 'xs',
                    flex: 5,
                  },
                ],
              },
            ],
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'primary',
            height: 'sm',
            action: {
              type: 'uri',
              label: '結果を見る',
              uri: url,
            },
            color: '#d4a373',
          },
        ],
        flex: 0,
      },
    },
  };

  try {
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${LINE_TOKEN}`,
      },
      body: JSON.stringify({ to: lineUserId, messages: [message] }),
    });

    if (!res.ok) {
      console.error('Failed to push LINE notification', await res.text().catch(() => 'unknown error'));
      return false;
    }

    return true;
  } catch (error) {
    console.error('LINE push request failed', error);
    return false;
  }
};

const retrieveResponse = async (responseId: string): Promise<OpenAIResponsePayload> => {
  const res = await fetch(`https://api.openai.com/v1/responses/${responseId}`, {
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => 'unknown error');
    throw new Error(`Failed to retrieve response ${responseId}: ${errText}`);
  }

  return (await res.json()) as OpenAIResponsePayload;
};

serve(async (req) => {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 });
  }

  if (!OPENAI_API_KEY || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return jsonResponse({ error: 'Missing server configuration' }, { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: jobs, error } = await supabase
    .from('gift_jobs')
    .select('*, gifts!inner(id, sender_user_id, recipient_first_name, occasion, status)')
    .in('status', ['QUEUED', 'RUNNING'])
    .order('created_at', { ascending: true })
    .limit(MAX_BATCH);

  if (error) {
    console.error('Failed to load gift jobs', error);
    return jsonResponse({ error: 'Failed to load jobs' }, { status: 500 });
  }

  if (!jobs || jobs.length === 0) {
    return jsonResponse({ processed: 0 });
  }

  const nowTs = Date.now();
  let completed = 0;
  let failed = 0;

  for (const job of jobs as GiftJobRecord[]) {
    try {
      if (job.timeout_at && new Date(job.timeout_at).getTime() < nowTs) {
        await markGiftJobFailed(supabase, job.id, {
          reason: 'ジョブがタイムアウトしました',
          giftId: job.gift_id,
        });
        failed += 1;
        continue;
      }

      const response = await retrieveResponse(job.response_id);

      if (response.status === 'queued' || response.status === 'in_progress') {
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
        const parsed = parseRecommendationPayload(rawText);

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

        await notifyGiftRecommendationReady(supabase, {
          userId: job.gifts.sender_user_id,
          giftId: job.gift_id,
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

      const reason =
        response?.error?.message ??
        response?.incomplete_details?.reason ??
        'Responses job failed';
      await markGiftJobFailed(supabase, job.id, { reason, giftId: job.gift_id });
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

  return jsonResponse({ processed: jobs.length, completed, failed });
});
