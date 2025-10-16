import { RealtimeSession } from '@openai/agents-realtime';
import { RecommendationService } from '@/application/services/RecommendationService';
import { InMemorySakeRepository } from '@/infrastructure/repositories/InMemorySakeRepository';
import { AgentOrchestrationCallbacks, AgentRuntimeContext } from '../agents/context';
import { createVoiceAgent } from '../agents/voiceAgentFactory';

export type VoiceAgentBundle = {
  session: RealtimeSession<AgentRuntimeContext>;
};

export function createRealtimeVoiceBundle(
  callbacks: AgentOrchestrationCallbacks = {}
): VoiceAgentBundle {
  const repository = new InMemorySakeRepository();
  const recommendationService = new RecommendationService(repository);
  const voiceAgent = createVoiceAgent();

  const runtimeContext: AgentRuntimeContext = {
    services: {
      recommendation: recommendationService,
    },
    callbacks,
  };

  const session = new RealtimeSession(voiceAgent, {
    context: runtimeContext,
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
