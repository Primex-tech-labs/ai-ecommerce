export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  context?: {
    productIds?: string[];
    cartVariantIds?: string[];
  };
}

export interface ChatReply {
  message: ChatMessage;
  provider: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

export interface RecommendationRequest {
  productId?: string;
  userId?: string;
  query?: string;
  limit?: number;
}

export interface Recommendation {
  productId: string;
  score: number;
  reason: string;
}

export interface SearchRequest {
  query: string;
  limit?: number;
}

export interface SearchHit {
  productId: string;
  score: number;
}

export interface HealthStatus {
  status: string;
  provider: string;
  model: string;
}
