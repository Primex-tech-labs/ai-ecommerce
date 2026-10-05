import type { ChatRequest } from "@repo/ai-client";
import { NextResponse } from "next/server";
import { aiClient } from "@/lib/ai";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ChatRequest;
    const reply = await aiClient.chat(body);
    return NextResponse.json(reply);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 502 },
    );
  }
}
