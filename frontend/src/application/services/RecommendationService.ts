import type { Sake } from '@/domain/sake/types';

export interface RecommendationCriteria {
  flavorPreference?: string | null;
  bodyPreference?: string | null;
  priceRange?: string | null;
  foodPairing?: string | string[] | null;
}

export interface Recommendation {
  sake: Sake;
  score: number;
  reasons: string[];
}

export interface SakeCandidate {
  sake: Sake;
  tags: {
    flavorProfiles: string[];
    body: 'light' | 'medium' | 'full';
    priceRange: 'budget' | 'mid' | 'premium';
    foodPairings: string[];
  };
}

export interface SakeRepository {
  getAll(): Promise<SakeCandidate[]>;
}

const normalizeString = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
};

const normalizeFoodPairing = (
  value?: string | string[] | null,
): string[] => {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeString(item))
      .filter((item): item is string => Boolean(item));
  }
  const normalized = normalizeString(value);
  if (!normalized) {
    return [];
  }
  return normalized
    .split(/[、,\/]/)
    .map((item) => item.trim())
    .filter(Boolean);
};

export class RecommendationService {
  constructor(private readonly repository: SakeRepository) {}

  async recommend(
    criteria: RecommendationCriteria,
  ): Promise<Recommendation[]> {
    const flavorPreference = normalizeString(criteria.flavorPreference);
    const bodyPreference = normalizeString(criteria.bodyPreference);
    const priceRange = normalizeString(criteria.priceRange);
    const foodPreferences = normalizeFoodPairing(criteria.foodPairing);

    const candidates = await this.repository.getAll();

    const scored = candidates.map((candidate) => {
      const { sake, tags } = candidate;
      let score = 0;
      const reasons: string[] = [];

      if (priceRange) {
        if (tags.priceRange === priceRange) {
          score += 3;
          reasons.push('ご希望の価格帯と一致しました');
        } else if (
          (priceRange === 'budget' && tags.priceRange === 'mid') ||
          (priceRange === 'premium' && tags.priceRange === 'mid')
        ) {
          score += 1;
          reasons.push('近い価格帯のお酒をピックアップしました');
        }
      }

      if (bodyPreference && tags.body === bodyPreference) {
        score += 2;
        reasons.push('ボディ感の好みと合致しています');
      }

      if (
        flavorPreference &&
        tags.flavorProfiles.includes(flavorPreference)
      ) {
        score += 4;
        reasons.push('味わいの傾向がご希望に沿っています');
      }

      if (foodPreferences.length > 0) {
        const candidatePairings = new Set(
          [
            ...(tags.foodPairings ?? []),
            ...(sake.foodPairing ?? []),
          ]
            .map((item) => item?.toLowerCase())
            .filter(Boolean),
        );

        const hasMatch = foodPreferences.some((food) =>
          candidatePairings.has(food.toLowerCase()),
        );

        if (hasMatch) {
          score += 2;
          reasons.push('ペアリングしたい料理との相性が良いです');
        }
      }

      return { sake, score, reasons };
    });

    const positiveMatches = scored
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    if (positiveMatches.length > 0) {
      return positiveMatches.slice(0, 3);
    }

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((item) =>
        item.reasons.length > 0
          ? item
          : {
              ...item,
              reasons: ['人気のある定番銘柄です'],
            },
      );
  }
}
