import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  revokeCurrentSession,
  sessionCookieOptions,
} from "@/lib/auth";

export async function POST() {
  await revokeCurrentSession();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", {
    ...sessionCookieOptions(),
    maxAge: 0,
  });
  return response;
}
