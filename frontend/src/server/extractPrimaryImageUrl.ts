import { JSDOM } from 'jsdom';

const META_SELECTORS = [
  'meta[property="og:image"]',
  'meta[name="og:image"]',
  'meta[name="twitter:image"]',
  'meta[property="twitter:image"]',
];

const IMG_MIN_DIMENSION = 120;

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
        'User-Agent': 'sakescope-image-bot/1.0 (+https://sakescope.example)',
      },
    });
  } catch {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('text/html')) {
    return null;
  }

  const html = await response.text();
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  for (const selector of META_SELECTORS) {
    const candidate = resolveUrl(doc.querySelector(selector)?.getAttribute('content'), pageUrl);
    if (candidate) {
      return candidate;
    }
  }

  const images = Array.from(doc.querySelectorAll('img'))
    .map((img) => {
      const src = resolveUrl(img.getAttribute('src'), pageUrl);
      if (!src) {
        return null;
      }
      const width = Number.parseInt(img.getAttribute('width') ?? '', 10);
      const height = Number.parseInt(img.getAttribute('height') ?? '', 10);
      const hasSize =
        Number.isFinite(width) && width >= IMG_MIN_DIMENSION &&
        Number.isFinite(height) && height >= IMG_MIN_DIMENSION;
      const hasAlt = Boolean(img.getAttribute('alt'));
      return {
        src,
        score: (hasSize ? 2 : 0) + (hasAlt ? 1 : 0),
      };
    })
    .filter((entry): entry is { src: string; score: number } => Boolean(entry));

  if (!images.length) {
    return null;
  }

  images.sort((a, b) => b.score - a.score);
  return images[0]?.src ?? null;
}
