import {
  PurchaseOffer,
  Sake,
  ShopListing,
} from '@/domain/sake/types';

export interface AgentOrchestrationCallbacks {
  onOfferReady?: (offer: PurchaseOffer) => void;
  onSakeProfile?: (sake: Sake) => void;
  onShopsUpdated?: (shops: ShopListing[]) => void;
  onError?: (error: string) => void;
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
}

export interface AgentRuntimeContext {
  callbacks: AgentOrchestrationCallbacks;
  session: AgentRuntimeSessionState;
}
