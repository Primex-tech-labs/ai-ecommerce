import { createHmac } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fetchEscrowEvents, getLatestLedger, resolveConfig } from "@repo/stellar";

const config = resolveConfig({
  STELLAR_NETWORK: process.env.STELLAR_NETWORK,
  STELLAR_RPC_URL: process.env.STELLAR_RPC_URL,
  STELLAR_HORIZON_URL: process.env.STELLAR_HORIZON_URL,
  STELLAR_NETWORK_PASSPHRASE: process.env.STELLAR_NETWORK_PASSPHRASE,
  ESCROW_CONTRACT_ID: process.env.ESCROW_CONTRACT_ID,
});

const pollMs = Number(process.env.INDEXER_POLL_MS ?? "5000");
const webhookUrl = process.env.ORDERS_WEBHOOK_URL;
const webhookSecret = process.env.ORDERS_WEBHOOK_SECRET;
const configuredStart = process.env.INDEXER_START_LEDGER;

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

async function loadCursor(): Promise<number | undefined> {
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

async function saveCursor(ledger: number): Promise<void> {
  const file = cursorFile();
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify({ ledger })}\n`, "utf8");
  await rename(temporary, file);
}

/**
 * Deliver an event to the order webhook. Throws on failure so the tick does not
 * advance the cursor past an undelivered event; the next tick retries it.
 */
async function deliver(record: unknown): Promise<void> {
  console.log(JSON.stringify(record));
  if (!webhookUrl) return;
  const body = JSON.stringify(record);
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (webhookSecret) {
    headers["x-indexer-signature"] = createHmac("sha256", webhookSecret)
      .update(body, "utf8")
      .digest("hex");
  }
  const response = await fetch(webhookUrl, { method: "POST", headers, body });
  if (!response.ok) {
    throw new Error(`webhook delivery failed: ${response.status}`);
  }
}

let cursor: number | undefined;

async function initialCursor(): Promise<number> {
  const persisted = await loadCursor();
  if (persisted !== undefined) return persisted;

  if (configuredStart !== undefined && configuredStart !== "") {
    const start = Number(configuredStart);
    if (isPositiveInteger(start)) return start;
  }

  const latest = await getLatestLedger(config);
  return Math.max(1, latest - 100);
}

async function tick(): Promise<void> {
  let current = cursor;
  if (current === undefined) {
    current = await initialCursor();
    cursor = current;
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        msg: "indexer cursor initialised",
        cursor: current,
      }),
    );
  }

  const events = await fetchEscrowEvents(config, {
    startLedger: current,
    limit: 100,
  });

  // Process in ledger order so cursor advancement is monotonic.
  const ordered = [...events].sort((left, right) => left.ledger - right.ledger);

  for (const event of ordered) {
    await deliver({ ts: new Date().toISOString(), ...event });
    current = Math.max(current, event.ledger + 1);
    cursor = current;
    await saveCursor(current);
  }

  if (ordered.length === 0) {
    // No events: advance to the current ledger (not +1) so a delayed event for
    // that ledger is still picked up on the next tick.
    const latest = await getLatestLedger(config);
    current = Math.max(current, latest);
    cursor = current;
    await saveCursor(current);
  }
}

async function main(): Promise<void> {
  if (!config.escrowContractId) {
    console.error("ESCROW_CONTRACT_ID is required to run the indexer");
    process.exit(1);
  }

  if (webhookUrl && !webhookSecret) {
    if (process.env.NODE_ENV === "production") {
      console.error("ORDERS_WEBHOOK_SECRET is required in production");
      process.exit(1);
    }
    console.warn(
      "ORDERS_WEBHOOK_SECRET is not set: sending unsigned order webhooks (development only)",
    );
  }

  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      msg: "indexer starting",
      network: config.name,
      escrowContractId: config.escrowContractId,
      pollMs,
      cursorFile: cursorFile(),
    }),
  );

  await tick().catch((error) => console.error("indexer tick failed", error));
  setInterval(() => {
    void tick().catch((error) => console.error("indexer tick failed", error));
  }, pollMs);
}

void main();
