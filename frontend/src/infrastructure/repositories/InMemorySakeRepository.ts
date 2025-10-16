import type {
  SakeCandidate,
  SakeRepository,
} from '@/application/services/RecommendationService';

const SAKE_CATALOG: SakeCandidate[] = [
  {
    sake: {
      id: 'dassai-45',
      name: '獺祭 純米大吟醸 45',
      brewery: '旭酒造',
      region: '山口県',
      type: '純米大吟醸',
      alcohol: 16,
      flavorProfile: {
        sweetness: 6,
        lightness: 7,
        complexity: 5,
        fruitiness: 8,
      },
      tastingNotes: ['フルーティー', '華やか', 'ジューシー'],
      foodPairing: ['刺身', '寿司', 'カルパッチョ'],
      servingTemperature: ['冷酒'],
      priceRange: 'premium',
      description:
        'ジューシーな香りと繊細な甘みが魅力の人気銘柄。お祝いにもぴったりです。',
      imageUrl:
        'https://images.pexels.com/photos/164516/pexels-photo-164516.jpeg',
    },
    tags: {
      flavorProfiles: ['fruity', 'aromatic'],
      body: 'light',
      priceRange: 'premium',
      foodPairings: ['seafood', 'sushi', 'white fish'],
    },
  },
  {
    sake: {
      id: 'kubota-senju',
      name: '久保田 千寿',
      brewery: '朝日酒造',
      region: '新潟県',
      type: '吟醸酒',
      alcohol: 15,
      flavorProfile: {
        sweetness: 3,
        lightness: 8,
        complexity: 5,
        fruitiness: 4,
      },
      tastingNotes: ['すっきり', '淡麗辛口', 'シャープ'],
      foodPairing: ['刺身', '天ぷら', '冷奴'],
      servingTemperature: ['冷酒', '常温'],
      priceRange: 'mid',
      description:
        'キレの良い味わいで幅広い料理に合わせやすい万能な一本。普段の食卓におすすめ。',
      imageUrl:
        'https://images.pexels.com/photos/533142/pexels-photo-533142.jpeg',
    },
    tags: {
      flavorProfiles: ['crisp', 'dry'],
      body: 'light',
      priceRange: 'mid',
      foodPairings: ['tempura', 'seafood', 'tofu', 'sushi'],
    },
  },
  {
    sake: {
      id: 'kakurei-tokubetsu',
      name: '鶴齢 特別純米',
      brewery: '青木酒造',
      region: '新潟県',
      type: '特別純米酒',
      alcohol: 16,
      flavorProfile: {
        sweetness: 4,
        lightness: 5,
        complexity: 7,
        fruitiness: 5,
      },
      tastingNotes: ['旨み', 'コク', 'バランス'],
      foodPairing: ['焼き魚', '煮物', '肉料理'],
      servingTemperature: ['冷酒', '常温', 'ぬる燗'],
      priceRange: 'mid',
      description:
        '米の旨味をしっかり楽しめるバランスの良い一本。温度帯で表情が変わります。',
      imageUrl:
        'https://images.pexels.com/photos/3861489/pexels-photo-3861489.jpeg',
    },
    tags: {
      flavorProfiles: ['balanced', 'umami'],
      body: 'medium',
      priceRange: 'mid',
      foodPairings: ['grilled fish', 'nabe', 'meat', 'stew'],
    },
  },
  {
    sake: {
      id: 'hakkaisan-tokusen',
      name: '八海山 特別本醸造',
      brewery: '八海醸造',
      region: '新潟県',
      type: '特別本醸造',
      alcohol: 15.5,
      flavorProfile: {
        sweetness: 2,
        lightness: 7,
        complexity: 4,
        fruitiness: 3,
      },
      tastingNotes: ['淡麗', 'キレ', 'クリーン'],
      foodPairing: ['刺身', '冷菜', '天ぷら'],
      servingTemperature: ['冷酒', '常温'],
      priceRange: 'budget',
      description:
        '雑味の少ないクリアな味わいが特徴の定番酒。冷やしてすっきり楽しめます。',
      imageUrl:
        'https://images.pexels.com/photos/5531558/pexels-photo-5531558.jpeg',
    },
    tags: {
      flavorProfiles: ['crisp', 'clean'],
      body: 'light',
      priceRange: 'budget',
      foodPairings: ['seafood', 'salad', 'tempura'],
    },
  },
  {
    sake: {
      id: 'kuro-ryu-icho',
      name: '黒龍 いっちょらい',
      brewery: '黒龍酒造',
      region: '福井県',
      type: '吟醸酒',
      alcohol: 15,
      flavorProfile: {
        sweetness: 5,
        lightness: 6,
        complexity: 6,
        fruitiness: 6,
      },
      tastingNotes: ['上品', 'まろやか', 'やさしい香り'],
      foodPairing: ['焼き鳥', '白身魚', 'だし料理'],
      servingTemperature: ['冷酒', '常温'],
      priceRange: 'mid',
      description:
        '上品な香りとまろやかな旨味が魅力。和食全般と相性が良い食中酒です。',
      imageUrl:
        'https://images.pexels.com/photos/1089931/pexels-photo-1089931.jpeg',
    },
    tags: {
      flavorProfiles: ['balanced', 'smooth'],
      body: 'medium',
      priceRange: 'mid',
      foodPairings: ['yakitori', 'dashi', 'white fish'],
    },
  },
  {
    sake: {
      id: 'juyondai-honmaru',
      name: '十四代 本丸 秘伝玉返し',
      brewery: '高木酒造',
      region: '山形県',
      type: '本醸造',
      alcohol: 15,
      flavorProfile: {
        sweetness: 7,
        lightness: 4,
        complexity: 8,
        fruitiness: 7,
      },
      tastingNotes: ['芳醇', 'リッチ', '余韻が長い'],
      foodPairing: ['肉料理', '濃い味の料理', 'チーズ'],
      servingTemperature: ['冷酒', '常温'],
      priceRange: 'premium',
      description:
        '濃厚で華やかな香りと深い旨味が広がる贅沢な味わい。特別なシーンに最適です。',
      imageUrl:
        'https://images.pexels.com/photos/4913269/pexels-photo-4913269.jpeg',
    },
    tags: {
      flavorProfiles: ['rich', 'aromatic'],
      body: 'full',
      priceRange: 'premium',
      foodPairings: ['meat', 'cheese', 'rich dishes'],
    },
  },
];

export class InMemorySakeRepository implements SakeRepository {
  private readonly catalog: SakeCandidate[];

  constructor(seed: SakeCandidate[] = SAKE_CATALOG) {
    this.catalog = seed;
  }

  async getAll(): Promise<SakeCandidate[]> {
    return this.catalog.map((entry) => ({
      sake: {
        ...entry.sake,
        tastingNotes: entry.sake.tastingNotes
          ? [...entry.sake.tastingNotes]
          : undefined,
        foodPairing: entry.sake.foodPairing
          ? [...entry.sake.foodPairing]
          : undefined,
        servingTemperature: entry.sake.servingTemperature
          ? [...entry.sake.servingTemperature]
          : undefined,
        originSources: entry.sake.originSources
          ? [...entry.sake.originSources]
          : undefined,
      },
      tags: {
        ...entry.tags,
        flavorProfiles: [...entry.tags.flavorProfiles],
        foodPairings: [...entry.tags.foodPairings],
      },
    }));
  }
}
