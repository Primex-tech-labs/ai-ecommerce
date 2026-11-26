import { NextResponse } from "next/server";
import { createUser } from "@/lib/auth-repo";
import {
  SESSION_COOKIE,
  authEnabled,
  sessionCookieOptions,
  startSession,
} from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { clientIdentifier, rateLimit, tooManyRequests } from "@/lib/rate-limit";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 10;

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
  const limit = await rateLimit("auth:register", `${ip}|${email || "unknown"}`, 10, 3600);
  if (!limit.allowed) return tooManyRequests(limit);

  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    return NextResponse.json({ error: "enter a valid email address" }, { status: 400 });
  }
  if (password.length < MIN_PASSWORD_LENGTH || password.length > 200) {
    return NextResponse.json(
      { error: `password must be at least ${MIN_PASSWORD_LENGTH} characters` },
      { status: 400 },
    );
  }

  const passwordHash = await hashPassword(password);
  const user = await createUser(email, passwordHash);
  if (!user) {
    // Generic message so registration does not reveal whether an email exists.
    return NextResponse.json({ error: "could not create account" }, { status: 400 });
  }

  const sessionId = await startSession(user.id, {
    userAgent: request.headers.get("user-agent"),
    ip,
  });
  const response = NextResponse.json(
    { ok: true, user: { id: user.id, email: user.email } },
    { status: 201 },
  );
  response.cookies.set(SESSION_COOKIE, sessionId, sessionCookieOptions());
  return response;
}
