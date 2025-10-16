import { tool } from '@openai/agents/realtime';
import { webSearchTool } from '@openai/agents-openai';
import type { RunContext } from '@openai/agents-core';
import { z } from 'zod';
import {
  SakeRecommendation,
  PurchaseOffer,
  ShopListing,
} from '@/domain/sake/types';
import type { AgentRuntimeContext } from './context';

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

export const findSakeRecommendationsTool = tool({
  name: 'find_sake_recommendations',
  description: 'お客様の嗜好に基づき日本酒をスコアリングして上位候補を返します。',
  parameters: z.object({
    flavor_preference: z.enum(['dry', 'sweet', 'balanced']),
    body_preference: z.enum(['light', 'medium', 'rich']),
    price_range: z.enum(['budget', 'mid', 'premium']),
    food_pairing: z.array(z.string()).nullable(),
  }),
  strict: true,
  async execute(
    input,
    runContext
  ): Promise<string> {
    const ctx = getRuntimeContext(runContext as RuntimeRunContext);
    const preferences = {
      flavorPreference: input.flavor_preference,
      bodyPreference: input.body_preference,
      priceRange: input.price_range,
      foodPairing: input.food_pairing ?? undefined,
    };

    const recommendations =
      await ctx.services.recommendation.recommend(preferences);

    ctx.callbacks.onRecommendations?.(recommendations);

    const response: { recommendations: SakeRecommendation[] } = {
      recommendations,
    };
    return JSON.stringify(response);
  },
});

export const lookupSakeProfileTool = tool({
  name: 'lookup_sake_profile',
  description: '指定されたIDの日本酒詳細を取得します。',
  parameters: z.object({
    sake_id: z.string(),
  }),
  strict: true,
  async execute(
    input,
    runContext
  ): Promise<string> {
    const ctx = getRuntimeContext(runContext as RuntimeRunContext);
    const sake = await ctx.services.recommendation.getById(input.sake_id);
    if (!sake) {
      ctx.callbacks.onError?.(`指定IDの日本酒が見つかりません: ${input.sake_id}`);
      return JSON.stringify({
        error: 'NOT_FOUND',
        message: '指定された日本酒が見つかりません。',
      });
    }
    return JSON.stringify({ sake });
  },
});

export const submitPurchaseRecommendationTool = tool({
  name: 'submit_purchase_recommendation',
  description:
    '調査結果を構造化データで送信し、日本酒の要約と購入先をUIに反映します。',
  parameters: z.object({
    sake: z.object({
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
    }),
    summary: z.string(),
    reasoning: z.string(),
    tasting_highlights: z.array(z.string()).nullable(),
    serving_suggestions: z.array(z.string()).nullable(),
    shops: z
      .array(
        z.object({
          retailer: z.string(),
          url: z.string(),
          price: z.number().nullable(),
          price_text: z.string().nullable(),
          currency: z.string().nullable(),
          availability: z.string().nullable(),
          delivery_estimate: z.string().nullable(),
          source: z.string().nullable(),
          notes: z.string().nullable(),
        })
      )
      .min(1),
  }),
  strict: true,
  async execute(input, runContext): Promise<string> {
    const ctx = getRuntimeContext(runContext as RuntimeRunContext);

    const shops: ShopListing[] = input.shops.map((shop) => ({
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
      sake: {
        id: input.sake.id ?? undefined,
        name: input.sake.name,
        brewery: input.sake.brewery ?? undefined,
        region: input.sake.region ?? undefined,
        type: input.sake.type ?? undefined,
        alcohol: input.sake.alcohol ?? undefined,
        sakeValue: input.sake.sake_value ?? undefined,
        acidity: input.sake.acidity ?? undefined,
        description: input.sake.description ?? undefined,
        tastingNotes: input.sake.tasting_notes ?? undefined,
        foodPairing: input.sake.food_pairing ?? undefined,
        servingTemperature: input.sake.serving_temperature ?? undefined,
        imageUrl: input.sake.image_url ?? undefined,
        originSources: input.sake.origin_sources ?? undefined,
      },
      summary: input.summary,
      reasoning: input.reasoning,
      tastingHighlights: input.tasting_highlights ?? undefined,
      servingSuggestions: input.serving_suggestions ?? undefined,
      shops,
      updatedAt: new Date().toISOString(),
    };

    ctx.callbacks.onSakeProfile?.(offer.sake);
    ctx.callbacks.onShopsUpdated?.(shops);
    ctx.callbacks.onOfferReady?.(offer);

    return JSON.stringify({ status: 'submitted', shopCount: shops.length });
  },
});

export const webSearchHostedTool = webSearchTool({
  searchContextSize: 'large',
});
