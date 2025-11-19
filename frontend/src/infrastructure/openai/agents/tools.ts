import { tool } from '@openai/agents/realtime';
import type { RunContext } from '@openai/agents-core';
import { z } from 'zod';
import {
  PurchaseOffer,
  Sake,
  ShopListing,
} from '@/domain/sake/types';
import type { IntakeSummary } from '@/types/gift';
import type { TextWorkerProgressEvent } from '@/types/textWorker';
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
  // NOTE: ツール parameters に `format` 指定は不可。URL 検証は実行時に行う。
  image_url: z.string().min(1).describe('Absolute HTTP(S) URL'),
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
    imageUrl: payload.image_url,
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

const alternativeSuggestionSchema = z.object({
  name: z.string(),
  highlight: z.string().nullable(),
  url: z.string().min(1).nullable(),
  price_text: z.string().nullable(),
  notes: z.string().nullable(),
});

const agentResponseSchema = recommendationPayloadSchema.extend({
  alternatives: z.array(alternativeSuggestionSchema).max(2).nullable(),
  follow_up_prompt: z.string().nullable(),
});

type AgentResponse = z.infer<typeof agentResponseSchema>;

const giftIntakeSummarySchema = z
  .object({
    aroma: z.array(z.string()).nullable().optional(),
    taste_profile: z.array(z.string()).nullable().optional(),
    sweetness_dryness: z.string().nullable().optional(),
    temperature_preference: z.array(z.string()).nullable().optional(),
    food_pairing: z.array(z.string()).nullable().optional(),
    drinking_frequency: z.string().nullable().optional(),
    region_preference: z.array(z.string()).nullable().optional(),
    notes: z.string().nullable().optional(),
  })
  .nullable()
  .optional();

const completeGiftIntakeSchema = z.object({
  summary: z.string().min(1),
  intake: giftIntakeSummarySchema,
  additional_notes: z.string().nullable().optional(),
});

export const completeGiftIntakeTool = tool({
  name: 'complete_gift_intake',
  description:
    'ギフト用の聞き取りが完了したら、集めた情報をまとめてハンドオフします。予算は含めず、味わい・香り・温度・ペアリングなどを整理してください。',
  parameters: completeGiftIntakeSchema,
  strict: true,
  async execute(input, runContext): Promise<string> {
    const ctx = getRuntimeContext(runContext as RuntimeRunContext);
    const giftSession = ctx.session.gift;

    if (!giftSession?.giftId || !giftSession?.sessionId) {
      throw new Error('Gift session metadata is not configured.');
    }

    const payload: Record<string, unknown> = {
      sessionId: giftSession.sessionId,
      intakeSummary: input.intake ?? null,
      handoffSummary: input.summary,
    };

    if (input.additional_notes) {
      payload.additionalNotes = input.additional_notes;
    }

    try {
      const response = await fetch(
        `/api/gift/${giftSession.giftId}/trigger-handoff`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        const message =
          errorText || `Gift handoff failed (${response.status})`;
        ctx.callbacks.onError?.(message);
        throw new Error(message);
      }

      ctx.session.gift = {
        ...giftSession,
        status: 'handed_off',
      };

      ctx.callbacks.onGiftIntakeCompleted?.({
        giftId: giftSession.giftId,
        sessionId: giftSession.sessionId,
        summary: input.summary,
        intakeSummary: (input.intake ?? null) as IntakeSummary | null,
      });

      return JSON.stringify({
        status: 'handed_off',
        gift_id: giftSession.giftId,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Gift handoff failed';
      ctx.callbacks.onError?.(message);
      throw error;
    }
  },
});

async function handleRecommendationSubmission(
  parsed: AgentResponse,
  runContext: RuntimeRunContext,
): Promise<{ status: 'submitted'; shopCount: number; hasAlternatives: boolean }> {
  const ctx = getRuntimeContext(runContext);

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
          name: alt.name,
          highlight: alt.highlight ?? undefined,
          url: alt.url ?? undefined,
          priceText: alt.price_text ?? undefined,
          notes: alt.notes ?? undefined,
        }))
      : undefined,
  };

  ctx.session.currentSake = offer.sake;
  ctx.callbacks.onSakeProfile?.(offer.sake);
  ctx.callbacks.onShopsUpdated?.(shops);
  ctx.callbacks.onOfferReady?.(offer);

  return {
    status: 'submitted',
    shopCount: shops.length,
    hasAlternatives: Boolean(offer.alternatives?.length),
  };
}

export const submitPurchaseRecommendationTool = tool({
  name: 'submit_purchase_recommendation',
  description:
    'テキストエージェントが調査した結果をUIに反映します。必ず最新の購入候補と日本酒情報を含めてください。',
  parameters: agentResponseSchema,
  strict: true,
  async execute(input, runContext): Promise<string> {
    const parsed = agentResponseSchema.parse(input);
    const result = await handleRecommendationSubmission(
      parsed,
      runContext as RuntimeRunContext,
    );
    return JSON.stringify(result);
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
export const recommendSakeTool = tool({
  name: 'recommend_sake',
  description:
    '雑談で引き出した要望をまとめてテキストエージェントに渡し、日本酒の推薦JSONを取得します。購入や在庫の確認もこのツールを使ってください。',
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

    const emitProgress = (
      event: Omit<TextWorkerProgressEvent, 'timestamp'> & { timestamp?: string },
    ) => {
      ctx.callbacks.onProgressEvent?.({
        ...event,
        timestamp: event.timestamp ?? new Date().toISOString(),
      });
    };

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

    let eventSource: EventSource | null = null;

    try {
      const summary = input.handoff_summary.trim();
      ctx.session.lastQuery = summary;
      const runId = `${
        ctx.session.traceGroupId ?? 'trace'
      }:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      ctx.session.lastDelegationRunId = runId;

      emitProgress({
        type: 'status',
        label: 'テキスト調査',
        message: 'テキストエージェントに購入調査を依頼しました。',
      });

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
        run_id: runId,
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

      if (typeof window !== 'undefined' && typeof EventSource !== 'undefined') {
        try {
          const progressUrl = `/api/text-worker/progress?run=${encodeURIComponent(runId)}`;
          eventSource = new EventSource(progressUrl);
          eventSource.onmessage = (event) => {
            try {
              const payload = JSON.parse(event.data) as TextWorkerProgressEvent;
              emitProgress(payload);
              if (payload.type === 'final' || payload.type === 'error') {
                eventSource?.close();
              }
            } catch (parseError) {
              console.warn('[TextWorker] Failed to parse progress event:', parseError);
            }
          };
          eventSource.onerror = (evt) => {
            console.warn('[TextWorker] Progress stream error', evt);
            eventSource?.close();
          };
        } catch (error) {
          console.warn('[TextWorker] Failed to open progress stream:', error);
        }
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

      await handleRecommendationSubmission(
        parsedPayload,
        runContext as RuntimeRunContext,
      );

      return JSON.stringify(parsedPayload);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred';
      emitProgress({
        type: 'error',
        label: 'テキスト調査エラー',
        message,
      });
      ctx.callbacks.onError?.(message);
      return JSON.stringify({ status: 'error', message });
    }
    finally {
      try {
        eventSource?.close();
      } catch {
        // ignore close errors
      }
    }
  },
});
