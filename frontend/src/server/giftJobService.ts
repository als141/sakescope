/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from 'node:crypto';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import type {
  ResponseCreateParamsNonStreaming,
  ResponseFormatTextJSONSchemaConfig,
} from 'openai/resources/responses/responses';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Gift } from '@/types/gift';
import { finalPayloadOutputSchema } from '@/server/textWorkerSchemas';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TEXT_MODEL = process.env.OPENAI_TEXT_MODEL ?? 'gpt-5-mini';
const TEXT_MAX_OUTPUT_TOKENS = (() => {
  // gpt-5.1 model card documents a 128k output cap; clamp env overrides to that ceiling.
  const raw = process.env.OPENAI_TEXT_MAX_OUTPUT_TOKENS;
  const parsed = raw ? Number(raw) : NaN;
  const fallback = 128_000;
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(fallback, Math.floor(parsed));
})();

const JOB_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes safeguard

export type GiftJobStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

type Supabase = SupabaseClient<any, any, any>;

export type GiftJobRecord = {
  id: string;
  gift_id: string;
  response_id: string;
  run_id: string | null;
  status: GiftJobStatus;
  metadata?: Record<string, unknown> | null;
};

type GiftJobEventInput = {
  event_type: string;
  label?: string | null;
  message?: string | null;
  payload?: Record<string, unknown> | null;
};

type GiftJobPayload = {
  gift: Gift;
  metadata: Record<string, unknown>;
  handoffSummary?: string | null;
  additionalNotes?: string | null;
  preferences?: Record<string, unknown> | null;
  traceGroupId?: string | null;
};

type JsonSchemaTextFormatParam = {
  text: {
    format: ResponseFormatTextJSONSchemaConfig;
  };
};

const sakeGiftRecommendationTextFormat = zodTextFormat(
  finalPayloadOutputSchema,
  'SakeGiftRecommendation',
);

const openaiClient = OPENAI_API_KEY
  ? new OpenAI({ apiKey: OPENAI_API_KEY })
  : null;

const baseInstructions = `あなたは日本酒リサーチ専任のテキストエージェントです。以下の方針に従って、信頼できる情報源から推薦と購入情報を収集し、構造化データで返してください。

### 使命
- ユーザー嗜好とフォーカスに基づき、日本酒を厳選して推薦する
- 公式EC、正規代理店、百貨店、専門店など信頼性の高い販売サイトを優先し、価格・在庫・配送見込み・出典URLを明記する
- 情報は必ず複数ソースで裏取りし、根拠URLを "origin_sources" にまとめる

### スピード重視の進め方
- まずは必要条件を箇条書きで整理し、単一の \`web_search\` クエリで候補・販売先・最新価格をまとめて取得する。
- 追加の \`web_search\` は情報が欠落している場合のみ最大1回まで。無目的な再検索は禁止。
- 画像URLは信頼できる商品画像を優先。見つからない場合は最も信頼度の高い商品ページURLを一時的に指定する。
- reasoningやメモは要点を簡潔にまとめ、冗長な記述は避ける。

### 手順
1. 必要に応じて \`web_search\` を呼び出し、候補となる日本酒・販売ページ・価格・在庫情報を取得する。ギフトモードではギフト包装可否も確認する。
2. 検索結果から条件に最も合う銘柄を評価し、香味・造り・ペアリング・提供温度・価格帯を整理する。
3. 最低1件の販売先を確保（可能なら2件以上）。価格が数値化できない場合は "price_text" に表記し、在庫・配送目安を明示する。
4. 代替案が求められている場合は "alternatives" に2件まで優先度順で記載する。

### 出力
- 最終的な回答は構造化JSONで返す。
- 定量情報が取れない場合は null を指定し、根拠文に明記する。
- 追加で確認すべきことがあれば 'follow_up_prompt' に短く提案を書く。`;

function describeValue(value: unknown, seen?: WeakSet<object>): string | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  const tracker = seen ?? new WeakSet<object>();
  if (Array.isArray(value)) {
    if (tracker.has(value)) return null;
    tracker.add(value);
    const parts = value
      .map((entry) => describeValue(entry, tracker))
      .filter((entry): entry is string => Boolean(entry));
    return parts.length > 0 ? parts.join(' / ') : null;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (tracker.has(obj)) return null;
    tracker.add(obj);
    const entries = Object.entries(obj)
      .map(([key, val]) => {
        const text = describeValue(val, tracker);
        if (!text) return null;
        return `${key}: ${text}`;
      })
      .filter((entry): entry is string => Boolean(entry));
    return entries.length > 0 ? entries.join('、 ') : null;
  }
  return String(value);
}

