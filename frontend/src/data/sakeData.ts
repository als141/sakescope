export interface SakeData {
  id: string;
  name: string;
  brewery: string;
  region: string;
  type: string; // 純米, 本醸造, 吟醸, 大吟醸など
  alcohol: number;
  sakeValue: number; // 日本酒度
  acidity: number; // 酸度
  flavor_profile: {
    sweetness: number; // 1-5 (dry to sweet)
    lightness: number; // 1-5 (light to rich)
    complexity: number; // 1-5 (simple to complex)
    fruitiness: number; // 1-5 (not fruity to very fruity)
  };
  tasting_notes: string[];
  food_pairing: string[];
  serving_temp: string[];
  price_range: string;
  description: string;
  image_url: string;
}

export const mockSakeData: SakeData[] = [
  {
    id: "sake-001",
    name: "獺祭 純米大吟醸磨き三割九分",
    brewery: "旭酒造",
    region: "山口県",
    type: "純米大吟醸",
    alcohol: 16.0,
    sakeValue: 6,
    acidity: 1.1,
    flavor_profile: {
      sweetness: 3,
      lightness: 4,
      complexity: 4,
      fruitiness: 4
    },
    tasting_notes: ["華やかな吟醸香", "上品な甘み", "クリアな後味", "洋梨のような香り"],
    food_pairing: ["刺身", "寿司", "白身魚の料理", "軽い前菜"],
    serving_temp: ["冷酒", "常温"],
    price_range: "¥3,000-5,000",
    description: "山田錦を39%まで磨いた贅沢な純米大吟醸。フルーティーで華やかな香りと、透明感のある味わいが特徴的な逸品。",
    image_url: "/images/sake-dassai.jpg"
  },
  {
    id: "sake-002", 
    name: "久保田 萬寿",
    brewery: "朝日酒造",
    region: "新潟県",
    type: "純米大吟醸",
    alcohol: 15.0,
    sakeValue: 4,
    acidity: 1.2,
    flavor_profile: {
      sweetness: 2,
      lightness: 3,
      complexity: 5,
      fruitiness: 2
    },
    tasting_notes: ["穏やかな香り", "深い旨味", "長い余韻", "米本来の味わい"],
    food_pairing: ["焼き魚", "天ぷら", "煮物", "鶏料理"],
    serving_temp: ["冷酒", "常温", "ぬる燗"],
    price_range: "¥4,000-6,000",
    description: "新潟を代表する銘柄。穏やかながら奥深い味わいで、様々な料理との相性も抜群。熟練の技が光る逸品。",
    image_url: "/images/sake-kubota.jpg"
  },
  {
    id: "sake-003",
    name: "十四代 本丸 秘伝玉返し",
    brewery: "高木酒造",
    region: "山形県", 
    type: "特別本醸造",
    alcohol: 15.0,
    sakeValue: 2,
    acidity: 1.4,
    flavor_profile: {
      sweetness: 4,
      lightness: 3,
      complexity: 4,
      fruitiness: 3
    },
    tasting_notes: ["メロンのような香り", "まろやかな甘み", "バランスの良い酸味", "滑らかな口当たり"],
    food_pairing: ["肉料理", "チーズ", "洋食", "スパイシーな料理"],
    serving_temp: ["冷酒", "常温"],
    price_range: "¥2,000-3,500",
    description: "幻の日本酒として名高い十四代シリーズの中でも比較的手に入りやすい銘柄。甘みと酸味のバランスが絶妙。",
    image_url: "/images/sake-juyondai.jpg"
  },
  {
    id: "sake-004",
    name: "而今 特別純米",
    brewery: "木屋正酒造",
    region: "三重県",
    type: "特別純米",
    alcohol: 16.0,
    sakeValue: 1,
    acidity: 1.7,
    flavor_profile: {
      sweetness: 3,
      lightness: 2,
      complexity: 4,
      fruitiness: 3
    },
    tasting_notes: ["上品な甘み", "程よい酸味", "ジューシーな味わい", "フレッシュな香り"],
    food_pairing: ["焼き鳥", "鯖の塩焼き", "野菜炒め", "中華料理"],
    serving_temp: ["冷酒", "常温"],
    price_range: "¥2,500-4,000",
    description: "三重県の名門蔵が醸す現代的な日本酒。フレッシュでジューシーな味わいが若い世代にも人気。",
    image_url: "/images/sake-jikon.jpg"
  },
  {
    id: "sake-005",
    name: "黒龍 九頭龍",
    brewery: "黒龍酒造",
    region: "福井県",
    type: "純米",
    alcohol: 15.0,
    sakeValue: 3,
    acidity: 1.3,
    flavor_profile: {
      sweetness: 2,
      lightness: 3,
      complexity: 3,
      fruitiness: 2
    },
    tasting_notes: ["すっきりとした辛口", "米の旨味", "爽やかな後味", "軽やかな香り"],
    food_pairing: ["刺身", "塩焼き", "豆腐料理", "軽い和食"],
    serving_temp: ["冷酒", "常温", "ぬる燗"],
    price_range: "¥1,500-2,500",
    description: "福井県の老舗蔵が造る純米酒。すっきりとした辛口で、日常使いにも最適な一本。",
    image_url: "/images/sake-kokuryu.jpg"
  },
  {
    id: "sake-006",
    name: "飛露喜 特別純米",
    brewery: "廣木酒造本店",
    region: "福島県",
    type: "特別純米",
    alcohol: 16.0,
    sakeValue: 3,
    acidity: 1.6,
    flavor_profile: {
      sweetness: 3,
      lightness: 3,
      complexity: 4,
      fruitiness: 4
    },
    tasting_notes: ["上品な吟醸香", "ふくよかな旨味", "綺麗な酸味", "長い余韻"],
    food_pairing: ["白身魚", "鶏肉料理", "野菜の煮物", "淡泊な料理"],
    serving_temp: ["冷酒", "常温"],
    price_range: "¥2,000-3,000",
    description: "福島県会津の隠れた名酒。上品な香りとふくよかな旨味が調和した、バランス抜群の特別純米酒。",
    image_url: "/images/sake-hiroki.jpg"
  },
  {
    id: "sake-007",
    name: "写楽 純米吟醸",
    brewery: "宮泉銘醸",
    region: "福島県",
    type: "純米吟醸",
    alcohol: 16.0,
    sakeValue: 1,
    acidity: 1.4,
    flavor_profile: {
      sweetness: 4,
      lightness: 3,
      complexity: 3,
      fruitiness: 4
    },
    tasting_notes: ["フルーティーな香り", "やわらかな甘み", "滑らかな舌触り", "上品な仕上がり"],
    food_pairing: ["生牡蠣", "カルパッチョ", "フルーツ", "軽いデザート"],
    serving_temp: ["冷酒"],
    price_range: "¥2,500-3,500",
    description: "福島県の新進気鋭の蔵が醸す純米吟醸。フルーティーで現代的な味わいが魅力の一本。",
    image_url: "/images/sake-sharaku.jpg"
  },
  {
    id: "sake-008",
    name: "磯自慢 特別本醸造",
    brewery: "磯自慢酒造",
    region: "静岡県",
    type: "特別本醸造",
    alcohol: 15.5,
    sakeValue: 4,
    acidity: 1.3,
    flavor_profile: {
      sweetness: 2,
      lightness: 4,
      complexity: 3,
      fruitiness: 2
    },
    tasting_notes: ["軽快な口当たり", "上品な辛口", "クリアな味わい", "すっきりとした後味"],
    food_pairing: ["海鮮料理", "天ぷら", "塩味の料理", "あっさりした食事"],
    serving_temp: ["冷酒", "常温"],
    price_range: "¥1,800-2,800",
    description: "静岡県の名蔵が造る特別本醸造。軽快でクリアな味わいが特徴で、食中酒として優秀。",
    image_url: "/images/sake-isojiman.jpg"
  }
];

