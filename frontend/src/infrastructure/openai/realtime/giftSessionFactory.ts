import { RealtimeSession } from '@openai/agents-realtime';
import type { AgentOrchestrationCallbacks, AgentRuntimeContext } from '../agents/context';
import { createGiftAgent } from '../agents/giftAgentFactory';

export type GiftAgentBundle = {
  session: RealtimeSession<AgentRuntimeContext>;
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
  const agent = createGiftAgent();
  const traceGroupId = createTraceGroupId();

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
    config: {
      outputModalities: ['audio'],
      audio: {
        input: { format: 'pcm16' },
        output: { voice: 'alloy', format: 'pcm16' },
      },
    },
  });

  return {
    session,
  };
}
