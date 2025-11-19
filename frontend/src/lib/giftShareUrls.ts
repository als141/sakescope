export type GiftShareUrls = {
  webUrl: string;
  lineMiniAppUrl: string | null;
};

export function buildGiftShareUrls(token: string, origin: string): GiftShareUrls {
  const cleanOrigin = origin.endsWith('/') ? origin.slice(0, -1) : origin;
  const webUrl = `${cleanOrigin}/gift/${token}`;
  const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID;
  if (!liffId) {
    return { webUrl, lineMiniAppUrl: null };
  }

  const params = new URLSearchParams({ t: token }).toString();
  const lineMiniAppUrl = `https://miniapp.line.me/${liffId}/liff/gift?${params}`;
  return { webUrl, lineMiniAppUrl };
}
