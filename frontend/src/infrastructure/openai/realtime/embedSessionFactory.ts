import { RealtimeSession } from '@openai/agents-realtime';
import { AgentOrchestrationCallbacks, AgentRuntimeContext } from '../agents/context';
import { createEmbedVoiceAgent } from '../agents/embedVoiceAgentFactory';

export type VoiceAgentBundle = {
  session: RealtimeSession<AgentRuntimeContext>;
};

function createTraceGroupId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `trace-${Math.random().toString(36).slice(2)}`;
}

export function createRealtimeEmbedVoiceBundle(
  callbacks: AgentOrchestrationCallbacks = {},
): VoiceAgentBundle {
  const voiceAgent = createEmbedVoiceAgent();
  const traceGroupId = createTraceGroupId();
  const realtimeModel =
    process.env.NEXT_PUBLIC_OPENAI_REALTIME_MODEL ?? 'gpt-realtime-mini';

  const runtimeContext: AgentRuntimeContext = {
    callbacks,
    session: {
      currentSake: undefined,
      userPreferences: undefined,
      lastQuery: undefined,
      traceGroupId,
      transcriptLog: [],
    },
  };

  const session = new RealtimeSession(voiceAgent, {
    context: runtimeContext,
    workflowName: 'Sakescope Voice Agent Embed',
    groupId: traceGroupId,
    traceMetadata: {
      channel: 'voice-embed',
      conversation_id: traceGroupId,
    },
    model: realtimeModel,
    config: {
      outputModalities: ['audio'],
      audio: {
        input: { format: 'pcm16' },
        output: { voice: 'cedar', format: 'pcm16' },
      },
    },
  });

  return {
    session,
  };
}
