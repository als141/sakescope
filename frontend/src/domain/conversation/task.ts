export type AgentTaskType =
  | 'purchase_lookup'
  | 'sake_detail_enrichment';

export type AgentTaskStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed';

export interface AgentTaskTicket<TPayload = unknown, TResult = unknown> {
  id: string;
  type: AgentTaskType;
  status: AgentTaskStatus;
  payload: TPayload;
  result?: TResult;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export interface PurchaseLookupPayload {
  sakeId: string;
  urgency?: 'immediate' | 'standard';
}

export interface PurchaseLookupResult {
  retailer: string;
  url: string;
  price: number;
  currency: string;
  stockStatus: 'in_stock' | 'limited' | 'out_of_stock';
  estimatedDelivery?: string;
}
