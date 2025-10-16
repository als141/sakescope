import { NextRequest, NextResponse } from 'next/server';
import { Agent, Runner, tool } from '@openai/agents';
import { OpenAIResponsesModel, webSearchTool } from '@openai/agents-openai';
import { z } from 'zod';
import OpenAI from 'openai';
import { extractPrimaryImageUrl } from '@/server/extractPrimaryImageUrl';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TEXT_MODEL = process.env.OPENAI_TEXT_MODEL ?? 'gpt-5-mini';

const shopSchema = z.object({
  retailer: z.string(),
  url: z.string().min(1, '商品リンクのURLを指定してください'),
  price: z.number().nullable(),
  price_text: z.string().nullable(),
  currency: z.string().nullable(),
  availability: z.string().nullable(),
  delivery_estimate: z.string().nullable(),
  source: z.string().nullable(),
  notes: z.string().nullable(),
});

const flavorProfileSchema = z
  .object({
    sweetness: z.number().nullable(),
    lightness: z.number().nullable(),
    complexity: z.number().nullable(),
    fruitiness: z.number().nullable(),
  })
  .nullable();

const sakeSchemaInput = z.object({
  id: z.string().nullable(),
  name: z.string(),
  brewery: z.string().nullable(),
  region: z.string().nullable(),
  type: z.string().nullable(),
  alcohol: z.number().nullable(),
  sake_value: z.number().nullable(),
  acidity: z.number().nullable(),
  description: z.string().nullable(),
  tasting_notes: z.array(z.string()).nullable(),
  food_pairing: z.array(z.string()).nullable(),
  serving_temperature: z.array(z.string()).nullable(),
  // NOTE: Agents/Structured-Outputs は JSON Schema の `format` 未対応。
  // z.string().url() は `format: "uri"` を付けるため 400 になる。
  // ここは string にして、実行時に ensurePayloadImages() で正規化する。
  image_url: z.string().min(1).describe('Absolute HTTP(S) URL (validated at runtime)'),
  origin_sources: z.array(z.string()).nullable(),
  price_range: z.string().nullable(),
  flavor_profile: flavorProfileSchema,
});

const sakeSchemaOutput = z.object({
  id: z.string().nullable(),
  name: z.string(),
  brewery: z.string().nullable(),
  region: z.string().nullable(),
  type: z.string().nullable(),
  alcohol: z.number().nullable(),
  sake_value: z.number().nullable(),
  acidity: z.number().nullable(),
  description: z.string().nullable(),
  tasting_notes: z.array(z.string()).nullable(),
  food_pairing: z.array(z.string()).nullable(),
  serving_temperature: z.array(z.string()).nullable(),
  image_url: z.string().url(),
  origin_sources: z.array(z.string()).nullable(),
  price_range: z.string().nullable(),
  flavor_profile: flavorProfileSchema,
});

const recommendationSchemaInput = z.object({
  sake: sakeSchemaInput,
  summary: z.string(),
  reasoning: z.string(),
  tasting_highlights: z.array(z.string()).nullable(),
  serving_suggestions: z.array(z.string()).nullable(),
  shops: z.array(shopSchema).min(1),
});

const recommendationSchemaOutput = z.object({
  sake: sakeSchemaOutput,
  summary: z.string(),
  reasoning: z.string(),
  tasting_highlights: z.array(z.string()).nullable(),
  serving_suggestions: z.array(z.string()).nullable(),
  shops: z.array(shopSchema).min(1),
});

const finalPayloadInputSchema = recommendationSchemaInput.extend({
  alternatives: z.array(recommendationSchemaInput).nullable(),
  follow_up_prompt: z.string().nullable(),
});

const finalPayloadOutputSchema = recommendationSchemaOutput.extend({
  alternatives: z.array(recommendationSchemaOutput).nullable(),
  follow_up_prompt: z.string().nullable(),
});

type HandoffMetadata = {
  include_alternatives?: boolean | null;
  focus?: string | null;
  notes?: string | null;
  preferences?: unknown;
  current_sake?: Record<string, unknown> | null;
  [key: string]: unknown;
};

const handoffRequestMetadataSchema = z
  .object({
    include_alternatives: z.boolean().nullable().optional(),
    focus: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    preferences: z.unknown().optional(),
    current_sake: z.record(z.unknown()).nullable().optional(),
  })
  .catchall(z.unknown())
  .nullable()
  .optional();

