import { JSDOM } from 'jsdom';

const META_SELECTORS = [
  'meta[property="og:image"]',
  'meta[name="og:image"]',
  'meta[property="og:image:secure_url"]',
  'meta[name="twitter:image"]',
  'meta[property="twitter:image"]',
  'meta[name="twitter:image:src"]',
  'link[rel="image_src"]',
];

const IMG_SELECTORS = [
  '#item img',
  'img.product-image',
  'img[itemprop="image"]',
  'img.main-image',
  'img.product-main-image',
  '.product-image img',
  '.product-images img',
  '.item-image img',
  '#product-image img',
  '.product-photo img',
  '.productImage img',
  '[class*="product"] img[src*="jpg"]',
  '[class*="product"] img[src*="png"]',
  '[id*="product"] img',
];

const IMG_MIN_DIMENSION = 80;

const resolveUrl = (value: string | null | undefined, base: string): string | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  try {
    return new URL(trimmed, base).toString();
  } catch {
    return null;
  }
};

export async function extractPrimaryImageUrl(pageUrl: string): Promise<string | null> {
  if (!pageUrl) {
    return null;
  }

  let response: Response;
  try {
    response = await fetch(pageUrl, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      },
    });
  } catch (err) {
    console.error(`[Image Extract] Fetch failed for ${pageUrl}:`, err);
    return null;
  }

  if (!response.ok) {
    console.error(`[Image Extract] HTTP ${response.status} for ${pageUrl}`);
    return null;
  }

  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('text/html')) {
    console.error(`[Image Extract] Invalid content-type ${contentType} for ${pageUrl}`);
    return null;
  }

  const html = await response.text();
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  // 1. メタタグから画像を抽出
  for (const selector of META_SELECTORS) {
    const el = doc.querySelector(selector);
    const content = el?.getAttribute('content') || el?.getAttribute('href');
    const candidate = resolveUrl(content, pageUrl);
    if (candidate) {
      console.log(`[Image Extract] Found meta image: ${candidate}`);
      return candidate;
    }
  }

  // 2. 商品画像セレクタから抽出
  for (const selector of IMG_SELECTORS) {
    const img = doc.querySelector(selector);
    if (img) {
      const src = resolveUrl(
        img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-lazy-src'),
        pageUrl
      );
      if (src) {
        console.log(`[Image Extract] Found product image: ${src}`);
        return src;
      }
    }
  }

  // 3. 全てのimg要素からスコアリング
  const images = Array.from(doc.querySelectorAll('img'))
    .map((img) => {
      const src = resolveUrl(
        img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-lazy-src'),
        pageUrl
      );
      if (!src) {
        return null;
      }
      
      // URLに商品関連キーワードが含まれているかチェック
      const urlScore = /product|item|sake|bottle|label/i.test(src) ? 3 : 0;
      
      // サイズチェック
      const width = Number.parseInt(img.getAttribute('width') ?? '', 10);
      const height = Number.parseInt(img.getAttribute('height') ?? '', 10);
      const hasSize =
        Number.isFinite(width) && width >= IMG_MIN_DIMENSION &&
        Number.isFinite(height) && height >= IMG_MIN_DIMENSION;
      
      // alt属性チェック
      const alt = img.getAttribute('alt') || '';
      const hasAlt = Boolean(alt);
      const altScore = /product|商品|sake|日本酒|bottle/i.test(alt) ? 2 : (hasAlt ? 1 : 0);
      
      // クラス名チェック
      const className = img.getAttribute('class') || '';
      const classScore = /product|item|main|primary/i.test(className) ? 2 : 0;
      
      return {
        src,
        score: urlScore + (hasSize ? 2 : 0) + altScore + classScore,
      };
    })
    .filter((entry): entry is { src: string; score: number } => Boolean(entry));

  if (!images.length) {
    console.log(`[Image Extract] No images found for: ${pageUrl}`);
    return null;
  }

  images.sort((a, b) => b.score - a.score);
  console.log(`[Image Extract] Selected image with score ${images[0].score}: ${images[0].src}`);
  return images[0]?.src ?? null;
}
