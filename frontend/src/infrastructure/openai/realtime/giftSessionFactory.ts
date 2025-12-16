import { RealtimeSession } from '@openai/agents-realtime';
import type { AgentOrchestrationCallbacks, AgentRuntimeContext } from '../agents/context';
import { createGiftAgent } from '../agents/giftAgentFactory';
import { createCompleteGiftIntakeTool } from '../agents/tools';

export type GiftAgentBundle = {
  session: RealtimeSession<AgentRuntimeContext>;
  stripToolSchemas: () => void;
};

function createTraceGroupId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `gift-trace-${Math.random().toString(36).slice(2)}`;
}

export function createGiftRealtimeBundle(
  giftId: string,
  sessionId: string,
  callbacks: AgentOrchestrationCallbacks = {},
): GiftAgentBundle {
  const completeGiftIntakeTool = createCompleteGiftIntakeTool();
  const agent = createGiftAgent({ completeGiftIntakeTool });
  const traceGroupId = createTraceGroupId();
  const realtimeModel =
    process.env.NEXT_PUBLIC_OPENAI_REALTIME_MODEL ?? 'gpt-realtime-mini-2025-12-15';

  const runtimeContext: AgentRuntimeContext = {
    callbacks,
    session: {
      traceGroupId,
      gift: {
        giftId,
        sessionId,
        status: 'collecting',
      },
    },
  };

  const session = new RealtimeSession(agent, {
    context: runtimeContext,
    workflowName: 'Sakescope Gift Intake',
    groupId: traceGroupId,
    traceMetadata: {
      channel: 'gift',
      gift_id: giftId,
      gift_session_id: sessionId,
    },
    model: realtimeModel,
    config: {
      outputModalities: ['audio'],
      audio: {
        input: {
          format: { type: 'audio/pcm', rate: 24000 },
          transcription: { model: 'gpt-4o-mini-transcribe' },
          turnDetection: { type: 'semantic_vad' },
          noiseReduction: null,
        },
        output: {
          format: { type: 'audio/pcm', rate: 24000 },
          voice: 'alloy',
          speed: 1,
        },
      },
    },
  });

  return {
    session,
    stripToolSchemas: () => {
      // Avoid hard crashes when the model emits slightly malformed JSON for tool calls.
      // Tool parsing/validation still happens inside the tool's invoke() implementation.
      (completeGiftIntakeTool as { parameters?: unknown }).parameters = undefined;
    },
  };
}