const handoffRequestSchema = z.object({
  handoff_summary: z.string().nullable().optional(),
  additional_context: z.string().nullable().optional(),
  metadata: handoffRequestMetadataSchema,
  trace_group_id: z.string().nullable().optional(),
  request: z.string().nullable().optional(),
  focus: z.string().nullable().optional(),
  include_alternatives: z.boolean().nullable().optional(),
  preference_note: z.string().nullable().optional(),
  conversation_context: z.string().nullable().optional(),
  user_profile: z.unknown().optional(),
  current_sake: z.unknown().optional(),
});

const HTTP_URL_PATTERN = /^https?:\/\//i;
const DEFAULT_IMAGE_URL =
  'https://dummyimage.com/480x640/1f2937/ffffff&text=Sake';

const imageExtractionCache = new Map<string, string | null>();

const toTrimmed = (value: unknown): string | null =>
  typeof value === 'string' ? value.trim() || null : null;

const tryResolveWithBase = (value: string | null, base: string): string | null => {
  if (!value) {
    return null;
  }
  try {
    return new URL(value, base).toString();
  } catch {
    return null;
  }
};

const normalizeImageCandidate = (
  raw: unknown,
  baseCandidates: string[],
): string | null => {
  if (typeof raw !== 'string') {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  if (HTTP_URL_PATTERN.test(trimmed)) {
    return trimmed;
  }
  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }
  for (const base of baseCandidates) {
    const resolved = tryResolveWithBase(trimmed, base);
    if (resolved) {
      return resolved;
    }
  }
  return null;
};

const uniqueStrings = (values: unknown[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = toTrimmed(value);
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      result.push(trimmed);
    }
  }
  return result;
};

const collectBaseUrls = (entry: Record<string, unknown>): string[] => {
  const candidates: unknown[] = [];

  const shopsRaw = (entry as { shops?: unknown }).shops;
  const shops = Array.isArray(shopsRaw) ? shopsRaw : [];
  for (const shop of shops) {
    if (shop && typeof shop === 'object') {
      const candidate = toTrimmed((shop as { url?: unknown }).url);
      if (candidate) {
        candidates.push(candidate);
      }
    }
  }

  const sakeRaw = (entry as { sake?: unknown }).sake;
  const originSources = Array.isArray(
    (sakeRaw as { origin_sources?: unknown })?.origin_sources,
  )
    ? ((sakeRaw as { origin_sources?: unknown[] })?.origin_sources as unknown[])
    : [];
  candidates.push(...originSources);

  return uniqueStrings(candidates);
};

const resolveImageFromPage = async (pageUrl: string): Promise<string | null> => {
  if (!pageUrl || !HTTP_URL_PATTERN.test(pageUrl)) {
    return null;
  }
  if (imageExtractionCache.has(pageUrl)) {
    return imageExtractionCache.get(pageUrl) ?? null;
  }
  const result = await extractPrimaryImageUrl(pageUrl);
  imageExtractionCache.set(pageUrl, result);
  return result;
};

const ensureRecommendationImage = async (
  entry: Record<string, unknown>,
): Promise<void> => {
  const sakeRaw = (entry as { sake?: unknown }).sake;
  const sake =
    sakeRaw && typeof sakeRaw === 'object'
      ? (sakeRaw as Record<string, unknown>)
      : null;
  if (!sake) {
    return;
  }

  const baseCandidates = collectBaseUrls(entry);
  const normalized = normalizeImageCandidate(sake.image_url, baseCandidates);
  if (normalized) {
    sake.image_url = normalized;
    return;
  }

  for (const base of baseCandidates) {
    const resolved = await resolveImageFromPage(base);
    if (resolved) {
      sake.image_url = resolved;
      return;
    }
  }

  sake.image_url = DEFAULT_IMAGE_URL;
};

const ensurePayloadImages = async (payload: unknown): Promise<void> => {
  if (!payload || typeof payload !== 'object') {
    return;
  }
  const rec = payload as Record<string, unknown>;
  await ensureRecommendationImage(rec);

  const alternatives = Array.isArray(rec.alternatives)
    ? (rec.alternatives as unknown[])
    : [];
  for (const alternative of alternatives) {
    if (alternative && typeof alternative === 'object') {
      await ensureRecommendationImage(alternative as Record<string, unknown>);
    }
  }
};

