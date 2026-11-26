import { Pool } from "pg";

let pool: Pool | undefined;

/**
 * Lazily create a shared PostgreSQL pool. Throws if DATABASE_URL is missing so
 * server routes fail clearly rather than silently falling back in production.
 */
export function getPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  if (!pool) {
    pool = new Pool({ connectionString, max: 10 });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
