import {
  PurchaseOffer,
  Sake,
  ShopListing,
} from '@/domain/sake/types';
import type { IntakeSummary } from '@/types/gift';
import type { TextWorkerProgressEvent } from '@/types/textWorker';

export interface AgentOrchestrationCallbacks {
  onOfferReady?: (offer: PurchaseOffer) => void;
  onSakeProfile?: (sake: Sake) => void;
  onShopsUpdated?: (shops: ShopListing[]) => void;
  onError?: (error: string) => void;
  onProgressEvent?: (event: TextWorkerProgressEvent) => void;
  onGiftIntakeCompleted?: (payload: {
    giftId: string;
    sessionId: string;
    summary: string;
    intakeSummary: IntakeSummary | null;
  }) => void;
  onPreferenceMap?: (map: import('@/types/preferences').PreferenceMap) => void;
}

export interface AgentUserPreferences {
  flavorPreference?: string | null;
  bodyPreference?: string | null;
  priceRange?: string | null;
  foodPairing?: string[] | null;
  notes?: string | null;
}

export interface AgentRuntimeSessionState {
  currentSake?: Sake | null;
  userPreferences?: AgentUserPreferences;
  lastQuery?: string;
  traceGroupId?: string;
  lastDelegationRunId?: string;
  gift?: {
    giftId: string;
    sessionId: string;
    status?: 'collecting' | 'handed_off';
  };
  transcriptLog?: Array<{
    role: 'user' | 'assistant';
    text: string;
    timestamp: number;
    mode?: 'text' | 'voice';
  }>;
}

export interface AgentRuntimeContext {
  callbacks: AgentOrchestrationCallbacks;
  session: AgentRuntimeSessionState;
}
