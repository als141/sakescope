import {
  BodyPreference,
  FlavorPreference,
  PriceRangePreference,
  Sake,
  SakeId,
  SakeRecommendation,
  UserPreferenceProfile,
} from '@/domain/sake/types';
import { SakeRepository } from '@/application/ports/SakeRepository';
import { sakeCatalog } from '@/infrastructure/data/sakeCatalog';

function normalizePreference<T>(value: T | undefined, fallback: T): T {
  return value ?? fallback;
}

type PreferenceArgs = Partial<UserPreferenceProfile> & {
  flavor_preference?: FlavorPreference;
  body_preference?: BodyPreference;
  price_range?: PriceRangePreference;
};

function mapLegacyPreferences(preferences: PreferenceArgs): UserPreferenceProfile {
  return {
    flavorPreference: normalizePreference(preferences.flavorPreference, preferences.flavor_preference ?? 'balanced'),
    bodyPreference: normalizePreference(preferences.bodyPreference, preferences.body_preference ?? 'medium'),
    priceRange: normalizePreference(preferences.priceRange, preferences.price_range ?? 'mid'),
    foodPairing: preferences.foodPairing ?? preferences.food_pairing ?? null,
  };
}

function parseAveragePrice(range: string): number {
  const match = range.match(/¥([\d,]+)(?:-(\d[\d,]*))?/);
  if (!match) return 3000;
  const low = parseInt(match[1].replace(/,/g, ''), 10);
  const high = match[2] ? parseInt(match[2].replace(/,/g, ''), 10) : low;
  return Math.round((low + high) / 2);
}

export class InMemorySakeRepository implements SakeRepository {
  private readonly records: Sake[];

  constructor(source: Sake[] = sakeCatalog) {
    this.records = source;
  }

  async findAll(): Promise<Sake[]> {
    return this.records;
  }

  async findById(id: SakeId): Promise<Sake | undefined> {
    return this.records.find((record) => record.id === id);
  }

  async recommendByPreferences(
    preferences: UserPreferenceProfile | PreferenceArgs
  ): Promise<SakeRecommendation[]> {
    const normalized = mapLegacyPreferences(preferences);

    const targetSweetness = (() => {
      if (normalized.flavorPreference === 'dry') return 1.5;
      if (normalized.flavorPreference === 'sweet') return 4.5;
      return 3;
    })();

    const targetLightness = (() => {
      if (normalized.bodyPreference === 'light') return 4;
      if (normalized.bodyPreference === 'rich') return 2;
      return 3;
    })();

    const targetPrice = (() => {
      if (normalized.priceRange === 'budget') return 1500;
      if (normalized.priceRange === 'premium') return 5000;
      return 3000;
    })();

    const hasFoodHit = (sake: Sake) => {
      if (!normalized.foodPairing || normalized.foodPairing.length === 0) {
        return false;
      }
      const set = new Set(sake.foodPairing.map((food) => food.toLowerCase()));
      return normalized.foodPairing.some((food) =>
        set.has(food.toLowerCase())
      );
    };

    const scored = this.records.map((sake) => {
      const sweetnessScore =
        1 -
        Math.min(
          1,
          Math.abs(sake.flavorProfile.sweetness - targetSweetness) / 4
        );
      const bodyScore =
        1 -
        Math.min(
          1,
          Math.abs(sake.flavorProfile.lightness - targetLightness) / 4
        );
      const priceAvg = parseAveragePrice(sake.priceRange);
      const priceScore =
        1 - Math.min(1, Math.abs(priceAvg - targetPrice) / 4000);
      const foodScore = hasFoodHit(sake) ? 0.15 : 0;
      const score =
        sweetnessScore * 0.4 + bodyScore * 0.3 + priceScore * 0.3 + foodScore;
      const rationale = [
        sweetnessScore > 0.8
          ? '甘みのバランスがご希望に近いです。'
          : '甘みの度合いが近い銘柄を選びました。',
        bodyScore > 0.8
          ? '飲み口の重さがご希望にフィットします。'
          : '飲み口の重さが比較的近い銘柄です。',
        priceScore > 0.8
          ? '価格帯が理想に合致しています。'
          : '価格帯が近い範囲に収まっています。',
      ];

      if (foodScore > 0) {
        rationale.push('好みの料理との相性が確認できました。');
      }

      return {
        sake,
        score,
        rationale: rationale.join(' '),
      };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 3);
  }
}
