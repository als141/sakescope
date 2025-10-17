import { NextRequest, NextResponse } from 'next/server';
import { Agent, Runner, tool } from '@openai/agents';
import { OpenAIResponsesModel, webSearchTool } from '@openai/agents-openai';
import { z } from 'zod';
import OpenAI from 'openai';
import { extractPrimaryImageUrl } from '@/server/extractPrimaryImageUrl';
import {
  clearProgress,
  publishProgress,
} from '@/server/textWorkerProgress';
import type { TextWorkerProgressEvent } from '@/types/textWorker';

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
  image_url: z.string().min(1).describe('Direct image URL (e.g., https://example.com/image.jpg) - must be an actual image file, not a product page'),
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
  run_id: z.string().nullable().optional(),
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

const isLikelyImageUrl = (url: string): boolean => {
  // 画像拡張子をチェック
  if (/\.(jpg|jpeg|png|webp|gif|svg|bmp|ico)(\?.*)?$/i.test(url)) {
    return true;
  }
  // HTMLページは画像ではない
  if (/\.(html?|php|asp|jsp)(\?.*)?$/i.test(url)) {
    return false;
  }
  // CDNやcloud画像サービスのパターン
  if (/\/cdn\/|cloudinary|imgix|cloudflare|amazonaws\.com\/.*\/(images?|photos?)/i.test(url)) {
    return true;
  }
  return false;
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
  const rawImageUrl = toTrimmed(sake.image_url);
  
  // エージェントから画像URLが返されている場合
  if (rawImageUrl && isLikelyImageUrl(rawImageUrl)) {
    sake.image_url = rawImageUrl;
    console.log(`[Image] Using agent-provided image: ${rawImageUrl}`);
    return;
  }
  
  // フォールバック: エージェントが画像URLを取得できなかった場合のみ抽出を試みる
  console.log(`[Image] Agent did not provide valid image URL, attempting extraction...`);
  
  // 商品ページURLから画像を抽出
  for (const base of baseCandidates) {
    const resolved = await resolveImageFromPage(base);
    if (resolved) {
      sake.image_url = resolved;
      console.log(`[Image] Fallback: Extracted from ${base}: ${resolved}`);
      return;
    }
  }

  console.log(`[Image] No image found, using default`);
  sake.image_url = DEFAULT_IMAGE_URL;
};

const ensurePayloadImages = async (payload: unknown): Promise<void> => {
  if (!payload || typeof payload !== 'object') {
    return;
  }
  const rec = payload as Record<string, unknown>;
  const tasks: Array<Promise<void>> = [ensureRecommendationImage(rec)];
  
  const alternatives = Array.isArray(rec.alternatives)
    ? (rec.alternatives as unknown[])
    : [];
  for (const alternative of alternatives) {
    if (alternative && typeof alternative === 'object') {
      tasks.push(
        ensureRecommendationImage(alternative as Record<string, unknown>),
      );
    }
  }

  await Promise.allSettled(tasks);
};

const MAX_PROGRESS_MESSAGE_LENGTH = 240;

const truncate = (value: string, limit = MAX_PROGRESS_MESSAGE_LENGTH): string =>
  value.length > limit ? `${value.slice(0, limit - 1)}…` : value;