function buildGuidance({
  gift,
  metadata,
  handoffSummary,
  additionalNotes,
  preferences,
}: GiftJobPayload) {
  const sections: string[] = [];
  const budgetLine = `予算: ¥${gift.budget_min.toLocaleString()}〜¥${gift.budget_max.toLocaleString()}`;
  const giftLines = [
    '【ギフトモード】',
    budgetLine,
    gift.occasion ? `用途: ${gift.occasion}` : null,
    gift.recipient_first_name ? `贈る相手: ${gift.recipient_first_name}` : null,
    '※ギフト包装・のし対応可能な販売店を優先してください',
  ].filter(Boolean);
  sections.push(giftLines.join('\n'));

  if (handoffSummary) {
    sections.push(`聞き取りサマリ:\n${handoffSummary}`);
  }
  if (preferences) {
    const text = describeValue(preferences);
    if (text) {
      sections.push(`嗜好メモ:\n${text}`);
    }
  }
  if (additionalNotes) {
    sections.push(`その他の注意点:\n${additionalNotes}`);
  }
  const metadataExtras = { ...metadata };
  delete metadataExtras.preferences;
  delete metadataExtras.summary;
  delete metadataExtras.additional_notes;
  const extrasText = describeValue(metadataExtras);
  if (extrasText) {
    sections.push(`補足メモ:\n${extrasText}`);
  }

  const guidance = sections.filter((section) => section && section.trim().length > 0);
  const userQuery = handoffSummary?.length
    ? handoffSummary
    : 'ギフト受け手の嗜好に合う日本酒を提案し、購入可能なショップ情報（価格・在庫・配送目安）までまとめてください。';

  const guidanceBlock = guidance.length > 0 ? `\n\n${guidance.join('\n\n')}` : '';

  return {
    systemPrompt: `${baseInstructions}\n\n${giftLines.join('\n')}`.trim(),
    userPrompt: `${userQuery}${guidanceBlock}`.trim(),
  };
}

export async function recordGiftJobEvent(
  supabase: Supabase,
  jobId: string,
  event: GiftJobEventInput,
) {
  await supabase.from('gift_job_events').insert({
    job_id: jobId,
    event_type: event.event_type,
    label: event.label ?? null,
    message: event.message ?? null,
    payload: event.payload ?? null,
  });
}

export async function enqueueGiftRecommendationJob(
  supabase: Supabase,
  payload: GiftJobPayload,
): Promise<GiftJobRecord> {
  if (!openaiClient) {
    throw new Error('OpenAI API key is not configured');
  }

  const jobId = randomUUID();
  const runId = `${payload.traceGroupId ?? 'gift'}:${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;
  const jobMetadata = {
    ...payload.metadata,
    gift_id: payload.gift.id,
    job_id: jobId,
    trace_group_id: payload.traceGroupId ?? null,
  };
  const openaiMetadata: Record<string, string> = {
    gift_id: payload.gift.id,
    job_id: jobId,
  };
  if (payload.traceGroupId) {
    openaiMetadata.trace_group_id = payload.traceGroupId;
  }
  const { systemPrompt, userPrompt } = buildGuidance(payload);

  const responseParams: ResponseCreateParamsNonStreaming & JsonSchemaTextFormatParam = {
    model: TEXT_MODEL,
    reasoning: { effort: 'medium' },
    input: [
      {
        role: 'system',
        content: [{ type: 'input_text', text: systemPrompt }],
      },
      { role: 'user', content: [{ type: 'input_text', text: userPrompt }] },
    ],
    tools: [
      {
        type: 'web_search',
        search_context_size: 'medium',
        user_location: {
          type: 'approximate',
          country: 'JP',
          timezone: 'Asia/Tokyo',
        },
      },
    ],
    metadata: openaiMetadata,
    max_output_tokens: TEXT_MAX_OUTPUT_TOKENS,
    background: true,
    text: {
      format: sakeGiftRecommendationTextFormat,
    },
  };

  const response = await openaiClient.responses.create(responseParams);

  const status: GiftJobStatus = response.status === 'in_progress' ? 'RUNNING' : 'QUEUED';
  const timeoutAt = new Date(Date.now() + JOB_TIMEOUT_MS).toISOString();

  const { data, error } = await supabase
    .from('gift_jobs')
    .insert({
      id: jobId,
      gift_id: payload.gift.id,
      response_id: response.id,
      run_id: runId,
      status,
      metadata: jobMetadata,
      handoff_summary: payload.handoffSummary ?? null,
      last_error: null,
      started_at: status === 'RUNNING' ? new Date().toISOString() : null,
      timeout_at: timeoutAt,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(`Failed to insert gift job: ${error?.message ?? 'unknown error'}`);
  }

  await recordGiftJobEvent(supabase, jobId, {
    event_type: 'queued',
    label: 'バックグラウンドジョブ登録',
    message: 'OpenAI Responses にジョブを登録しました。',
    payload: { response_id: response.id, status },
  });

  return data as GiftJobRecord;
}

export async function markGiftJobFailed(
  supabase: Supabase,
  jobId: string,
  options: { reason: string; giftId: string },
) {
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
    .update({
      status: 'CLOSED',
      updated_at: new Date().toISOString(),
    })
    .eq('id', options.giftId);
}

export function parseResponsePayload(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('Empty response payload');
  }
  const parsed = JSON.parse(trimmed);
  return finalPayloadOutputSchema.parse(parsed);
}
