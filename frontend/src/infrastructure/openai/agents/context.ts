import { RecommendationService } from '@/application/services/RecommendationService';
import {
  PurchaseOffer,
  Sake,
  SakeRecommendation,
  ShopListing,
} from '@/domain/sake/types';

export interface AgentOrchestrationCallbacks {
  onRecommendations?: (recommendations: SakeRecommendation[]) => void;
  onOfferReady?: (offer: PurchaseOffer) => void;
  onSakeProfile?: (sake: Sake) => void;
  onShopsUpdated?: (shops: ShopListing[]) => void;
  onError?: (error: string) => void;
}

export interface AgentRuntimeContext {
  services: {
    recommendation: RecommendationService;
  };
  callbacks: AgentOrchestrationCallbacks;
}
