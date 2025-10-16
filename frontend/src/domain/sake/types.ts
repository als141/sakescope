export interface UserPreferenceProfile {
  flavorPreference?: string | null;
  bodyPreference?: string | null;
  priceRange?: string | null;
  foodPairing?: string[] | null;
  notes?: string | null;
}

export type SakeId = string;

export interface FlavorProfile {
  sweetness?: number;
  lightness?: number;
  complexity?: number;
  fruitiness?: number;
}

export interface Sake {
  id?: SakeId;
  name: string;
  brewery?: string;
  region?: string;
  type?: string;
  alcohol?: number;
  sakeValue?: number;
  acidity?: number;
  flavorProfile?: FlavorProfile;
  tastingNotes?: string[];
  foodPairing?: string[];
  servingTemperature?: string[];
  priceRange?: string;
  description?: string;
  imageUrl?: string;
  originSources?: string[];
}

export interface ShopListing {
  retailer: string;
  url: string;
  price?: number;
  priceText?: string;
  currency?: string;
  availability?: string;
  deliveryEstimate?: string;
  source?: string;
  notes?: string;
}

export interface PurchaseLink {
  id: string;
  sakeId: SakeId;
  retailer: string;
  url: string;
  price: number;
  currency: 'JPY';
  volumeMl: number;
  stockStatus: 'in_stock' | 'limited' | 'out_of_stock';
  shippingEstimate?: string;
  lastVerified: string;
  notes?: string;
}

export interface SakeWithLinks {
  sake: Sake;
  links: PurchaseLink[];
}

export interface AlternativeRecommendation {
  sake: Sake;
  summary: string;
  reasoning: string;
  shops: ShopListing[];
  tastingHighlights?: string[];
  servingSuggestions?: string[];
}

export interface PurchaseOffer {
  sake: Sake;
  summary: string;
  reasoning: string;
  tastingHighlights?: string[];
  servingSuggestions?: string[];
  shops: ShopListing[];
  links?: PurchaseLink[]; // legacy fallback
  updatedAt: string;
  alternatives?: AlternativeRecommendation[];
  followUpPrompt?: string;
}
