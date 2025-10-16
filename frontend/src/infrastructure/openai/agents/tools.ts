import { tool } from '@openai/agents/realtime';
import type { RunContext } from '@openai/agents-core';
import { z } from 'zod';
import {
  PurchaseOffer,
  Sake,
  ShopListing,
} from '@/domain/sake/types';
import type {
  AgentRuntimeContext,
  AgentUserPreferences,
} from './context';

type RuntimeRunContext = RunContext<{
  history: unknown[];
} & AgentRuntimeContext>;

function getRuntimeContext(runContext?: RuntimeRunContext): AgentRuntimeContext {
  const ctx = runContext?.context;
  if (!ctx) {
    throw new Error('Runtime context is not available for the agent tool.');
  }
  return ctx;
}

const shopListingSchema = z.object({
  retailer: z.string(),
  url: z.string(),
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

const sakePayloadSchema = z.object({
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
  image_url: z.string().nullable(),
  origin_sources: z.array(z.string()).nullable(),
  price_range: z.string().nullable(),
  flavor_profile: flavorProfileSchema,
});

type SakePayload = z.infer<typeof sakePayloadSchema>;

function mapSakePayload(payload: SakePayload): Sake {
  return {
    id: payload.id ?? undefined,
    name: payload.name,
    brewery: payload.brewery ?? undefined,
    region: payload.region ?? undefined,
    type: payload.type ?? undefined,
    alcohol: payload.alcohol ?? undefined,
    sakeValue: payload.sake_value ?? undefined,
    acidity: payload.acidity ?? undefined,
    description: payload.description ?? undefined,
    tastingNotes: payload.tasting_notes ?? undefined,
    foodPairing: payload.food_pairing ?? undefined,
    servingTemperature: payload.serving_temperature ?? undefined,
    imageUrl: payload.image_url ?? undefined,
    originSources: payload.origin_sources ?? undefined,
    priceRange: payload.price_range ?? undefined,
    flavorProfile: payload.flavor_profile
      ? {
          sweetness: payload.flavor_profile.sweetness ?? undefined,
          lightness: payload.flavor_profile.lightness ?? undefined,
          complexity: payload.flavor_profile.complexity ?? undefined,
          fruitiness: payload.flavor_profile.fruitiness ?? undefined,
        }
      : undefined,
  };
}

const recommendationPayloadSchema = z.object({
  sake: sakePayloadSchema,
  summary: z.string(),
  reasoning: z.string(),
  tasting_highlights: z.array(z.string()).nullable(),
  serving_suggestions: z.array(z.string()).nullable(),
  shops: z.array(shopListingSchema).min(1),
});

const agentResponseSchema = recommendationPayloadSchema.extend({
  alternatives: z.array(recommendationPayloadSchema).nullable(),
  follow_up_prompt: z.string().nullable(),
});

export const submitPurchaseRecommendationTool = tool({
  name: 'submit_purchase_recommendation',
  description:
    'テキストエージェントが調査した結果をUIに反映します。必ず最新の購入候補と日本酒情報を含めてください。',
  parameters: agentResponseSchema,
  strict: true,
  async execute(input, runContext): Promise<string> {
    const ctx = getRuntimeContext(runContext as RuntimeRunContext);
    const parsed = agentResponseSchema.parse(input);

    const sake = mapSakePayload(parsed.sake);
    const shops: ShopListing[] = parsed.shops.map((shop) => ({
      retailer: shop.retailer,
      url: shop.url,
      price: shop.price ?? undefined,
      priceText: shop.price_text ?? undefined,
      currency: shop.currency ?? undefined,
      availability: shop.availability ?? undefined,
      deliveryEstimate: shop.delivery_estimate ?? undefined,
      source: shop.source ?? undefined,
      notes: shop.notes ?? undefined,
    }));

    const offer: PurchaseOffer = {
      sake,
      summary: parsed.summary,
      reasoning: parsed.reasoning,
      tastingHighlights: parsed.tasting_highlights ?? undefined,
      servingSuggestions: parsed.serving_suggestions ?? undefined,
      shops,
      updatedAt: new Date().toISOString(),
      followUpPrompt: parsed.follow_up_prompt ?? undefined,
      alternatives: parsed.alternatives
        ? parsed.alternatives.map((alt) => ({
            sake: mapSakePayload(alt.sake),
            summary: alt.summary,
            reasoning: alt.reasoning,
            shops: alt.shops.map((shop) => ({
              retailer: shop.retailer,
              url: shop.url,
              price: shop.price ?? undefined,
              priceText: shop.price_text ?? undefined,
              currency: shop.currency ?? undefined,
              availability: shop.availability ?? undefined,
              deliveryEstimate: shop.delivery_estimate ?? undefined,
              source: shop.source ?? undefined,
              notes: shop.notes ?? undefined,
            })),
            tastingHighlights: alt.tasting_highlights ?? undefined,
            servingSuggestions: alt.serving_suggestions ?? undefined,
          }))
        : undefined,
    };

    ctx.session.currentSake = offer.sake;
    ctx.callbacks.onSakeProfile?.(offer.sake);
    ctx.callbacks.onShopsUpdated?.(shops);
    ctx.callbacks.onOfferReady?.(offer);

    return JSON.stringify({
      status: 'submitted',
      shopCount: shops.length,
      hasAlternatives: Boolean(offer.alternatives?.length),
    });
  },
});

const metadataPreferencesSchema = z
  .union([
    z.string(),
    z.array(z.string()),
    z
      .object({
        flavor_preference: z.string().nullable().optional(),
        body_preference: z.string().nullable().optional(),
        price_range: z.string().nullable().optional(),
        food_pairing: z.array(z.string()).nullable().optional(),
        notes: z.string().nullable().optional(),
      })
      .partial(),
  ])
  .nullable()
  .optional();

const metadataCurrentSakeSchema = z
  .object({
    id: z.string().nullable().optional(),
    name: z.string().nullable().optional(),
    brewery: z.string().nullable().optional(),
    region: z.string().nullable().optional(),
    type: z.string().nullable().optional(),
    alcohol: z.number().nullable().optional(),
    notes: z.string().nullable().optional(),
  })
  .partial();

const handoffMetadataSchema = z
  .object({
    preferences: metadataPreferencesSchema,
    include_alternatives: z.boolean().nullable().optional(),
    focus: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    preference_note: z.string().nullable().optional(),
    conversation_context: z.string().nullable().optional(),
    current_sake: metadataCurrentSakeSchema.nullable().optional(),
  })
  .catchall(z.unknown())
  .nullable()
  .optional();

const preferenceKeyLabels: Record<string, string> = {
  flavor_preference: '味わい',
  flavorPreference: '味わい',
  flavor: '味わい',
  taste: '味わい',
  body_preference: 'ボディ',
  bodyPreference: 'ボディ',
  body: 'ボディ',
  price_range: '価格帯',
  priceRange: '価格帯',
  budget: '価格帯',
  food_pairing: '料理',
  foodPairing: '料理',
  pairing: '料理',
  food: '料理',
  notes: 'メモ',
  memo: 'メモ',
  comment: 'メモ',
};

const toCleanString = (value: unknown): string | null =>
  typeof value === 'string' ? (value.trim().length > 0 ? value.trim() : null) : null;

function formatPreferenceHint(
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
      .map((item) => formatPreferenceHint(item, tracker))
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
        const described = formatPreferenceHint(val, tracker);
        if (!described) {
          return null;
        }
        const label =
          preferenceKeyLabels[key] ?? key.replace(/[_]/g, ' ');
        return `${label}: ${described}`;
      })
      .filter((entry): entry is string => Boolean(entry));
    return entries.length > 0 ? entries.join('、 ') : null;
  }

  return String(value);
}

