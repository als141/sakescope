import { z } from 'zod';

const absoluteImageUrlSchema = z
  .string()
  .min(1, '画像URLを指定してください')
  .regex(/^https?:\/\/.+/, 'HTTP(S) から始まる画像URLを指定してください')
  .describe(
    'Direct image URL (e.g., https://example.com/image.jpg) - must be an actual image file, not a product page',
  );

const preferenceAxisSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  level: z.number().min(1).max(5),
  evidence: z.string().nullable().optional(),
});

const preferenceMapSchema = z
  .object({
    title: z.string().nullable().optional(),
    axes: z.array(preferenceAxisSchema).min(3).max(6),
    summary: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
  })
  .nullable();

export const shopSchema = z.object({
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

export const flavorProfileSchema = z
  .object({
    sweetness: z.number().nullable(),
    lightness: z.number().nullable(),
    complexity: z.number().nullable(),
    fruitiness: z.number().nullable(),
  })
  .nullable();

export const sakeSchemaInput = z.object({
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
  image_url: absoluteImageUrlSchema,
  origin_sources: z.array(z.string()).nullable(),
  price_range: z.string().nullable(),
  flavor_profile: flavorProfileSchema,
});

export const sakeSchemaOutput = z.object({
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
  image_url: absoluteImageUrlSchema,
  origin_sources: z.array(z.string()).nullable(),
  price_range: z.string().nullable(),
  flavor_profile: flavorProfileSchema,
});

export const recommendationSchemaInput = z.object({
  sake: sakeSchemaInput,
  summary: z.string(),
  reasoning: z.string(),
  tasting_highlights: z.array(z.string()).nullable(),
  serving_suggestions: z.array(z.string()).nullable(),
  shops: z.array(shopSchema).min(1),
  preference_map: preferenceMapSchema,
});

export const recommendationSchemaOutput = z.object({
  sake: sakeSchemaOutput,
  summary: z.string(),
  reasoning: z.string(),
  tasting_highlights: z.array(z.string()).nullable(),
  serving_suggestions: z.array(z.string()).nullable(),
  shops: z.array(shopSchema).min(1),
  preference_map: preferenceMapSchema,
});

export const alternativeSuggestionSchema = z.object({
  name: z.string(),
  highlight: z.string().nullable(),
  url: z
    .string()
    .min(1)
    .describe(
      'Product or reference URL that helps the user find this candidate',
    )
    .nullable(),
  price_text: z.string().nullable(),
  notes: z.string().nullable(),
});

export const finalPayloadInputSchema = recommendationSchemaInput.extend({
  alternatives: z.array(alternativeSuggestionSchema).max(2).nullable(),
  follow_up_prompt: z.string().nullable(),
});

export const finalPayloadOutputSchema = recommendationSchemaOutput.extend({
  alternatives: z.array(alternativeSuggestionSchema).max(2).nullable(),
  follow_up_prompt: z.string().nullable(),
});

export type FinalPayloadInput = z.infer<typeof finalPayloadInputSchema>;
export type FinalPayloadOutput = z.infer<typeof finalPayloadOutputSchema>;

export const finalPayloadJsonSchema = {
  $id: 'SakeGiftRecommendation',
  type: 'object',
  additionalProperties: false,
  required: ['sake', 'summary', 'reasoning', 'shops'],
  properties: {
    sake: { $ref: '#/$defs/sake' },
    summary: { type: 'string' },
    reasoning: { type: 'string' },
    tasting_highlights: {
      type: ['array', 'null'],
      items: { type: 'string' },
    },
    serving_suggestions: {
      type: ['array', 'null'],
      items: { type: 'string' },
    },
    shops: {
      type: 'array',
      minItems: 1,
      items: { $ref: '#/$defs/shop' },
    },
    alternatives: {
      type: ['array', 'null'],
      maxItems: 2,
      items: { $ref: '#/$defs/alternative' },
    },
    follow_up_prompt: { type: ['string', 'null'] },
    preference_map: { $ref: '#/$defs/preference_map' },
  },
  $defs: {
    preference_axis: {
      type: 'object',
      additionalProperties: false,
      required: ['key', 'label', 'level'],
      properties: {
        key: { type: 'string' },
        label: { type: 'string' },
        level: { type: 'number', minimum: 1, maximum: 5 },
        evidence: { type: ['string', 'null'] },
      },
    },
    preference_map: {
      type: ['object', 'null'],
      additionalProperties: false,
      properties: {
        title: { type: ['string', 'null'] },
        axes: {
          type: 'array',
          minItems: 3,
          maxItems: 6,
          items: { $ref: '#/$defs/preference_axis' },
        },
        summary: { type: ['string', 'null'] },
        notes: { type: ['string', 'null'] },
      },
      required: ['axes'],
    },
    flavor_profile: {
      type: ['object', 'null'],
      additionalProperties: false,
      properties: {
        sweetness: { type: ['number', 'null'] },
        lightness: { type: ['number', 'null'] },
        complexity: { type: ['number', 'null'] },
        fruitiness: { type: ['number', 'null'] },
      },
    },
    sake: {
      type: 'object',
      additionalProperties: false,
      required: ['name', 'image_url'],
      properties: {
        id: { type: ['string', 'null'] },
        name: { type: 'string' },
        brewery: { type: ['string', 'null'] },
        region: { type: ['string', 'null'] },
        type: { type: ['string', 'null'] },
        alcohol: { type: ['number', 'null'] },
        sake_value: { type: ['number', 'null'] },
        acidity: { type: ['number', 'null'] },
        description: { type: ['string', 'null'] },
        tasting_notes: {
          type: ['array', 'null'],
          items: { type: 'string' },
        },
        food_pairing: {
          type: ['array', 'null'],
          items: { type: 'string' },
        },
        serving_temperature: {
          type: ['array', 'null'],
          items: { type: 'string' },
        },
        image_url: { type: 'string', format: 'uri' },
        origin_sources: {
          type: ['array', 'null'],
          items: { type: 'string' },
        },
        price_range: { type: ['string', 'null'] },
        flavor_profile: { $ref: '#/$defs/flavor_profile' },
      },
    },
    shop: {
      type: 'object',
      additionalProperties: false,
      required: ['retailer', 'url'],
      properties: {
        retailer: { type: 'string' },
        url: { type: 'string', format: 'uri-reference' },
        price: { type: ['number', 'null'] },
        price_text: { type: ['string', 'null'] },
        currency: { type: ['string', 'null'] },
        availability: { type: ['string', 'null'] },
        delivery_estimate: { type: ['string', 'null'] },
        source: { type: ['string', 'null'] },
        notes: { type: ['string', 'null'] },
      },
    },
    recommendation: {
      type: 'object',
      additionalProperties: false,
      required: ['sake', 'summary', 'reasoning', 'shops'],
      properties: {
        sake: { $ref: '#/$defs/sake' },
        summary: { type: 'string' },
        reasoning: { type: 'string' },
        tasting_highlights: {
          type: ['array', 'null'],
          items: { type: 'string' },
        },
        serving_suggestions: {
          type: ['array', 'null'],
          items: { type: 'string' },
        },
        shops: {
          type: 'array',
          minItems: 1,
          items: { $ref: '#/$defs/shop' },
        },
      },
    },
    alternative: {
      type: 'object',
      additionalProperties: false,
      required: ['name'],
      properties: {
        name: { type: 'string' },
        highlight: { type: ['string', 'null'] },
        url: { type: ['string', 'null'], format: 'uri-reference' },
        price_text: { type: ['string', 'null'] },
        notes: { type: ['string', 'null'] },
      },
    },
  },
};

export type FinalPayloadJsonSchema = typeof finalPayloadJsonSchema;
