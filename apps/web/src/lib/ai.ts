import { AiClient } from "@repo/ai-client";

export const aiClient = new AiClient({
  baseUrl: process.env.AI_SERVICE_URL ?? "http://localhost:8000",
  apiKey: process.env.AI_SERVICE_API_KEY,
});
