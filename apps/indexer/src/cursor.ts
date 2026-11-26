import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { QueryResultRow } from "pg";
import { Pool } from "pg";

const INDEXER_ID = "escrow";

interface CursorRow extends QueryResultRow {
  cursor: string;
}

let pool: Pool | undefined;

function getPool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  if (!pool) pool = new Pool({ connectionString: url, max: 5 });
  return pool;
}

function cursorFile(): string {
  const configured = process.env.INDEXER_CURSOR_FILE;
  const relative =
    configured && configured.trim() !== ""
      ? configured
      : ".data/indexer-cursor.json";
  return path.resolve(process.cwd(), relative);
}

function isPositiveInteger(value: number): boolean {
  return Number.isFinite(value) && Number.isInteger(value) && value > 0;
}

/**
 * Indexer cursor: shared PostgreSQL row when DATABASE_URL is set, otherwise the
 * legacy JSON file. Postgres makes the cursor survive restarts and multiple
 * indexer instances.
 */
export async function loadIndexerCursor(): Promise<number | undefined> {
  if (process.env.DATABASE_URL) {
    const result = await getPool().query<CursorRow>(
      "SELECT cursor FROM indexer_state WHERE id = $1",
      [INDEXER_ID],
    );
    const row = result.rows[0];
    if (!row) return undefined;
    const value = Number(row.cursor);
    return isPositiveInteger(value) ? value : undefined;
  }

  try {
    const raw = await readFile(cursorFile(), "utf8");
    const parsed = JSON.parse(raw) as { ledger?: unknown };
    if (typeof parsed.ledger === "number" && isPositiveInteger(parsed.ledger)) {
      return parsed.ledger;
    }
    return undefined;
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") return undefined;
    throw error;
  }
}

export async function saveIndexerCursor(ledger: number): Promise<void> {
  if (process.env.DATABASE_URL) {
    await getPool().query(
      `INSERT INTO indexer_state (id, cursor, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (id) DO UPDATE SET cursor = EXCLUDED.cursor, updated_at = now()`,
      [INDEXER_ID, ledger],
    );
    return;
  }

  const file = cursorFile();
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify({ ledger })}\n`, "utf8");
  await rename(temporary, file);
}

export function cursorBackend(): string {
  return process.env.DATABASE_URL ? "postgres" : `file:${cursorFile()}`;
}

export async function closeCursorStore(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