export const getSakeRecommendations = (preferences: {
  flavor_preference?: 'dry' | 'sweet' | 'balanced';
  body_preference?: 'light' | 'medium' | 'rich';
  price_range?: 'budget' | 'mid' | 'premium';
  food_pairing?: string[];
}) => {
  let filtered = [...mockSakeData];

  if (preferences.flavor_preference) {
    filtered = filtered.filter(sake => {
      if (preferences.flavor_preference === 'dry') return sake.flavor_profile.sweetness <= 2;
      if (preferences.flavor_preference === 'sweet') return sake.flavor_profile.sweetness >= 4;
      return sake.flavor_profile.sweetness === 3;
    });
  }

  if (preferences.body_preference) {
    filtered = filtered.filter(sake => {
      if (preferences.body_preference === 'light') return sake.flavor_profile.lightness >= 3;
      if (preferences.body_preference === 'rich') return sake.flavor_profile.lightness <= 2;
      return true;
    });
  }

  if (preferences.price_range) {
    filtered = filtered.filter(sake => {
      const priceNum = parseInt(sake.price_range.match(/¥(\d+),?(\d+)/)?.[1] || '0');
      if (preferences.price_range === 'budget') return priceNum <= 2000;
      if (preferences.price_range === 'premium') return priceNum >= 4000;
      return priceNum > 2000 && priceNum < 4000;
    });
  }

  return filtered.slice(0, 3); // Return top 3 recommendations
};