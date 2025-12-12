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
  finalPayloadOutputSchema,
  finalPayloadSeedInputSchemaV2,
} from '@/server/textWorkerSchemas';
import { extractPrimaryImageUrl } from '@/server/extractPrimaryImageUrl';

export const runtime = 'nodejs';
export const maxDuration = 300;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TEXT_MODEL =
  process.env.OPENAI_TEXT_MODEL_EMBED ?? 'gpt-5-mini';
const MCP_URL = process.env.TEXT_EMBED_MCP_URL;
const MCP_TOKEN = process.env.TEXT_EMBED_MCP_TOKEN;

const REASONING_EFFORT_LEVELS = ['minimal', 'low', 'medium', 'high'] as const;
type ReasoningEffortLevel = (typeof REASONING_EFFORT_LEVELS)[number];
const REASONING_SUMMARY_LEVELS = ['auto', 'concise', 'detailed'] as const;
type ReasoningSummaryLevel = (typeof REASONING_SUMMARY_LEVELS)[number];
const VERBOSITY_LEVELS = ['low', 'medium', 'high'] as const;
type VerbosityLevel = (typeof VERBOSITY_LEVELS)[number];

const HTTP_URL_PATTERN = /^https?:\/\/\S+/i;

const EMBED_MAX_TURNS_RAW = Number.parseInt(
  process.env.TEXT_AGENT_MAX_TURNS_EMBED ?? '4',
  10,
);
const TEXT_AGENT_MAX_TURNS_EMBED = Number.isFinite(EMBED_MAX_TURNS_RAW)
  ? Math.min(Math.max(EMBED_MAX_TURNS_RAW, 2), 6)
  : 4;
const SEARCH_CONTEXT_SIZE_EMBED = (process.env
  .TEXT_AGENT_SEARCH_CONTEXT_SIZE_EMBED ?? 'low') as
  | 'low'
  | 'medium'
  | 'high';

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

async function isMcpReachable(url: string, token: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    });
    if (res.status === 401 || res.status === 403) {
      return false;
    }
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

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

// -------------------------------------------------------------
// v2 seed -> v1 payload enrichment (embed mode only)
// -------------------------------------------------------------

const DEFAULT_IMAGE_URL =
  'https://dummyimage.com/480x640/1f2937/ffffff&text=Sake';

const imageExtractionCache = new Map<string, string | null>();
const offerHtmlCache = new Map<string, string | null>();

const toTrimmed = (value: unknown): string | null =>
  typeof value === 'string' ? value.trim() || null : null;

