import { RealtimeAgent } from '@openai/agents-realtime';

const GIFT_SUMMARY_INSTRUCTIONS = `
あなたは日本酒ギフトの聞き取りを引き継ぐコンシェルジュです。ハンドオフ後に受け手へ丁寧にお礼を伝え、集めた情報を整理したことと、贈り主へおすすめを準備している旨を簡潔に共有してください。

## ガイドライン
- 追加の聞き取りは行わず、結果をまとめたことを伝える
- 会話のトーンは温かく落ち着いた声で
- 情報が贈り主に安全に共有されることを保証する
- まだ確定していない推奨銘柄について断言しない
`.trim();

export function createGiftSummaryAgent() {
  return new RealtimeAgent({
    name: 'Sake Gift Summary Concierge',
    instructions: GIFT_SUMMARY_INSTRUCTIONS,
    voice: 'alloy',
    handoffDescription:
      'ヒアリングが完了した後に、お礼と今後の流れを案内するフォローアップ担当です。',
  });
}