function normalizePreferenceRecord(
  value: unknown,
): AgentUserPreferences | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const source = value as Record<string, unknown>;
  const result: AgentUserPreferences = {};

  const extractString = (...keys: string[]): string | null => {
    for (const key of keys) {
      const raw = source[key];
      if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (trimmed.length > 0) {
          return trimmed;
        }
      }
    }
    return null;
  };

  const flavor = extractString('flavor_preference', 'flavorPreference', 'flavor', 'taste');
  if (flavor) {
    result.flavorPreference = flavor;
  }

  const body = extractString('body_preference', 'bodyPreference', 'body');
  if (body) {
    result.bodyPreference = body;
  }

  const price = extractString('price_range', 'priceRange', 'budget');
  if (price) {
    result.priceRange = price;
  }

  const notesRaw = extractString('notes', 'memo', 'comment');
  if (notesRaw) {
    result.notes = notesRaw;
  }

  const foodRaw =
    source.food_pairing ??
    source.foodPairing ??
    source.pairing ??
    source.food ??
    null;
  if (Array.isArray(foodRaw)) {
    const foods = foodRaw
      .map((item) => (typeof item === 'string' ? item.trim() : null))
      .filter((item): item is string => Boolean(item));
    if (foods.length > 0) {
      result.foodPairing = foods;
    }
  } else if (typeof foodRaw === 'string') {
    const foods = foodRaw
      .split(/[、,／\/]/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (foods.length > 0) {
      result.foodPairing = foods;
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

function buildProfileHint(
  profile?: AgentUserPreferences | null,
): string | null {
  if (!profile) {
    return null;
  }

  const payload: Record<string, unknown> = {};
  if (profile.flavorPreference) {
    payload.flavorPreference = profile.flavorPreference;
  }
  if (profile.bodyPreference) {
    payload.bodyPreference = profile.bodyPreference;
  }
  if (profile.priceRange) {
    payload.priceRange = profile.priceRange;
  }
  if (profile.foodPairing?.length) {
    payload.foodPairing = profile.foodPairing;
  }
  if (profile.notes) {
    payload.notes = profile.notes;
  }

  return formatPreferenceHint(payload);
}
export const delegateToSakeAgentTool = tool({
  name: 'delegate_to_sake_agent',
  description:
    'ヒアリング内容を自然言語でまとめてテキストエージェントへ渡し、最新の推薦と購入候補を取得します。購入や在庫に関する要望が出たときも迷わず呼び出してください。',
  parameters: z.object({
    handoff_summary: z
      .string()
      .min(1)
      .describe('ユーザーの要望・嗜好・条件を自然言語でまとめた短い文章'),
    additional_context: z
      .string()
      .nullable()
      .optional()
      .describe('補足の会話内容や背景があれば追記してください'),
    preference_note: z
      .string()
      .nullable()
      .optional()
      .describe('嗜好やこだわりを自然文でまとめてください'),
    include_alternatives: z.boolean().nullable().optional(),
    focus: z.string().nullable().optional(),
    conversation_context: z.string().nullable().optional(),
    metadata: handoffMetadataSchema.optional(),
  }),
  strict: true,
  async execute(input, runContext): Promise<string> {
    const ctx = getRuntimeContext(runContext as RuntimeRunContext);

    const metadata = input.metadata ?? null;
    const metadataPreferences = metadata?.preferences;

    const normalizedProfile = normalizePreferenceRecord(metadataPreferences);
    if (normalizedProfile) {
      ctx.session.userPreferences = {
        ...ctx.session.userPreferences,
        ...normalizedProfile,
      };
    }

    const effectiveProfile = ctx.session.userPreferences;
    const includeAlternatives =
      typeof input.include_alternatives === 'boolean'
        ? input.include_alternatives
        : typeof metadata?.include_alternatives === 'boolean'
          ? metadata.include_alternatives
          : true;
    const focus =
      toCleanString(input.focus) ?? toCleanString(metadata?.focus);
    const conversationContext =
      toCleanString(input.conversation_context) ??
      toCleanString(metadata?.conversation_context);
    const notes = toCleanString(metadata?.notes);

    ctx.callbacks.onShopsUpdated?.([]);

    try {
      const summary = input.handoff_summary.trim();
      ctx.session.lastQuery = summary;

      const currentSakePayload =
        metadata?.current_sake ??
        (ctx.session.currentSake
          ? {
              id: ctx.session.currentSake.id ?? null,
              name: ctx.session.currentSake.name ?? null,
              brewery: ctx.session.currentSake.brewery ?? null,
              region: ctx.session.currentSake.region ?? null,
              type: ctx.session.currentSake.type ?? null,
              alcohol:
                typeof ctx.session.currentSake.alcohol === 'number'
                  ? ctx.session.currentSake.alcohol
                  : null,
              notes: toCleanString(ctx.session.currentSake.description),
            }
          : null);

      const preferenceHints = new Set<string>();
      const addHint = (value: unknown) => {
        const text = formatPreferenceHint(value);
        if (text) {
          preferenceHints.add(text);
        }
      };

      addHint(input.preference_note);
      addHint(metadata?.preference_note);
      addHint(metadataPreferences);
      const profileHint = buildProfileHint(effectiveProfile);
      if (profileHint) {
        preferenceHints.add(profileHint);
      }

      const preferenceNote =
        preferenceHints.size > 0
          ? Array.from(preferenceHints).join(' / ')
          : null;

      const metadataPayload: Record<string, unknown> = {};
      if (notes) {
        metadataPayload.notes = notes;
      }
      const metadataPreferenceText = formatPreferenceHint(metadataPreferences);
      if (metadataPreferenceText) {
        metadataPayload.preferences = metadataPreferenceText;
      }
      const cleanMetadataPreferenceNote = toCleanString(
        metadata?.preference_note,
      );
      if (cleanMetadataPreferenceNote) {
        metadataPayload.preference_note = cleanMetadataPreferenceNote;
      }
      if (conversationContext) {
        metadataPayload.conversation_context = conversationContext;
      }
      if (currentSakePayload) {
        metadataPayload.current_sake = currentSakePayload;
      }
      if (preferenceNote) {
        const existing = toCleanString(metadataPayload.preference_note);
        metadataPayload.preference_note = existing
          ? `${existing} / ${preferenceNote}`
          : preferenceNote;
      }

      const requestBody: Record<string, unknown> = {
        handoff_summary: summary,
        trace_group_id: ctx.session.traceGroupId ?? null,
      };

      const additionalContext = toCleanString(input.additional_context);
      if (additionalContext) {
        requestBody.additional_context = additionalContext;
      }
      if (conversationContext) {
        requestBody.conversation_context = conversationContext;
      }
      if (preferenceNote) {
        requestBody.preference_note = preferenceNote;
      }
      if (typeof includeAlternatives === 'boolean') {
        requestBody.include_alternatives = includeAlternatives;
      }
      if (focus) {
        requestBody.focus = focus;
      }
      if (currentSakePayload) {
        requestBody.current_sake = currentSakePayload;
      }
      if (Object.keys(metadataPayload).length > 0) {
        requestBody.metadata = metadataPayload;
      }

      const response = await fetch('/api/text-worker', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorPayload = await response.text();
        ctx.callbacks.onError?.(
          errorPayload || `Text worker request failed (${response.status})`,
        );
        return JSON.stringify({
          status: 'error',
          message: errorPayload,
        });
      }

      const rawPayload = await response.json();
      const parsedPayload = agentResponseSchema.parse(rawPayload);

      await submitPurchaseRecommendationTool.execute(parsedPayload, runContext);

      return JSON.stringify({
        status: 'ok',
        shopCount: parsedPayload.shops.length,
        hasAlternatives: Boolean(parsedPayload.alternatives?.length),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred';
      ctx.callbacks.onError?.(message);
      return JSON.stringify({ status: 'error', message });
    }
  },
});