const isLikelyImageUrl = (url: string): boolean => {
  if (/\.(jpg|jpeg|png|webp|gif|svg|bmp|ico)(\?.*)?$/i.test(url)) {
    return true;
  }
  if (/\.(html?|php|asp|jsp)(\?.*)?$/i.test(url)) {
    return false;
  }
  if (
    /\/cdn\/|cloudinary|imgix|cloudflare|amazonaws\.com\/.*\/(images?|photos?)/i.test(
      url,
    )
  ) {
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

const resolveImageFromPage = async (
  pageUrl: string,
): Promise<string | null> => {
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

  if (
    rawImageUrl &&
    isLikelyImageUrl(rawImageUrl) &&
    HTTP_URL_PATTERN.test(rawImageUrl)
  ) {
    sake.image_url = rawImageUrl;
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
  await ensureRecommendationImage(payload as Record<string, unknown>);
};

type FinalPayloadSeedInputV2 = z.infer<typeof finalPayloadSeedInputSchemaV2>;
type OfferSeedV2 = FinalPayloadSeedInputV2['offers'][number];
type FactV2 = FinalPayloadSeedInputV2['sake']['facts'][number];

const inferRetailerFromUrl = (urlText: string): string => {
  try {
    const { hostname } = new URL(urlText);
    return hostname.replace(/^www\./, '');
  } catch {
    return 'shop';
  }
};

const PRICE_PATTERNS: RegExp[] = [
  /(?:¥|￥)\s?([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{3,7})/g,
  /([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{3,7})\s?円/g,
];
const MIN_PRICE_YEN = 500;
const MAX_PRICE_YEN = 200000;

const extractYenPrices = (html: string): number[] => {
  const prices: number[] = [];
  for (const basePattern of PRICE_PATTERNS) {
    const pattern = new RegExp(basePattern.source, basePattern.flags);
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html)) !== null) {
      const raw = match[1] ?? '';
      const num = Number.parseInt(raw.replace(/,/g, ''), 10);
      if (
        Number.isFinite(num) &&
        num >= MIN_PRICE_YEN &&
        num <= MAX_PRICE_YEN
      ) {
        prices.push(num);
      }
    }
  }
  return prices;
};

const detectStockFromHtml = (
  html: string,
): OfferSeedV2['stock'] => {
  if (/在庫切れ|品切れ|sold out|売り切れ/i.test(html)) {
    return 'out_of_stock';
  }
  if (/在庫あり|在庫有り|in stock|販売中/i.test(html)) {
    return 'in_stock';
  }
  return 'unknown';
};

const fetchOfferHtml = async (urlText: string): Promise<string | null> => {
  if (!urlText || !HTTP_URL_PATTERN.test(urlText)) {
    return null;
  }
  if (offerHtmlCache.has(urlText)) {
    return offerHtmlCache.get(urlText) ?? null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const res = await fetch(urlText, {
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      offerHtmlCache.set(urlText, null);
      return null;
    }
    const contentType = res.headers.get('content-type');
    if (contentType && !contentType.includes('text/html')) {
      offerHtmlCache.set(urlText, null);
      return null;
    }
    const html = await res.text();
    offerHtmlCache.set(urlText, html);
    return html;
  } catch {
    offerHtmlCache.set(urlText, null);
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

const enrichOfferSeed = async (
  offer: OfferSeedV2,
): Promise<{
  price: number | null;
  priceText: string | null;
  availability: string | null;
  eta: string | null;
  stock: OfferSeedV2['stock'];
}> => {
  let priceText = toTrimmed(offer.price_text);
  let price: number | null = null;
  let stock = offer.stock;
  const eta = toTrimmed(offer.eta);

  if (!priceText) {
    const html = await fetchOfferHtml(offer.url);
    if (html) {
      const candidates = extractYenPrices(html);
      if (candidates.length > 0) {
        candidates.sort((a, b) => a - b);
        price = candidates[0];
        priceText = `¥${candidates[0].toLocaleString()}`;
      }
      if (stock === 'unknown') {
        stock = detectStockFromHtml(html);
      }
    }
  }

  const availability =
    stock === 'in_stock'
      ? '在庫あり'
      : stock === 'out_of_stock'
        ? '在庫切れ'
        : null;

  if (!priceText) {
    priceText = '価格は商品ページをご確認ください';
  }

  return { price, priceText, availability, eta, stock };
};

const pickFactValue = (
  facts: FactV2[],
  matcher: RegExp,
): string | null => {
  for (const fact of facts) {
    if (matcher.test(fact.k)) {
      const trimmed = fact.v.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }
  return null;
};

const enrichSeedToFinalPayload = async (
  seed: FinalPayloadSeedInputV2,
): Promise<Record<string, unknown>> => {
  const facts = Array.isArray(seed.sake.facts) ? seed.sake.facts : [];

  const brewery = pickFactValue(facts, /蔵元|酒蔵|brewery/i);
  const region = pickFactValue(facts, /地域|産地|県|region/i);
  const type = pickFactValue(facts, /種類|タイプ|特定名称|type/i);
  const priceRange = pickFactValue(facts, /価格帯|price/i);

  const sourceCandidates: unknown[] = [
    seed.sake.product_url,
    ...seed.sources,
    ...facts.map((fact) => fact.source_url),
  ];
  const originSources = uniqueStrings(sourceCandidates);

  const imageCandidate =
    toTrimmed(seed.sake.image_url) ??
    toTrimmed(seed.sake.product_url) ??
    toTrimmed(seed.offers[0]?.url) ??
    DEFAULT_IMAGE_URL;

  const shops = (
    await Promise.all(
      seed.offers.map(async (offer) => {
        const enriched = await enrichOfferSeed(offer);
        return {
          retailer: inferRetailerFromUrl(offer.url),
          url: offer.url,
          price: enriched.price,
          price_text: enriched.priceText,
          currency: null,
          availability: enriched.availability,
          delivery_estimate: enriched.eta,
          source: null,
          notes:
            enriched.stock === 'unknown'
              ? null
              : `在庫ステータス: ${enriched.stock}`,
        };
      }),
    )
  ).filter((shop) => shop && typeof shop.url === 'string');

  return {
    sake: {
      id: null,
      name: seed.sake.name,
      brewery: brewery ?? null,
      region: region ?? null,
      type: type ?? null,
      alcohol: null,
      sake_value: null,
      acidity: null,
      description: null,
      tasting_notes: null,
      food_pairing: null,
      serving_temperature: null,
      image_url: imageCandidate,
      origin_sources: originSources.length > 0 ? originSources : null,
      price_range: priceRange ?? null,
      flavor_profile: null,
    },
    summary: seed.summary,
    reasoning: seed.reasons.join('\n'),
    tasting_highlights: null,
    serving_suggestions: null,
    shops: shops.length > 0 ? shops : [],
    preference_map: null,
    alternatives: null,
    follow_up_prompt: null,
  };
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

const handoffSeedSchema = finalPayloadSeedInputSchemaV2;

const finalizeRecommendationTool = tool({
  name: 'finalize_recommendation',
  description:
    '候補を1本に絞り、推薦の要点と購入リンクを最小限のJSONとして確定します。価格・在庫・画像などはサーバー側で補完します。',
  parameters: handoffSeedSchema,
  strict: true,
  async execute(input) {
    return handoffSeedSchema.parse(input);
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
    const includeAlternatives = false;

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

    const buildMcpTool = () =>
      hostedMcpTool({
        serverLabel: 'harashomcp',
        allowedTools: ['get_product_image_url'],
        headers: {
          Authorization: `Bearer ${MCP_TOKEN}`,
        },
        requireApproval: 'never',
        serverUrl: MCP_URL!,
      });

    const buildRestrictedSearchTool = () =>
      webSearchTool({
        filters: {
          allowedDomains: ['www.echigo.sake-harasho.com'],
        },
        searchContextSize: SEARCH_CONTEXT_SIZE_EMBED,
        userLocation: {
          type: 'approximate',
          country: 'JP',
          timezone: 'Asia/Tokyo',
        },
      });

    const buildUnrestrictedSearchTool = () =>
      webSearchTool({
        searchContextSize: SEARCH_CONTEXT_SIZE_EMBED,
        userLocation: {
          type: 'approximate',
          country: 'JP',
          timezone: 'Asia/Tokyo',
        },
      });

    const tools = [buildRestrictedSearchTool(), finalizeRecommendationTool];

    let mcpEnabled = false;
    if (MCP_URL && MCP_TOKEN) {
      const reachable = await isMcpReachable(MCP_URL, MCP_TOKEN);
      if (reachable) {
        mcpEnabled = true;
        tools.unshift(buildMcpTool());
      } else {
        console.warn(
          '[EmbedTextWorker] MCP server unreachable or unauthorized; falling back to web_search only.',
        );
      }
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
      outputType: handoffSeedSchema,
      tools,
      toolUseBehavior: {
        stopAtToolNames: ['finalize_recommendation'],
      },
      instructions: `
あなたは「越後銘門酒会」の埋め込み用テキストリサーチ担当です。会話エージェントが聞き取った嗜好に沿って、新潟の日本酒を中心に最適な1本と購入ページを特定し、最小限の推薦seedを返してください。

### 使命
- 新潟を中心とした日本酒を優先し、必要なら他地域も比較して最適を選ぶ
- 販売サイト越後銘門酒会の公式ECで購入できる商品URLを必ず特定する。URLは[https://www.echigo.sake-harasho.com/view/item/xxxxxx]のような形式であることが多い。blog形式のコラムもあり、参考情報に使ってもいいが必ずストアのページは見つけること。
- 根拠となるURLは "sources" に最大3件までまとめる
${isGiftMode ? `
### ギフトモード特別指示
このリクエストはギフト推薦です。以下の点に注意してください：
- 予算範囲: ${giftBudgetMin ? `${giftBudgetMin}円〜${giftBudgetMax}円` : '指定なし'}
${occasion ? `- 用途: ${occasion}` : ''}
${recipientName ? `- 贈る相手: ${recipientName}` : ''}
- ギフト包装が可能な販売店を優先する
` : ''}

### スピード重視
- web_search はまず1回でまとめて調査し、必要なら追加1回まで
- 価格・在庫・配送・画像は不明なら null / unknown で構いません（サーバー側で補完します）
- sake.name と offers[].url は必須。空欄のまま finalize_recommendation を呼び出さないこと

### facts の書き方
- 確実に分かったスペックや特徴だけを facts に追加する（例: 蔵元, 地域, 酒米, 精米歩合, 味わいメモ）
- 分からない項目は入れない。facts は空配列でもOK

### 出力
- 最終回答は必ず一度だけ finalize_recommendation を呼び出し、v2 seed JSON を返す
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

    const guidanceSections = [
      '代替案: 今回は主要な1本に集中し、代替候補は提示しないでください。',
      ...contextSections,
    ].filter(
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
        maxTurns: TEXT_AGENT_MAX_TURNS_EMBED,
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

      publishProgress(runId, {
        type: 'reasoning',
        label: '結果受信',
        message: 'テキストエージェントのseedを受信しました。補完処理を行います…',
      });

      const buildFinalPayloadFromSeed = async (
        seed: FinalPayloadSeedInputV2,
      ): Promise<FinalRecommendationPayload> => {
        const enriched = await enrichSeedToFinalPayload(seed);
        await ensurePayloadImages(enriched);
        return finalPayloadOutputSchema.parse(enriched);
      };

      let seedResult = handoffSeedSchema.parse(finalOutput);
      let parsedResult = await buildFinalPayloadFromSeed(seedResult);

      try {
        validateRecommendationPayload(parsedResult);
      } catch (validationError) {
        const needsRetry =
          validationError instanceof InvalidRecommendationPayloadError &&
          validationError.message.includes('sake.name');

        if (!needsRetry) {
          throw validationError;
        }

        publishProgress(runId, {
          type: 'status',
          label: '再検索',
          message:
            'ストア内で銘柄が特定できなかったため、情報源を広げて再検索しています…',
        });

        const fallbackTools = [
          ...(mcpEnabled ? [buildMcpTool()] : []),
          buildUnrestrictedSearchTool(),
          finalizeRecommendationTool,
        ];

        const fallbackAgent = new Agent({
          name: 'Sake Purchase Research Worker (Embed Fallback)',
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
          outputType: handoffSeedSchema,
          tools: fallbackTools,
          toolUseBehavior: {
            stopAtToolNames: ['finalize_recommendation'],
          },
          instructions: `${agent.instructions}\n\n【重要】前回の出力で sake.name が空欄でした。銘柄名と購入ページを必ず特定し、sake.name と offers[].url を埋めて finalize_recommendation を呼び出してください。ドメイン制限は気にせず、信頼できる販売サイトから情報を取得して構いません。`,
        });

        const retryInput = `${runnerInput}\n\n【修正依頼】sake.name が空欄でした。必須フィールドを埋めて再出力してください。`;
        const retryResult = await runner.run(fallbackAgent, retryInput, {
          stream: false,
          maxTurns: Math.max(2, TEXT_AGENT_MAX_TURNS_EMBED - 1),
        });
        seedResult = handoffSeedSchema.parse(retryResult.finalOutput);
        parsedResult = await buildFinalPayloadFromSeed(seedResult);
        validateRecommendationPayload(parsedResult);
      }

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