const safeParseJson = (value: unknown): Record<string, unknown> | null => {
  if (typeof value !== 'string') {
    return null;
  }
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

const extractReasoningSnippet = (rawItem: unknown): string | null => {
  if (!rawItem || typeof rawItem !== 'object') {
    return null;
  }
  const record = rawItem as Record<string, unknown>;
  const content = Array.isArray(record.content)
    ? (record.content as Array<Record<string, unknown>>)
    : [];
  const snippets = content
    .map((part) => {
      if (!part) {
        return null;
      }
      if (typeof part.text === 'string') {
        return part.text;
      }
      if (Array.isArray(part.rawContent)) {
        return part.rawContent
          .map((entry) =>
            entry && typeof entry === 'object' && typeof entry.text === 'string'
              ? entry.text
              : null,
          )
          .filter((entry): entry is string => Boolean(entry))
          .join('\n');
      }
      return null;
    })
    .filter((snippet): snippet is string => Boolean(snippet && snippet.trim()));
  if (snippets.length === 0) {
    return null;
  }
  return truncate(snippets.join('\n').trim());
};

const summarizeToolArguments = (
  toolName: string | null,
  args: Record<string, unknown> | null,
): string | null => {
  if (!args || Object.keys(args).length === 0) {
    return null;
  }
  if (toolName === 'web_search' && typeof args.query === 'string') {
    return `検索クエリ: ${truncate(args.query, 160)}`;
  }
  if (toolName === 'finalize_recommendation') {
    return '最終JSONを組み立て中';
  }
  const preview = truncate(JSON.stringify(args), 160);
  return `引数: ${preview}`;
};

const pickProgressData = (
  toolName: string | null,
  args: Record<string, unknown> | null,
): Record<string, unknown> | undefined => {
  if (!args) {
    return undefined;
  }
  if (toolName === 'web_search') {
    const payload: Record<string, unknown> = {};
    if (typeof args.query === 'string') {
      payload.query = truncate(args.query, 160);
    }
    if (typeof args.site === 'string') {
      payload.site = args.site;
    }
    return payload;
  }
  return undefined;
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
  const providedRunId = toTrimmed(parsed.run_id);
  const runId =
    providedRunId ??
    `${traceGroupId ?? 'trace'}:${Date.now().toString(36)}${Math.random()
      .toString(36)
      .slice(2, 6)}`;

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

  // Cast keeps type system satisfied when mixing local OpenAI dependency with
  // agents-openai's bundled types; runtime still shares the same client.
  const model = new OpenAIResponsesModel(
    openaiClient as unknown as ConstructorParameters<typeof OpenAIResponsesModel>[0],
    TEXT_MODEL,
  );

  const agent = new Agent({
    name: 'Sake Purchase Research Worker',
    model,
    outputType: finalPayloadInputSchema,
    tools: [
      webSearchTool({
        searchContextSize: 'medium',
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

### スピード重視の進め方
- まずは必要条件を箇条書きで整理し、単一の \`web_search\` クエリで候補・販売先・最新価格をまとめて取得する。香り・価格帯・ペアリング用途・ギフト用途を1本の検索語に含めて複数候補を同時に集めること。
- 追加の \`web_search\` は情報が欠落している場合のみ最大1回まで行う（例: 最適候補の在庫が不明／価格が取得できない場合など）。無目的な再検索は禁止。
- 画像URLは販売ページや信頼できる資料に直接画像リンクがある場合のみ採用し、見つからない場合はもっとも信頼性の高い商品ページURLを一時的に \`image_url\` に入力する。サーバーが最終的に画像を抽出するため専用ツールを呼び出す必要はない。
- reasoning やメモは要点を簡潔にまとめ、冗長な重複説明は避ける。

### 手順
1. 必要に応じて \`web_search\` を呼び出し、候補となる日本酒・販売ページ・価格・在庫情報を取得する。
2. 検索結果から条件に最も合う銘柄を評価し、香味・造り・ペアリング・提供温度・価格帯を整理する。可能なら味わいを 1〜5 のスコアで "flavor_profile" に入れる。
3. 最低1件の販売先を確保（可能なら2件以上）。価格が数値化できない場合は "price_text" に表記し、在庫・配送目安を明示する。
4. 代替案が求められている場合は "alternatives" に2件まで優先度順で記載する。

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

  publishProgress(runId, {
    type: 'status',
    label: '検索キュー投入',
    message: 'テキストエージェントがリクエストを受領しました。',
  });

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

  let finalOutput: unknown;
  try {
    const runnerInput =
      guidanceBlock.length > 0
        ? `${userQuery}\n\n${guidanceBlock}`
        : userQuery;
    publishProgress(runId, {
      type: 'status',
      label: '調査開始',
      message: 'テキストエージェントが候補を検索しています。',
    });

    const streamResult = await runner.run(agent, runnerInput, {
      stream: true,
      maxTurns: 6,
    });

    for await (const event of streamResult) {
      if (!event) {
        continue;
      }
      if ((event as { type?: string }).type === 'run_item_stream_event') {
        const runEvent = event as {
          name: string;
          item?: { type?: string; rawItem?: Record<string, unknown>; output?: unknown };
        };
        const rawItem = runEvent.item?.rawItem ?? null;
        const toolName =
          rawItem && typeof rawItem.name === 'string'
            ? (rawItem.name as string)
            : null;

        if (runEvent.name === 'reasoning_item_created' && rawItem) {
          const snippet = extractReasoningSnippet(rawItem);
          if (snippet) {
            publishProgress(runId, {
              type: 'reasoning',
              label: '推論更新',
              message: snippet,
            });
          }
          continue;
        }

        if (runEvent.name === 'tool_called' && rawItem) {
          const args =
            typeof rawItem.arguments === 'string'
              ? safeParseJson(rawItem.arguments)
              : null;
          publishProgress(runId, {
            type: 'tool_started',
            toolName: toolName ?? 'tool',
            label: `${toolName ?? 'tool'} 呼び出し`,
            message: summarizeToolArguments(toolName, args) ?? undefined,
            data: pickProgressData(toolName, args),
          });
          continue;
        }

        if (runEvent.name === 'tool_output' && rawItem) {
          const status =
            typeof rawItem.status === 'string'
              ? rawItem.status.toLowerCase()
              : 'completed';
          const outcome =
            status === 'failed' || status === 'errored'
              ? ('tool_failed' as TextWorkerProgressEvent['type'])
              : ('tool_completed' as TextWorkerProgressEvent['type']);
          let message: string | undefined;
          if (toolName === 'web_search') {
            message =
              outcome === 'tool_completed'
                ? '検索結果を取得しました。'
                : '検索に失敗しました。';
          } else if (toolName === 'finalize_recommendation') {
            message =
              outcome === 'tool_completed'
                ? '推薦JSONを組み立てました。'
                : '推薦JSONの生成に失敗しました。';
          }
          publishProgress(runId, {
            type: outcome,
            toolName: toolName ?? 'tool',
            label:
              outcome === 'tool_completed'
                ? `${toolName ?? 'tool'} 完了`
                : `${toolName ?? 'tool'} 失敗`,
            message,
          });
          continue;
        }

        if (runEvent.name === 'message_output_created' && runEvent.item) {
          const messageItem = runEvent.item;
          if (messageItem && typeof messageItem === 'object') {
            const raw = messageItem as {
              rawItem?: {
                content?: Array<{ type?: string; text?: string }>;
              };
            };
            const content = Array.isArray(raw.rawItem?.content)
              ? raw.rawItem?.content
                  ?.map((piece) =>
                    piece && piece.type === 'output_text' && typeof piece.text === 'string'
                      ? piece.text
                      : null,
                  )
                  .filter((segment): segment is string => Boolean(segment && segment.trim()))
                  .join('\n')
              : null;
            if (content) {
              publishProgress(runId, {
                type: 'message',
                label: '中間メモ',
                message: truncate(content),
              });
            }
          }
        }
      } else if (
        (event as { type?: string }).type === 'agent_updated_stream_event'
      ) {
        const agentEvent = event as { agent?: { name?: string } };
        const agentName =
          agentEvent.agent && typeof agentEvent.agent.name === 'string'
            ? agentEvent.agent.name
            : 'Agent';
        publishProgress(runId, {
          type: 'status',
          label: 'エージェント切り替え',
          message: `${agentName} に切り替えました。`,
        });
      }
    }

    await streamResult.completed;
    if (streamResult.error) {
      throw streamResult.error;
    }
    finalOutput = streamResult.finalOutput;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    publishProgress(runId, {
      type: 'error',
      label: '調査失敗',
      message,
    });
    clearProgress(runId);
    return NextResponse.json(
      {
        error: 'Failed to execute text worker agent',
        details: message,
      },
      { status: 500 },
    );
  }

  if (!finalOutput) {
    publishProgress(runId, {
      type: 'error',
      label: '結果なし',
      message: 'エージェントが最終出力を返しませんでした。',
    });
    clearProgress(runId);
    return NextResponse.json(
      { error: 'Agent did not return a final output' },
      { status: 500 },
    );
  }

  publishProgress(runId, {
    type: 'status',
    label: '後処理',
    message: '補完データと画像URLを整えています。',
  });

  await ensurePayloadImages(finalOutput);

  const payload = finalPayloadOutputSchema.parse(finalOutput);
  publishProgress(runId, {
    type: 'final',
    label: '完了',
    message: '推薦結果をUIに送信しました。',
  });
  clearProgress(runId);
  return NextResponse.json(payload);
}
