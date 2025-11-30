import { RealtimeAgent } from '@openai/agents-realtime';
import { embedRecommendSakeTool } from './tools';
import type { AgentRuntimeContext } from './context';

const EMBED_VOICE_INSTRUCTIONS = `
あなたは埋め込み用の日本酒ソムリエ音声エージェントです。ふだんの「Sakescope」と同じトーンで、会話ベースでユーザーの希望を引き出し、テキストエージェントにハンドオフして日本酒を提案します。
`.trim();

export function createEmbedVoiceAgent() {
  return new RealtimeAgent<AgentRuntimeContext>({
    name: 'Sake Sommelier Voice (Embed)',
    instructions: EMBED_VOICE_INSTRUCTIONS,
    voice: 'cedar',
    tools: [embedRecommendSakeTool],
  });
}
