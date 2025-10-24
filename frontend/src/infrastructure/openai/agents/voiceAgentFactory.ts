import { handoff } from '@openai/agents';
import { RealtimeAgent } from '@openai/agents-realtime';
import type { RunContext } from '@openai/agents-core';
import { executeRecommendSakeDelegation, recommendSakeInputSchema } from './tools';
import type { AgentRuntimeContext } from './context';
import { createVoiceSummaryAgent } from './voiceSummaryAgentFactory';

const VOICE_INSTRUCTIONS = `
あなたは日本酒コンシェルジュ。だけど堅くしゃべらない。敬語禁止、ため口オンリー。
相手は日本酒に詳しくない前提。専門用語は使わず、比喩や日常会話でやさしく聞き出す。ユーザーの会話に合わせて、あなたが自由に進めてください

## 会話の進め方（これに限りません。自由に進めてください。）
・まずは軽い雑談：「今日は何してた？」「仕事帰り？」「誰と飲む？」「自分用？プレゼント？」あなたが自由に進めてください。これに限りません。
・ユースケースを決める：自分用/家族/友達/プレゼント/差し入れ…用途を雑談で自然に聞く。この前の会話内容によって、
・好き嫌いを少しずつ聞いてみる。
・価格帯はざっくり
・決め付けない：分からないと言われたら具体例で誘導
・まとまってきたら『おすすめ探すツール（recommend_sake）』を呼び出して、結果が返ってきたら
   “返ってきた内容を要約して”説明する。

絶対ルール：
- 敬語禁止。上から目線にしない。
- 専門用語は避ける。言うなら例えでカバー。
- 無理に1回で決めない。聞き返してOK。
`.trim();

const voiceSummaryAgent = createVoiceSummaryAgent();

const recommendSakeHandoff = handoff(voiceSummaryAgent, {
  toolNameOverride: 'recommend_sake',
  toolDescriptionOverride:
    '雑談で引き出した要望をまとめてテキストエージェントに渡し、日本酒の推薦JSONを取得します。購入や在庫の確認もこのハンドオフを使ってください。',
  inputType: recommendSakeInputSchema,
  async onHandoff(runContext, input) {
    const runtime = runContext.context as AgentRuntimeContext | undefined;
    if (!runtime) {
      throw new Error('Runtime context is not available for the voice handoff.');
    }

    if (!input) {
      throw new Error('recommend_sake handoff input is missing.');
    }

    await executeRecommendSakeDelegation(
      input,
      runContext as RunContext<AgentRuntimeContext>,
    );
  },
});

export function createVoiceAgent() {
  return new RealtimeAgent<AgentRuntimeContext>({
    name: 'Sake Sommelier Voice',
    instructions: VOICE_INSTRUCTIONS,
    voice: 'alloy',
    handoffs: [recommendSakeHandoff],
  });
}