function describeValue(
  value: unknown,
  seen?: WeakSet<object>,
): string | null {
  if (value == null) {
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  const tracker = seen ?? new WeakSet<object>();

  if (Array.isArray(value)) {
    if (tracker.has(value)) {
      return null;
    }
    tracker.add(value);
    const items = value
      .map((item) => describeValue(item, tracker))
      .filter((item): item is string => Boolean(item));
    return items.length > 0 ? items.join(' / ') : null;
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (tracker.has(obj)) {
      return null;
    }
    tracker.add(obj);
    const entries = Object.entries(obj)
      .map(([key, val]) => {
        const described = describeValue(val, tracker);
        if (!described) {
          return null;
        }
        return `${key}: ${described}`;
      })
      .filter((entry): entry is string => Boolean(entry));
    return entries.length > 0 ? entries.join('、 ') : null;
  }

  return String(value);
}

function pickText(...candidates: unknown[]): string | null {
  for (const candidate of candidates) {
    const text = describeValue(candidate);
    if (text) {
      return text;
    }
  }
  return null;
}

const finalizeRecommendationTool = tool({
  name: 'finalize_recommendation',
  description:
    '調査結果を構造化JSONとして確定します。必ず最終回答時に一度だけ呼び出してください。',
  parameters: finalPayloadInputSchema,
  strict: true,
  async execute(input) {
    return input;
  },
});

export async function POST(req: NextRequest) {
  if (!OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'OpenAI API key not configured' },
      { status: 500 },
    );
  }

  const rawBody = await req.json().catch(() => ({}));
  const parsed = handoffRequestSchema.parse(rawBody);

  const traceGroupId = parsed.trace_group_id ?? null;

  const baseMetadata =
    parsed.metadata && parsed.metadata !== null
      ? { ...parsed.metadata }
      : ({} as Record<string, unknown>);

  if (parsed.user_profile && baseMetadata.preferences == null) {
    baseMetadata.preferences = parsed.user_profile;
  }
  if (parsed.current_sake && baseMetadata.current_sake == null) {
    baseMetadata.current_sake = parsed.current_sake;
  }
  if (parsed.preference_note && baseMetadata.preference_note == null) {
    baseMetadata.preference_note = parsed.preference_note;
  }
  if (
    typeof parsed.include_alternatives === 'boolean' &&
    baseMetadata.include_alternatives == null
  ) {
    baseMetadata.include_alternatives = parsed.include_alternatives;
  }
  if (parsed.focus && baseMetadata.focus == null) {
    baseMetadata.focus = parsed.focus;
  }

  const metadataParsed = handoffRequestMetadataSchema.parse(baseMetadata);
  const metadataResult: HandoffMetadata =
    (metadataParsed ?? {}) as HandoffMetadata;
  const handoffSummary =
    pickText(parsed.handoff_summary, parsed.request) ?? '';
  const preferenceNarrative = pickText(
    parsed.preference_note,
    metadataResult.preference_note,
    metadataResult.preferences,
    parsed.user_profile,
  );
  const additionalContext = pickText(
    parsed.additional_context,
    parsed.conversation_context,
    metadataResult.notes,
  );
  const focusMeta = pickText(parsed.focus, metadataResult.focus);
  const currentSakeNarrative = pickText(
    metadataResult.current_sake,
    parsed.current_sake,
  );
  const includeAlternatives =
    typeof parsed.include_alternatives === 'boolean'
      ? parsed.include_alternatives
      : typeof metadataResult.include_alternatives === 'boolean'
        ? metadataResult.include_alternatives
        : true;

  const metadataExtras: Record<string, unknown> = { ...metadataResult };
  delete metadataExtras.include_alternatives;
  delete metadataExtras.focus;
  delete metadataExtras.notes;
  delete metadataExtras.preferences;
  delete metadataExtras.current_sake;
  delete metadataExtras.preference_note;
  const extrasNarrative = describeValue(metadataExtras);

  const openaiClient = new OpenAI({
    apiKey: OPENAI_API_KEY,
  });

  const model = new OpenAIResponsesModel(openaiClient, TEXT_MODEL);

  const agent = new Agent({
    name: 'Sake Purchase Research Worker',
    model,
    outputType: finalPayloadInputSchema,
    tools: [
      webSearchTool({
        searchContextSize: 'high',
        userLocation: {
          type: 'approximate',
          country: 'JP',
          timezone: 'Asia/Tokyo',
        },
      }),
      finalizeRecommendationTool,
    ],
    toolUseBehavior: {
      stopAtToolNames: ['finalize_recommendation'],
    },
    instructions: `
あなたは日本酒リサーチ専任のテキストエージェントです。以下の方針に従って、信頼できる情報源から推薦と購入情報を収集し、構造化データで返してください。

### 使命
- ユーザー嗜好とフォーカスに基づき、日本酒を厳選して推薦する
- 公式EC、正規代理店、百貨店、専門店など信頼性の高い販売サイトを優先し、価格・在庫・配送見込み・出典URLを明記する
- 情報は必ず複数ソースで裏取りし、根拠URLを "origin_sources" にまとめる

### 手順
1. 'web_search' ツールで最新情報を収集し、必要に応じて追加検索で補完する
2. 推薦する日本酒の香味・造り・相性・提供温度などを要約する。可能なら味わいを 1〜5 のスコアで "flavor_profile" に入れる
3. 最低1件の販売先を確保（可能なら2件以上）。価格が数値化できない場合は "price_text" に表記
4. 代替案が求められている場合は "alternatives" に2件まで優先度順で記載する

### 出力
- 最終的な回答は必ず一度だけ 'finalize_recommendation' を呼び出し、JSONを返す
- 定量情報が取れない場合は null を指定し、根拠文に明記する
- 追加で確認すべきことがあれば 'follow_up_prompt' に短く提案を書く
    `.trim(),
  });

  const userQuery =
    handoffSummary.length > 0
      ? handoffSummary
      : 'ユーザーの嗜好に合う日本酒を提案し、購入可能なショップ情報（価格・在庫・配送目安）をまとめてください。';

  const contextSections: string[] = [];
  if (preferenceNarrative) {
    contextSections.push(`嗜好や要望のメモ:\n${preferenceNarrative}`);
  }
  if (additionalContext) {
    contextSections.push(`会話から得られた補足情報:\n${additionalContext}`);
  }
  if (focusMeta) {
    contextSections.push(`重点事項:\n${focusMeta}`);
  }
  if (currentSakeNarrative) {
    contextSections.push(`既知の候補:\n${currentSakeNarrative}`);
  }
  if (extrasNarrative) {
    contextSections.push(`追加共有事項:\n${extrasNarrative}`);
  }

  const includeAltInstruction = includeAlternatives
    ? '代替案: 主要な推薦に加え、条件に合致する有望な候補があれば最大2件まで紹介してください。'
    : '代替案: 今回は主要な1本に集中し、代替候補は提示しないでください。';

  const guidanceSections = [includeAltInstruction, ...contextSections].filter(
    (section) => section && section.trim().length > 0,
  );

  const guidanceBlock =
    guidanceSections.length > 0 ? guidanceSections.join('\n\n') : '';

  const runner = new Runner({
    workflowName: 'Sakescope Text Agent',
    groupId: typeof traceGroupId === 'string' && traceGroupId.length > 0 ? traceGroupId : undefined,
    traceMetadata: (() => {
      const metadata: Record<string, string> = {
        channel: 'text',
        include_alternatives: includeAlternatives ? 'true' : 'false',
      };
      if (focusMeta) {
        metadata.focus = focusMeta;
      }
      if (preferenceNarrative) {
        metadata.preference_hint =
          preferenceNarrative.length > 200
            ? `${preferenceNarrative.slice(0, 197)}...`
            : preferenceNarrative;
      }
      if (currentSakeNarrative) {
        metadata.current_sake =
          currentSakeNarrative.length > 200
            ? `${currentSakeNarrative.slice(0, 197)}...`
            : currentSakeNarrative;
      }
      return metadata;
    })(),
  });

  let result;
  try {
    const runnerInput =
      guidanceBlock.length > 0
        ? `${userQuery}\n\n${guidanceBlock}`
        : userQuery;
    result = await runner.run(agent, runnerInput);
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to execute text worker agent',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }

  const finalOutput = result.finalOutput;
  if (!finalOutput) {
    return NextResponse.json(
      { error: 'Agent did not return a final output' },
      { status: 500 },
    );
  }

  await ensurePayloadImages(finalOutput);

  const payload = finalPayloadOutputSchema.parse(finalOutput);
  return NextResponse.json(payload);
}
