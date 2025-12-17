export type GiftShareTextParams = {
  webUrl: string;
  lineMiniAppUrl?: string | null;
};

export function buildGiftShareText({ webUrl, lineMiniAppUrl }: GiftShareTextParams): string {
  const safeWebUrl = (webUrl ?? '').trim();
  const safeLineUrl = (lineMiniAppUrl ?? '').trim();
  const hasLineUrl = safeLineUrl.length > 0;

  const lines: string[] = [
    '日本酒の好みをAIがいくつか質問します（2〜3分）。',
    '※開くと音声が流れます。音量にご注意ください（イヤホン推奨）。',
    '',
  ];

  if (hasLineUrl) {
    lines.push(`LINEで開く：${safeLineUrl}`);
    lines.push(`開けない場合：${safeWebUrl}`);
  } else {
    lines.push(`こちら：${safeWebUrl}`);
  }

  lines.push('');
  lines.push('※72時間以内・1回のみ有効（20歳以上の確認あり）');

  return lines.join('\n');
}

