import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import {
  createSession,
  findSessionUser,
  revokeSession,
  type AuthUser,
} from "./auth-repo";

export const SESSION_COOKIE = "primex_session";
export const SESSION_TTL_SECONDS = Number(process.env.SESSION_TTL_SECONDS ?? "604800");

/** Authentication is only available when a database is configured. */
export function authEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_SECONDS,
  };
}

export async function startSession(
  userId: string,
  meta: { userAgent?: string | null; ip?: string | null },
): Promise<string> {
  const id = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  await createSession(id, userId, expiresAt, meta.userAgent ?? null, meta.ip ?? null);
  return id;
}

export async function getSessionUser(): Promise<AuthUser | null> {
  if (!authEnabled()) return null;
  const id = cookies().get(SESSION_COOKIE)?.value;
  if (!id) return null;
  return findSessionUser(id);
}

export async function currentSessionId(): Promise<string | null> {
  return cookies().get(SESSION_COOKIE)?.value ?? null;
}

export async function revokeCurrentSession(): Promise<void> {
  const id = await currentSessionId();
  if (id) await revokeSession(id);
}
