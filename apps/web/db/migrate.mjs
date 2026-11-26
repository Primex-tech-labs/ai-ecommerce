#!/usr/bin/env node
/**
 * Minimal, dependency-free migration runner backed by PostgreSQL.
 *
 * Usage:
 *   node db/migrate.mjs up       # apply pending *.sql migrations
 *   node db/migrate.mjs down     # revert the most recently applied migration
 *   node db/migrate.mjs status   # list applied/pending migrations
 *
 * Migrations live in db/migrations as `<version>_<name>.sql` with an optional
 * `<version>_<name>.down.sql`. Applied versions are recorded in schema_migrations.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;
const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(here, "migrations");
const command = process.argv[2] ?? "up";

function databaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required to run migrations");
    process.exit(1);
  }
  return url;
}

async function migrationFiles() {
  const entries = await readdir(migrationsDir);
  return entries
    .filter((name) => name.endsWith(".sql") && !name.endsWith(".down.sql"))
    .sort();
}

async function ensureTable(client) {
  await client.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
  );
}

async function appliedVersions(client) {
  const result = await client.query("SELECT version FROM schema_migrations ORDER BY version");
  return result.rows.map((row) => row.version);
}

async function up(client) {
  await ensureTable(client);
  const applied = new Set(await appliedVersions(client));
  const files = await migrationFiles();
  let count = 0;
  for (const file of files) {
    const version = file.replace(/\.sql$/, "");
    if (applied.has(version)) continue;
    const sql = await readFile(path.join(migrationsDir, file), "utf8");
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [version]);
      await client.query("COMMIT");
      console.log(`applied ${version}`);
      count += 1;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
  console.log(count === 0 ? "no pending migrations" : `applied ${count} migration(s)`);
}

async function down(client) {
  await ensureTable(client);
  const applied = await appliedVersions(client);
  if (applied.length === 0) {
    console.log("nothing to roll back");
    return;
  }
  const version = applied[applied.length - 1];
  const downFile = `${version}.down.sql`;
  let sql;
  try {
    sql = await readFile(path.join(migrationsDir, downFile), "utf8");
  } catch {
    console.error(`missing ${downFile}; cannot roll back ${version}`);
    process.exit(1);
  }
  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query("DELETE FROM schema_migrations WHERE version = $1", [version]);
    await client.query("COMMIT");
    console.log(`rolled back ${version}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function status(client) {
  await ensureTable(client);
  const applied = await appliedVersions(client);
  const files = await migrationFiles();
  for (const file of files) {
    const version = file.replace(/\.sql$/, "");
    console.log(`${applied.includes(version) ? "[x]" : "[ ]"} ${version}`);
  }
}

const client = new Client({ connectionString: databaseUrl() });
await client.connect();
try {
  if (command === "up") await up(client);
  else if (command === "down") await down(client);
  else if (command === "status") await status(client);
  else {
    console.error(`unknown command: ${command}`);
    process.exitCode = 1;
  }
} finally {
  await client.end();
}
