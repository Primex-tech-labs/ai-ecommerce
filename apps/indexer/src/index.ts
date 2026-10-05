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
let cursor: number | undefined =
  process.env.INDEXER_START_LEDGER && Number(process.env.INDEXER_START_LEDGER) > 0
    ? Number(process.env.INDEXER_START_LEDGER)
    : undefined;

async function tick(): Promise<void> {
  try {
    if (cursor === undefined) {
      const latest = await getLatestLedger(config);
      cursor = Math.max(1, latest - 100);
    }
    const events = await fetchEscrowEvents(config, { startLedger: cursor, limit: 100 });
    for (const event of events) {
      const record = { ts: new Date().toISOString(), ...event };
      console.log(JSON.stringify(record));
      if (webhookUrl) {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(record),
        }).catch((error: unknown) => {
          console.error("webhook delivery failed", error);
        });
      }
      cursor = Math.max(cursor, event.ledger + 1);
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

void tick();
setInterval(() => void tick(), pollMs);
