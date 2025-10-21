import type {
  AlternativeRecommendation,
  PurchaseOffer,
  Sake,
  ShopListing,
} from '@/domain/sake/types';

function toOptionalStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.filter((item): item is string => typeof item === 'string');
  return items.length > 0 ? items : undefined;
}

function toOptionalNumberRecord(value: unknown): Record<string, number | undefined> | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => typeof v === 'number' || v === null)
    .map(([key, v]) => [key, typeof v === 'number' ? v : undefined]);
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function mapSakeRecord(record: Record<string, unknown>, fallbackName = '日本酒'): Sake {
  const name =
    typeof record.name === 'string' && record.name.trim().length > 0
      ? record.name.trim()
      : fallbackName;

  return {
    id: typeof record.id === 'string' ? record.id : undefined,
    name,
    brewery: typeof record.brewery === 'string' ? record.brewery : undefined,
    region: typeof record.region === 'string' ? record.region : undefined,
    type: typeof record.type === 'string' ? record.type : undefined,
    alcohol: typeof record.alcohol === 'number' ? record.alcohol : undefined,
    sakeValue: typeof record.sake_value === 'number' ? record.sake_value : undefined,
    acidity: typeof record.acidity === 'number' ? record.acidity : undefined,
    description: typeof record.description === 'string' ? record.description : undefined,
    tastingNotes: toOptionalStringArray(record.tasting_notes),
    foodPairing: toOptionalStringArray(record.food_pairing),
    servingTemperature: toOptionalStringArray(record.serving_temperature),
    imageUrl: typeof record.image_url === 'string' ? record.image_url : undefined,
    originSources: toOptionalStringArray(record.origin_sources),
    priceRange: typeof record.price_range === 'string' ? record.price_range : undefined,
    flavorProfile: toOptionalNumberRecord(record.flavor_profile),
  };
}

function mapShopListing(record: Record<string, unknown>): ShopListing | null {
  const retailer = typeof record.retailer === 'string' ? record.retailer : null;
  const url = typeof record.url === 'string' ? record.url : null;
  if (!retailer || !url) {
    return null;
  }

  return {
    retailer,
    url,
    price: typeof record.price === 'number' ? record.price : undefined,
    priceText: typeof record.price_text === 'string' ? record.price_text : undefined,
    currency: typeof record.currency === 'string' ? record.currency : undefined,
    availability: typeof record.availability === 'string' ? record.availability : undefined,
    deliveryEstimate:
      typeof record.delivery_estimate === 'string' ? record.delivery_estimate : undefined,
    source: typeof record.source === 'string' ? record.source : undefined,
    notes: typeof record.notes === 'string' ? record.notes : undefined,
  };
}

type MappedRecommendationCore = {
  sake: Sake;
  summary: string;
  reasoning: string;
  tastingHighlights?: string[];
  servingSuggestions?: string[];
  shops: ShopListing[];
  story?: string;
};

function mapRecommendationCore(
  payload: Record<string, unknown>,
  fallbackName?: string,
): MappedRecommendationCore | null {
  const sakePayload = payload.sake;
  const shopsPayload = payload.shops;

  if (!sakePayload || typeof sakePayload !== 'object') {
    return null;
  }

  if (!Array.isArray(shopsPayload)) {
    return null;
  }

  const sake = mapSakeRecord(sakePayload as Record<string, unknown>, fallbackName);
  const shops = shopsPayload
    .map((shop) =>
      shop && typeof shop === 'object'
        ? mapShopListing(shop as Record<string, unknown>)
        : null,
    )
    .filter((shop): shop is ShopListing => Boolean(shop));

  if (shops.length === 0) {
    return null;
  }

  return {
    sake,
    summary:
      typeof payload.summary === 'string' && payload.summary.trim().length > 0
        ? payload.summary.trim()
        : 'ギフトに最適な一本です。',
    reasoning: typeof payload.reasoning === 'string' ? payload.reasoning : '',
    tastingHighlights: toOptionalStringArray(payload.tasting_highlights),
    servingSuggestions: toOptionalStringArray(payload.serving_suggestions),
    shops,
    story:
      typeof payload.story === 'string' && payload.story.trim().length > 0
        ? payload.story.trim()
        : undefined,
  };
}

export function mapGiftRecommendationPayload(
  payload: unknown,
  updatedAt?: string,
): PurchaseOffer | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const core = mapRecommendationCore(record);

  if (!core) {
    return null;
  }

  const offer: PurchaseOffer = {
    sake: core.sake,
    summary: core.summary,
    reasoning: core.reasoning,
    tastingHighlights: core.tastingHighlights,
    servingSuggestions: core.servingSuggestions,
    shops: core.shops,
    updatedAt: updatedAt ?? new Date().toISOString(),
    story: core.story,
  };

  if (Array.isArray(record.alternatives)) {
    const alternatives: AlternativeRecommendation[] = [];
    for (const alt of record.alternatives) {
      if (!alt || typeof alt !== 'object') {
        continue;
      }
      const mapped = mapRecommendationCore(
        alt as Record<string, unknown>,
        offer.sake.name,
      );
      if (!mapped) {
        continue;
      }
      alternatives.push({
        sake: mapped.sake,
        summary: mapped.summary,
        reasoning: mapped.reasoning,
        shops: mapped.shops,
        tastingHighlights: mapped.tastingHighlights,
        servingSuggestions: mapped.servingSuggestions,
        story: mapped.story,
      });
    }
    if (alternatives.length > 0) {
      offer.alternatives = alternatives;
    }
  }

  if (typeof record.follow_up_prompt === 'string' && record.follow_up_prompt.trim()) {
    offer.followUpPrompt = record.follow_up_prompt.trim();
  }

  return offer;
}
