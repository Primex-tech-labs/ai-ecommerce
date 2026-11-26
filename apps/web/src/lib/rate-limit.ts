import type { QueryResultRow } from "pg";
import { getPool } from "./db";

interface CountRow extends QueryResultRow {
  count: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Derive a client identifier. Forwarded headers are only trusted when
 * TRUST_PROXY=1 (i.e. the app sits behind a trusted proxy that overwrites them).
 */
export function clientIdentifier(request: Request, fallback: string): string {
  if (process.env.TRUST_PROXY === "1") {
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim();
    if (ip) return `ip:${ip}`;
    const real = request.headers.get("x-real-ip");
    if (real) return `ip:${real.trim()}`;
  }
  return fallback;
}

/**
 * Fixed-window rate limit backed by PostgreSQL so it is shared across
 * instances. When DATABASE_URL is not set (local dev / e2e) it is a no-op.
 */
export async function rateLimit(
  name: string,
  identifier: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  if (!process.env.DATABASE_URL) {
    return { allowed: true, remaining: limit, retryAfterSeconds: 0 };
  }
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs);
  const bucket = `${name}:${identifier}`;
  const result = await getPool().query<CountRow>(
    `INSERT INTO rate_limits (bucket, window_start, count) VALUES ($1, $2, 1)
     ON CONFLICT (bucket, window_start) DO UPDATE SET count = rate_limits.count + 1
     RETURNING count`,
    [bucket, windowStart],
  );
  const count = result.rows[0]?.count ?? 1;
  const allowed = count <= limit;
  const retryAfterSeconds = allowed
    ? 0
    : Math.max(1, Math.ceil((windowStart.getTime() + windowMs - now) / 1000));
  return { allowed, remaining: Math.max(0, limit - count), retryAfterSeconds };
}

export function tooManyRequests(result: RateLimitResult): Response {
  return new Response(JSON.stringify({ error: "too many requests" }), {
    status: 429,
    headers: {
      "content-type": "application/json",
      "retry-after": String(result.retryAfterSeconds),
    },
  });
}
