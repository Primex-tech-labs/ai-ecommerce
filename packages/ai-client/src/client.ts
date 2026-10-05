import type {
  ChatReply,
  ChatRequest,
  HealthStatus,
  Recommendation,
  RecommendationRequest,
  SearchHit,
  SearchRequest,
} from "./types";

export interface AiClientOptions {
  baseUrl: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
}

export class AiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AiClientError";
  }
}

export class AiClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: AiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.apiKey = options.apiKey;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  chat(request: ChatRequest): Promise<ChatReply> {
    return this.post<ChatReply>("/assistant/chat", request);
  }

  recommend(request: RecommendationRequest): Promise<Recommendation[]> {
    return this.post<Recommendation[]>("/recommendations", request);
  }

  semanticSearch(request: SearchRequest): Promise<SearchHit[]> {
    return this.post<SearchHit[]>("/search/semantic", request);
  }

  health(): Promise<HealthStatus> {
    return this.get<HealthStatus>("/health");
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    return this.parse<T>(response);
  }

  private async get<T>(path: string): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      headers: this.headers(),
    });
    return this.parse<T>(response);
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (this.apiKey) headers.authorization = `Bearer ${this.apiKey}`;
    return headers;
  }

  private async parse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const detail = await response.text().catch(() => response.statusText);
      throw new AiClientError(detail || "AI service request failed", response.status);
    }
    return (await response.json()) as T;
  }
}
