import type { QueryResultRow } from "pg";
import { getPool } from "./db";

export interface AuthUser {
  id: string;
  email: string;
  role: "customer" | "admin";
}

interface UserRow extends QueryResultRow {
  id: string;
  email: string;
  role: string;
  password_hash?: string;
}

function toAuthUser(row: UserRow): AuthUser {
  return { id: row.id, email: row.email, role: row.role === "admin" ? "admin" : "customer" };
}

/** Insert a user; returns null when the email already exists (unique index). */
export async function createUser(
  email: string,
  passwordHash: string,
): Promise<AuthUser | null> {
  const result = await getPool().query<UserRow>(
    `INSERT INTO users (email, password_hash) VALUES ($1, $2)
     ON CONFLICT DO NOTHING
     RETURNING id, email, role`,
    [email, passwordHash],
  );
  const row = result.rows[0];
  return row ? toAuthUser(row) : null;
}

export async function findUserByEmail(
  email: string,
): Promise<{ user: AuthUser; passwordHash: string } | null> {
  const result = await getPool().query<UserRow>(
    "SELECT id, email, role, password_hash FROM users WHERE lower(email) = lower($1)",
    [email],
  );
  const row = result.rows[0];
  if (!row || typeof row.password_hash !== "string") return null;
  return { user: toAuthUser(row), passwordHash: row.password_hash };
}

export async function createSession(
  id: string,
  userId: string,
  expiresAt: Date,
  userAgent: string | null,
  ip: string | null,
): Promise<void> {
  await getPool().query(
    "INSERT INTO sessions (id, user_id, expires_at, user_agent, ip) VALUES ($1, $2, $3, $4, $5)",
    [id, userId, expiresAt, userAgent, ip],
  );
}

export async function findSessionUser(id: string): Promise<AuthUser | null> {
  const result = await getPool().query<UserRow>(
    `SELECT u.id, u.email, u.role
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id = $1 AND s.revoked_at IS NULL AND s.expires_at > now()`,
    [id],
  );
  const row = result.rows[0];
  return row ? toAuthUser(row) : null;
}

export async function revokeSession(id: string): Promise<void> {
  await getPool().query("UPDATE sessions SET revoked_at = now() WHERE id = $1", [id]);
}
