import type { ChatRequest } from "@repo/ai-client";
import { NextResponse } from "next/server";
import { aiClient } from "@/lib/ai";
import { getSessionUser } from "@/lib/auth";
import { clientIdentifier, rateLimit, tooManyRequests } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const user = await getSessionUser();
  const identifier = user ? `user:${user.id}` : clientIdentifier(request, "anon");
  const limit = await rateLimit("ai:assistant", identifier, 30, 60);
  if (!limit.allowed) return tooManyRequests(limit);

  try {
    const body = (await request.json()) as ChatRequest;
    const reply = await aiClient.chat(body);
    return NextResponse.json(reply);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
