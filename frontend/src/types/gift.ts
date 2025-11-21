import type { PurchaseOffer } from '@/domain/sake/types';
import type { PreferenceMap } from './preferences';

export type GiftStatus =
  | 'DRAFT'
  | 'LINK_CREATED'
  | 'OPENED'
  | 'INTAKE_STARTED'
  | 'INTAKE_COMPLETED'
  | 'HANDOFFED'
  | 'RECOMMEND_READY'
  | 'NOTIFIED'
  | 'CLOSED'
  | 'EXPIRED';

export interface Gift {
  id: string;
  sender_user_id: string;
  recipient_first_name?: string | null;
  occasion?: string | null;
  budget_min: number;
  budget_max: number;
  message_to_recipient?: string | null;
  status: GiftStatus;
  created_at: string;
  updated_at: string;
}

export interface GiftToken {
  gift_id: string;
  token_hash: string;
  expires_at: string;
  consumed_at?: string | null;
}

export interface GiftSession {
  id: string;
  gift_id: string;
  started_at: string;
  completed_at?: string | null;
  agent_trace_id?: string | null;
  intake_summary?: Record<string, unknown> | null;
  age_confirmed: boolean;
  created_at: string;
}

export interface GiftMessage {
  id: string;
  session_id: string;
  role: 'system' | 'assistant' | 'user';
  content: string;
  created_at: string;
}

export interface GiftRecommendation {
  gift_id: string;
  recommendations: unknown; // JSON structure from text worker
  model?: string | null;
  created_at: string;
}

export interface Notification {
  id: number;
  user_id: string;
  type: string;
  payload: Record<string, unknown>;
  created_at: string;
  read_at?: string | null;
}

export interface CreateGiftRequest {
  occasion?: string;
  recipientFirstName?: string;
  budgetMin: number;
  budgetMax: number;
  message?: string;
}

export interface CreateGiftResponse {
  giftId: string;
  shareUrl: string;
  lineShareUrl?: string;
}

export interface ValidateTokenResponse {
  valid: boolean;
  giftId?: string;
  sessionId?: string;
  error?: string;
}

export interface IntakeSummary {
  aroma?: string[];
  taste_profile?: string[];
  sweetness_dryness?: string;
  temperature_preference?: string[];
  food_pairing?: string[];
  drinking_frequency?: string;
  region_preference?: string[];
  notes?: string;
  /**
   * Flexible taste map assembled by the text agent.
   */
  preference_map?: PreferenceMap | null;
}

export interface GiftDashboardItem {
  id: string;
  recipientFirstName: string | null;
  occasion: string | null;
  budgetMin: number;
  budgetMax: number;
  messageToRecipient: string | null;
  status: GiftStatus;
  createdAt: string;
  updatedAt: string;
  intakeSummary: IntakeSummary | null;
  intakeCompletedAt: string | null;
  ageConfirmed: boolean;
  recommendation: PurchaseOffer | null;
  recommendationCreatedAt: string | null;
  recommendationModel: string | null;
}
