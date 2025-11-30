import { NextRequest, NextResponse } from 'next/server';
import { Agent, Runner, tool } from '@openai/agents';
import { OpenAIResponsesModel, webSearchTool } from '@openai/agents-openai';
import { hostedMcpTool } from '@openai/agents';
import { z } from 'zod';
import OpenAI from 'openai';
import {
  clearProgress,
  publishProgress,
} from '@/server/textWorkerProgress';
import {
  finalPayloadInputSchema,
  finalPayloadOutputSchema,
} from '@/server/textWorkerSchemas';

export const runtime = 'nodejs';
export const maxDuration = 300;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TEXT_MODEL =
  process.env.OPENAI_TEXT_MODEL_EMBED ??
  process.env.OPENAI_TEXT_MODEL ??
  'gpt-5-mini';
const EMBED_ALLOWED_DOMAINS = process.env.TEXT_EMBED_ALLOWED_DOMAINS;
const MCP_URL = process.env.TEXT_EMBED_MCP_URL;
const MCP_TOKEN = process.env.TEXT_EMBED_MCP_TOKEN;

const REASONING_EFFORT_LEVELS = ['minimal', 'low', 'medium', 'high'] as const;
type ReasoningEffortLevel = (typeof REASONING_EFFORT_LEVELS)[number];
const REASONING_SUMMARY_LEVELS = ['auto', 'concise', 'detailed'] as const;
type ReasoningSummaryLevel = (typeof REASONING_SUMMARY_LEVELS)[number];
const VERBOSITY_LEVELS = ['low', 'medium', 'high'] as const;
type VerbosityLevel = (typeof VERBOSITY_LEVELS)[number];

const HTTP_URL_PATTERN = /^https?:\/\/\S+/i;

class InvalidRecommendationPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidRecommendationPayloadError';
  }
}

