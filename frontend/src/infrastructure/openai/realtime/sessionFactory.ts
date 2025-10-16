import { RealtimeSession } from '@openai/agents-realtime';
import { AgentOrchestrationCallbacks, AgentRuntimeContext } from '../agents/context';
import { createVoiceAgent } from '../agents/voiceAgentFactory';

export type VoiceAgentBundle = {
  session: RealtimeSession<AgentRuntimeContext>;
};

function createTraceGroupId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `trace-${Math.random().toString(36).slice(2)}`;
}

export function createRealtimeVoiceBundle(
  callbacks: AgentOrchestrationCallbacks = {}
): VoiceAgentBundle {
  const voiceAgent = createVoiceAgent();
  const traceGroupId = createTraceGroupId();

  const runtimeContext: AgentRuntimeContext = {
    callbacks,
    session: {
      currentSake: undefined,
      userPreferences: undefined,
      lastQuery: undefined,
      traceGroupId,
    },
  };

  const session = new RealtimeSession(voiceAgent, {
    context: runtimeContext,
    workflowName: 'Sakescope Voice Agent',
    groupId: traceGroupId,
    traceMetadata: {
      channel: 'voice',
    },
    config: {
      outputModalities: ['audio', 'text'],
      audio: {
        output: { voice: 'alloy' },
      },
    },
  });

  return {
    session,
  };
}
