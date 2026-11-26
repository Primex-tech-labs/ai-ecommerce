import { NextResponse } from "next/server";
import { findUserByEmail } from "@/lib/auth-repo";
import {
  SESSION_COOKIE,
  authEnabled,
  sessionCookieOptions,
  startSession,
} from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { clientIdentifier, rateLimit, tooManyRequests } from "@/lib/rate-limit";

export async function POST(request: Request) {
  if (!authEnabled()) {
    return NextResponse.json(
      { error: "authentication is not configured" },
      { status: 503 },
    );
  }

  let body: { email?: unknown; password?: unknown };
  try {
    body = (await request.json()) as { email?: unknown; password?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const ip = clientIdentifier(request, "anon");

  const limit = await rateLimit("auth:login", `${ip}|${email || "unknown"}`, 10, 900);
  if (!limit.allowed) return tooManyRequests(limit);

  const record = await findUserByEmail(email);
  const valid = record ? await verifyPassword(password, record.passwordHash) : false;
  if (!record || !valid) {
    // Generic error: do not reveal whether the account exists.
    return NextResponse.json({ error: "invalid email or password" }, { status: 401 });
  }

  const sessionId = await startSession(record.user.id, {
    userAgent: request.headers.get("user-agent"),
    ip,
  });
  const response = NextResponse.json({
    ok: true,
    user: { id: record.user.id, email: record.user.email },
  });
  response.cookies.set(SESSION_COOKIE, sessionId, sessionCookieOptions());
  return response;
}
