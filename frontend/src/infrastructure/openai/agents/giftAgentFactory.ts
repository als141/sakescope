import { handoff } from '@openai/agents';
import { RealtimeAgent } from '@openai/agents-realtime';
import { z } from 'zod';
import type { AgentRuntimeContext } from './context';
import type { IntakeSummary } from '@/types/gift';
import { createGiftSummaryAgent } from './giftSummaryAgentFactory';

const GIFT_INSTRUCTIONS = `
あなたは日本酒ギフトのための聞き取りコンシェルジュです。丁寧で温かい口調を保ちながら、会話する方ご自身の好みを自然な会話で引き出してください。

## 目的
- いま会話している方がプレゼントを受け取る本人であるという前提で、その方の嗜好や飲むシーンをヒアリングし、complete_gift_intake ハンドオフに渡せる情報を集める
- 予算や価格は一切触れない
- 会話は最大でも5〜7往復程度でまとめる

## コミュニケーション
- 音声で届いた発話には音声で返答して良い
- メッセージが "[TEXT]" で始まる場合はテキスト入力。タグを読み上げず、テキストだけで短く返答し、音声は生成しない
- 個人情報 (フルネーム/住所など) を尋ねない
- 相手が日本酒に詳しくない前提で、香り・味わい・飲むシーン・料理との相性などをわかりやすく聞き出す
- 「どんな人に贈るのか？」といった質問は避け、相手自身の好みや楽しみ方について尋ねる

## 会話の進め方
・ 会話はこれに限りません。自由に進めてください。あなたが思うように、自然な流れで会話を進めていき、関係ないことも会話して構いません
・ 決め付けない：分からないと言われたら具体例で誘導
・ 軽い自己紹介と雑談でリラックスしてもらう
・ 味わい(辛口/甘口/バランス)、香り、好み、合わせたい料理などを自然に質問
・ 相手の回答を要約しながら確認し、足りない点を補足
・ 情報が十分に揃ったら complete_gift_intake ハンドオフを呼び出し、summary（会話の要約）と intake（嗜好の構造化 JSON）、必要なら additional_notes を渡す
・ ハンドオフ後は「ありがとう」と伝えて会話を終了
`.trim();

const giftIntakeSummarySchema = z
  .object({
    aroma: z.array(z.string()).nullable().optional(),
    taste_profile: z.array(z.string()).nullable().optional(),
    sweetness_dryness: z.string().nullable().optional(),
    temperature_preference: z.array(z.string()).nullable().optional(),
    food_pairing: z.array(z.string()).nullable().optional(),
    drinking_frequency: z.string().nullable().optional(),
    region_preference: z.array(z.string()).nullable().optional(),
    notes: z.string().nullable().optional(),
  })
  .nullable()
  .optional();

const giftSummaryAgent = createGiftSummaryAgent();

const giftIntakeHandoff = handoff(giftSummaryAgent, {
  toolNameOverride: 'complete_gift_intake',
  toolDescriptionOverride:
    'ギフト用の聞き取りが完了したら、集めた情報をまとめてハンドオフします。予算は含めず、味わい・香り・温度・ペアリングなどを整理してください。',
  inputType: z.object({
    summary: z.string().min(1),
    intake: giftIntakeSummarySchema,
    additional_notes: z.string().nullable().optional(),
  }),
  async onHandoff(runContext, input) {
    const runtime = runContext.context as AgentRuntimeContext | undefined;
    if (!runtime) {
      throw new Error('Runtime context is not available for the gift handoff.');
    }
    const giftSession = runtime.session.gift;
    if (!giftSession?.giftId || !giftSession.sessionId) {
      throw new Error('Gift session metadata is not configured.');
    }

    const summary = input?.summary ?? '';
    if (!summary) {
      throw new Error('Gift handoff summary is missing.');
    }

    const intakeSummary = (input?.intake ?? null) as IntakeSummary | null;

    const payload: Record<string, unknown> = {
      sessionId: giftSession.sessionId,
      intakeSummary,
      handoffSummary: summary,
    };

    if (input?.additional_notes) {
      payload.additionalNotes = input.additional_notes;
    }

    const response = await fetch(`/api/gift/${giftSession.giftId}/trigger-handoff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(
        errorText || `Gift handoff failed (${response.status})`,
      );
    }

    runtime.session.gift = {
      ...giftSession,
      status: 'handed_off',
    };

    runtime.callbacks.onGiftIntakeCompleted?.({
      giftId: giftSession.giftId,
      sessionId: giftSession.sessionId,
      summary,
      intakeSummary,
    });
  },
});

export function createGiftAgent() {
  return new RealtimeAgent<AgentRuntimeContext>({
    name: 'Sake Gift Intake',
    instructions: GIFT_INSTRUCTIONS,
    voice: 'alloy',
    handoffs: [giftIntakeHandoff],
  });
}
