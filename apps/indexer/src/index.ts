import { createHmac } from "node:crypto";
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
let cursor: number | undefined =
  configuredStart !== undefined && configuredStart !== "" ? Number(configuredStart) : undefined;

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
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body,
    });
    if (!response.ok) {
      console.error("webhook delivery failed", response.status);
    }
  } catch (error) {
    console.error("webhook delivery failed", error);
  }
}

async function tick(): Promise<void> {
  try {
    if (cursor === undefined) {
      const latest = await getLatestLedger(config);
      cursor = Math.max(1, latest - 100);
    }

    const events = await fetchEscrowEvents(config, { startLedger: cursor, limit: 100 });
    for (const event of events) {
      await deliver({ ts: new Date().toISOString(), ...event });
      cursor = Math.max(cursor, event.ledger + 1);
    }

    // With no events the cursor would otherwise stay pinned to the same ledger
    // forever and re-scan it on every tick.
    if (events.length === 0) {
      const latest = await getLatestLedger(config);
      cursor = Math.max(cursor, latest + 1);
    }
  } catch (error) {
    console.error("indexer tick failed", error);
  }
}

if (!config.escrowContractId) {
  console.error("ESCROW_CONTRACT_ID is required to run the indexer");
  process.exit(1);
}

console.log(
  JSON.stringify({
    ts: new Date().toISOString(),
    msg: "indexer starting",
    network: config.name,
    escrowContractId: config.escrowContractId,
    pollMs,
  }),
);

if (webhookUrl && !webhookSecret) {
  console.warn(
    "ORDERS_WEBHOOK_SECRET is not set: sending unsigned order webhooks (development only)",
  );
}

void tick();
setInterval(() => void tick(), pollMs);