const assertMeaningfulText = (value: unknown, label: string): string => {
  if (typeof value !== 'string') {
    throw new InvalidRecommendationPayloadError(`${label}の形式が不正です`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new InvalidRecommendationPayloadError(`${label}を空欄にしないでください`);
  }
  return trimmed;
};

const assertHttpUrl = (value: unknown, label: string): string => {
  const text = assertMeaningfulText(value, label);
  if (!HTTP_URL_PATTERN.test(text)) {
    throw new InvalidRecommendationPayloadError(`${label}には http(s) の完全なURLを指定してください`);
  }
  return text;
};

const normalizeEnvEnum = <T extends readonly string[]>(
  value: string | undefined,
  allowed: T,
  fallback: T[number],
): T[number] => {
  if (!value) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  return allowed.find((item) => item === normalized) ?? fallback;
};

const TEXT_AGENT_REASONING_EFFORT: ReasoningEffortLevel = normalizeEnvEnum(
  process.env.TEXT_AGENT_REASONING_EFFORT,
  REASONING_EFFORT_LEVELS,
  'low',
);

const TEXT_AGENT_REASONING_SUMMARY: ReasoningSummaryLevel = normalizeEnvEnum(
  process.env.TEXT_AGENT_REASONING_SUMMARY,
  REASONING_SUMMARY_LEVELS,
  'detailed',
);

const TEXT_AGENT_VERBOSITY: VerbosityLevel = normalizeEnvEnum(
  process.env.TEXT_AGENT_VERBOSITY,
  VERBOSITY_LEVELS,
  'low',
);

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

type FinalRecommendationPayload = z.infer<typeof finalPayloadOutputSchema>;

const validateRecommendationPayload = (
  payload: FinalRecommendationPayload,
): void => {
  assertMeaningfulText(payload.summary, 'summary');
  assertMeaningfulText(payload.reasoning, 'reasoning');
  assertMeaningfulText(payload.sake.name, 'sake.name');
  assertHttpUrl(payload.sake.image_url, 'sake.image_url');

  payload.shops.forEach((shop, index) => {
    assertMeaningfulText(shop.retailer, `shops[${index}].retailer`);
    assertHttpUrl(shop.url, `shops[${index}].url`);
    if (
      shop.price == null &&
      (!shop.price_text || typeof shop.price_text !== 'string' || !shop.price_text.trim())
    ) {
      throw new InvalidRecommendationPayloadError(
        `shops[${index}].price か price_text のどちらかは必須です`,
      );
    }
  });

  if (payload.alternatives) {
    payload.alternatives.forEach((alt, index) => {
      assertMeaningfulText(alt.name, `alternatives[${index}].name`);
      if (alt.url) {
        assertHttpUrl(alt.url, `alternatives[${index}].url`);
      }
      if (
        alt.price_text &&
        typeof alt.price_text === 'string' &&
        alt.price_text.trim().length === 0
      ) {
        throw new InvalidRecommendationPayloadError(
          `alternatives[${index}].price_text を空文字にしないでください`,
        );
      }
    });
  }

  if (payload.preference_map) {
    if (
      !Array.isArray(payload.preference_map.axes) ||
      payload.preference_map.axes.length < 3 ||
      payload.preference_map.axes.length > 6
    ) {
      throw new InvalidRecommendationPayloadError(
        'preference_map.axes は 3〜6 件の配列で指定してください',
      );
    }
    payload.preference_map.axes.forEach((axis, index) => {
      assertMeaningfulText(axis.label, `preference_map.axes[${index}].label`);
      if (
        typeof axis.level !== 'number' ||
        Number.isNaN(axis.level) ||
        axis.level < 1 ||
        axis.level > 5
      ) {
        throw new InvalidRecommendationPayloadError(
          `preference_map.axes[${index}].level は 1〜5 の数値で指定してください`,
        );
      }
    });
  }
};
const handoffRequestMetadataSchema = z
  .object({
    include_alternatives: z.boolean().nullable().optional(),
    focus: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    preferences: z.unknown().optional(),
    current_sake: z.record(z.unknown()).nullable().optional(),
    // Gift mode specific fields
    gift_mode: z.boolean().optional(),
    budget_min: z.number().optional(),
    budget_max: z.number().optional(),
    recipient_name: z.string().nullable().optional(),
    occasion: z.string().nullable().optional(),
    conversation_log: z.string().nullable().optional(),
  })
  .catchall(z.unknown())
  .nullable()
  .optional();

const handoffRequestSchema = z.object({
  handoff_summary: z.string().nullable().optional(),
  additional_context: z.string().nullable().optional(),
  conversation_log: z.string().nullable().optional(),
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
  // Gift mode
  mode: z.string().optional(),
  gift_id: z.string().optional(),
});

const handoffResponseSchema = finalPayloadOutputSchema;

const finalizeRecommendationTool = tool({
  name: 'finalize_recommendation',
  description:
    '候補を1本に絞り、詳細情報と購入リンクを構造化して返します。代替案がある場合は alternatives に2件まで追加してください。',
  parameters: handoffResponseSchema,
  strict: true,
  async execute(input) {
    const parsed = handoffResponseSchema.parse(input);
    validateRecommendationPayload(parsed);
    return JSON.stringify(parsed);
  },
});

export async function POST(request: NextRequest) {
  if (!OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'Missing OPENAI_API_KEY' },
      { status: 500 },
    );
  }

  try {
    const body = await request.json();
    const parsed = handoffRequestSchema.parse(body);

    const handoffSummary = (parsed.handoff_summary ?? '').trim();
    const additionalContext = (parsed.additional_context ?? '').trim();
    const conversationLogRaw = parsed.conversation_log ?? '';
    const metadata = parsed.metadata ?? {};
    const traceGroupId = parsed.trace_group_id ?? undefined;
    const runId = parsed.run_id ?? `embed:${Date.now().toString(36)}`;

    const currentSake = parsed.current_sake ?? metadata?.current_sake ?? null;
    const preferenceNote = parsed.preference_note ?? metadata?.preference_note ?? null;
    const focus = parsed.focus ?? metadata?.focus ?? null;
    const includeAlternatives =
      typeof parsed.include_alternatives === 'boolean'
        ? parsed.include_alternatives
        : typeof metadata?.include_alternatives === 'boolean'
          ? metadata.include_alternatives
          : true;

    const metadataResult = metadata ?? {};
    const isGiftMode = metadataResult.gift_mode === true || parsed.mode === 'gift';

    publishProgress(runId, {
      type: 'status',
      label: '開始',
      message: '埋め込みテキストエージェントがリクエストを受領しました。',
    });

    const preferenceNarrative = (() => {
      if (!preferenceNote) return null;
      if (typeof preferenceNote !== 'string') return null;
      const trimmed = preferenceNote.trim();
      return trimmed.length > 0 ? trimmed : null;
    })();

    const focusMeta =
      typeof focus === 'string' && focus.trim().length > 0
        ? focus.trim()
        : null;

    const currentSakeNarrative =
      typeof currentSake === 'string'
        ? currentSake
        : currentSake && typeof currentSake === 'object'
          ? JSON.stringify(currentSake)
          : null;

    const giftBudgetMin = metadataResult.budget_min;
    const giftBudgetMax = metadataResult.budget_max;
    const recipientName = metadataResult.recipient_name;
    const occasion = metadataResult.occasion;

    const metadataExtras: Record<string, unknown> = { ...metadataResult };
    delete metadataExtras.include_alternatives;
    delete metadataExtras.focus;
    delete metadataExtras.notes;
    delete metadataExtras.preferences;
    delete metadataExtras.current_sake;
    delete metadataExtras.preference_note;
    delete metadataExtras.gift_mode;
    delete metadataExtras.budget_min;
    delete metadataExtras.budget_max;
    delete metadataExtras.recipient_name;
    delete metadataExtras.occasion;
    delete metadataExtras.conversation_log;
    const extrasNarrative = describeValue(metadataExtras);

    const openaiClient = new OpenAI({
      apiKey: OPENAI_API_KEY,
    });

    const model = new OpenAIResponsesModel(
      openaiClient as unknown as ConstructorParameters<typeof OpenAIResponsesModel>[0],
      TEXT_MODEL,
    );

    const allowedDomains =
      typeof EMBED_ALLOWED_DOMAINS === 'string' && EMBED_ALLOWED_DOMAINS.trim().length > 0
        ? EMBED_ALLOWED_DOMAINS.split(',')
            .map((d) => d.trim())
            .filter(Boolean)
        : ['www.echigo.sake-harasho.com'];

    const tools = [
      webSearchTool({
        filters: {
          allowedDomains: allowedDomains,
        },
        searchContextSize: 'medium',
        userLocation: {
          type: 'approximate',
          country: 'JP',
          timezone: 'Asia/Tokyo',
        },
      }),
      finalizeRecommendationTool,
    ];

    if (MCP_URL && MCP_TOKEN) {
      tools.unshift(
        hostedMcpTool({
          serverLabel: 'harashomcp',
          allowedTools: ['get_product_image_url'],
          headers: {
            Authorization: `Bearer ${MCP_TOKEN}`,
          },
          requireApproval: 'never',
          serverUrl: MCP_URL,
        }),
      );
    }

    const agent = new Agent({
      name: 'Sake Purchase Research Worker (Embed)',
      model,
      modelSettings: {
        reasoning: {
          effort: TEXT_AGENT_REASONING_EFFORT,
          summary: TEXT_AGENT_REASONING_SUMMARY,
        },
        text: {
          verbosity: TEXT_AGENT_VERBOSITY,
        },
      },
      outputType: finalPayloadInputSchema,
      tools,
      toolUseBehavior: {
        stopAtToolNames: ['finalize_recommendation'],
      },
      instructions: `
あなたは「越後銘門酒会」の埋め込み用テキストエージェントで、新潟の日本酒に特化したリサーチ担当です。
会話エージェントが聞き取った嗜好に沿って、信頼できる情報源から最適な銘柄と購入先をまとめて返してください。
機能・ツール・フローは既存の定義をそのまま使い、システムプロンプトだけを差し替えています。

### 使命
- 新潟を中心とした日本酒を優先的に推薦し、必要に応じて他地域も比較検討する
- 公式EC、正規代理店、百貨店、専門店など信頼性の高い販売サイトを優先し、価格・在庫・配送見込み・出典URLを明記する
- 情報は必ず複数ソースで裏取りし、根拠URLを "origin_sources" にまとめる
${isGiftMode ? `
### ギフトモード特別指示
このリクエストはギフト推薦です。以下の点に特に注意してください：
- 予算範囲: ${giftBudgetMin ? `${giftBudgetMin}円〜${giftBudgetMax}円` : '指定なし'}
${occasion ? `- 用途: ${occasion}` : ''}
${recipientName ? `- 贈る相手: ${recipientName}` : ''}
- ギフト包装が可能な販売店を優先する
- 高品質で贈答用に適した銘柄を選ぶ
- のし・メッセージカード対応などのギフトサービス情報も確認する
` : ''}

### スピード重視の進め方
- まずは必要条件を箇条書きで整理し、単一の \`web_search\` クエリで候補・販売先・最新価格をまとめて取得する。香り・価格帯・ペアリング用途・ギフト用途を1本の検索語に含めて複数候補を同時に集めること。
- 追加の \`web_search\` は情報が欠落している場合のみ最大1回まで行う（例: 最適候補の在庫が不明／価格が取得できない場合など）。無目的な再検索は禁止。
- 画像URLは販売ページや信頼できる資料に直接画像リンクがある場合のみ採用し、見つからない場合はもっとも信頼性の高い商品ページURLを一時的に \`image_url\` に入力する。サーバーが最終的に画像を抽出するため専用ツールを呼び出す必要はない。
- reasoning やメモは要点を簡潔にまとめ、冗長な重複説明は避ける。

### preference_map の作り方（必須）
- 軸は3〜6本。味・香り・ボディ感・酸味・キレ・熟成感・温度帯・ペアリング適性・希少性/人気度（ユーザーが話した場合のみ）など **具体的な嗜好軸** にする。  
- 「全体的な印象」「その他」といった抽象軸は禁止。意味が重複する軸も避ける。  
- level は 1〜5 の整数に丸める（1=全く好まない/弱い、3=普通、5=強く好む/強い）。  
- evidence に会話ログから拾った根拠を1行で書く。  
- summary には軸を1行で要約（例: 「華やかで甘口、冷酒好き」）。

### 手順
1. 必要に応じて \`web_search\` を呼び出し、候補となる日本酒・販売ページ・価格・在庫情報を取得する。${isGiftMode ? 'ギフト対応可能なショップを優先する。' : ''}
2. 検索結果から条件に最も合う銘柄を評価し、香味・造り・ペアリング・提供温度・価格帯を整理する。可能なら味わいを 1〜5 のスコアで "flavor_profile" に入れる。
3. 会話ログから読み取れる嗜好傾向を 3〜6 軸で \`preference_map\` にまとめる。軸ラベルは会話に沿って柔軟に命名し、\`level\` は 1〜5 の整数、\`evidence\` に根拠を1行で記載する。
4. 最低1件の販売先を確保（可能なら2件以上）。価格が数値化できない場合は "price_text" に表記し、在庫・配送目安を明示する。
5. 代替案が求められている場合は "alternatives" に2件まで優先度順で記載する（各項目は名前・1行コメント・URL・価格メモのみ。詳細なテイスティング情報やショップリストは不要）。

### 厳守事項
- \`finalize_recommendation\` を呼び出す時点で必要な販売先・価格・在庫情報は揃っている前提です。追加のヒアリングや確認質問を挟まず確定してください。
- \`follow_up_prompt\` は常に null。ユーザーへの追質問や再確認メッセージは書かないこと。
- フィールドを空文字やダミーURLで埋めるのは禁止です。取得できない値は null を使い、その理由を summary / reasoning に明記してください。

### 出力
- 最終的な回答は必ず一度だけ 'finalize_recommendation' を呼び出し、JSONを返す
- 定量情報が取れない場合は null を指定し、根拠文に明記する
- 'follow_up_prompt' は必ず null とし、追加の質問は絶対に含めない
- \`preference_map\` を必ず含め、axes は 3〜6 本・level は 1〜5 の整数に丸めること
    `.trim(),
    });

    const userQuery =
      handoffSummary.length > 0
        ? handoffSummary
        : 'ユーザーの嗜好に合う日本酒を提案し、購入可能なショップ情報（価格・在庫・配送目安）をまとめてください。';

    const contextSections: string[] = [];

    if (isGiftMode) {
      const giftContext: string[] = ['【ギフトモード】'];
      if (giftBudgetMin && giftBudgetMax) {
        giftContext.push(`予算: ${giftBudgetMin}円〜${giftBudgetMax}円`);
      }
      if (occasion) {
        giftContext.push(`用途: ${occasion}`);
      }
      if (recipientName) {
        giftContext.push(`贈る相手: ${recipientName}`);
      }
      giftContext.push('※ギフト包装・のし対応可能な販売店を優先してください');
      contextSections.push(giftContext.join('\n'));
    }

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
      ? '代替案: 主要な推薦に加え、最大2件まで名前＋ワンライナー＋URLで軽量に紹介してください。'
      : '代替案: 今回は主要な1本に集中し、代替候補は提示しないでください。';

    const guidanceSections = [includeAltInstruction, ...contextSections].filter(
      (section) => section && section.trim().length > 0,
    );
    if (conversationLogRaw) {
      guidanceSections.push(`会話ログ（全文）:\n${conversationLogRaw}`);
    }

    const guidanceBlock =
      guidanceSections.length > 0 ? guidanceSections.join('\n\n') : '';

    publishProgress(runId, {
      type: 'status',
      label: '検索キュー投入',
      message: 'テキストエージェントがリクエストを受領しました。',
    });

    const runner = new Runner({
      workflowName: 'Sakescope Text Agent Embed',
      groupId: typeof traceGroupId === 'string' && traceGroupId.length > 0 ? traceGroupId : undefined,
      traceMetadata: (() => {
        const metadata: Record<string, string> = {
          channel: 'text-embed',
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
        type: 'reasoning',
        label: '検索計画',
        message: guidanceBlock || '計画作成中…',
      });

      const streamResult = await runner.run(agent, runnerInput, {
        stream: true,
        maxTurns: 6,
      });

      // Consume stream to completion; progressイベントは現状省略
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _event of streamResult) {
      }

      await streamResult.completed;
      if (streamResult.error) {
        throw streamResult.error;
      }
      finalOutput = streamResult.finalOutput;

      const parsedResult = finalPayloadOutputSchema.parse(finalOutput);

      publishProgress(runId, {
        type: 'reasoning',
        label: '結果受信',
        message: 'テキストエージェントの結果を検証しています…',
      });

      validateRecommendationPayload(parsedResult);

      publishProgress(runId, {
        type: 'final',
        label: '完了',
        message: '推薦結果を返却しました。',
        data: parsedResult as Record<string, unknown>,
      });

      return NextResponse.json(parsedResult);
    } catch (error) {
      console.error('[Embed Text Worker] Error:', error);

      if (error instanceof InvalidRecommendationPayloadError) {
        publishProgress(runId, {
          type: 'error',
          label: 'バリデーションエラー',
          message: error.message,
        });
        return NextResponse.json(
          { error: error.message },
          { status: 400 },
        );
      }

      if (error instanceof z.ZodError) {
        publishProgress(runId, {
          type: 'error',
          label: '入力エラー',
          message: '入力データの形式が不正です',
        });
        return NextResponse.json(
          { error: 'Invalid input', details: error.issues },
          { status: 400 },
        );
      }

      publishProgress(runId, {
        type: 'error',
        label: '処理エラー',
        message:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred',
      });
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 },
      );
    } finally {
      clearProgress(runId);
    }
  } catch (error) {
    console.error('[Embed Text Worker] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 },
    );
  }
}
