#!/usr/bin/env node
/**
 * Import the legacy JSON order store into PostgreSQL.
 *
 * Usage (from apps/web):
 *   ORDERS_FILE=.data/orders.json DATABASE_URL=... node db/import-orders.mjs [--dry-run] [--file path]
 *
 * The import is idempotent: existing order ids are skipped (ON CONFLICT DO NOTHING).
 * Always back up the JSON file before running this.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const { Client } = pg;
const STATUSES = new Set(["created", "funded", "disputed", "released", "refunded"]);
const RANK = { created: 1, funded: 2, disputed: 3, released: 4, refunded: 4 };
const HASH_FIELDS = {
  created: "createTxHash",
  funded: "fundTxHash",
  disputed: "disputeTxHash",
  released: "releaseTxHash",
  refunded: "refundTxHash",
};

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const fileArgIndex = args.indexOf("--file");
const configuredFile =
  fileArgIndex >= 0 ? args[fileArgIndex + 1] : process.env.ORDERS_FILE ?? ".data/orders.json";
const ordersFile = path.resolve(process.cwd(), configuredFile);

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

function isAmount(value) {
  return typeof value === "string" && (/^\d+$/.test(value) || value === "");
}

async function loadOrders() {
  const raw = await readFile(ordersFile, "utf8");
  const parsed = JSON.parse(raw);
  const orders = parsed?.orders;
  if (!orders || typeof orders !== "object") {
    throw new Error(`no orders found in ${ordersFile}`);
  }
  return Object.entries(orders);
}

function validate(orderId, order) {
  if (!isNonEmptyString(orderId)) throw new Error("order has empty id");
  if (!order || typeof order !== "object") throw new Error(`order ${orderId} is not an object`);
  if (!STATUSES.has(order.status)) throw new Error(`order ${orderId} has invalid status ${order.status}`);
  if (!isNonEmptyString(order.buyer)) throw new Error(`order ${orderId} missing buyer`);
  if (!isNonEmptyString(order.seller)) throw new Error(`order ${orderId} missing seller`);
  if (!isAmount(order.amount)) throw new Error(`order ${orderId} has invalid amount`);
  if (!Number.isInteger(order.ledger)) throw new Error(`order ${orderId} has invalid ledger`);
}

const entries = await loadOrders();
for (const [orderId, order] of entries) validate(orderId, order);

if (dryRun) {
  console.log(`dry run: ${entries.length} valid order(s) in ${ordersFile}`);
  process.exit(0);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const client = new Client({ connectionString: url });
await client.connect();
let imported = 0;
let skipped = 0;

try {
  await client.query("BEGIN");
  for (const [orderId, order] of entries) {
    const inserted = await client.query(
      `INSERT INTO orders (id, buyer, seller, token, escrow_contract_id, status, status_rank, ledger, amount_stroops,
         create_tx_hash, fund_tx_hash, dispute_tx_hash, release_tx_hash, refund_tx_hash, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14, COALESCE($15::timestamptz, now()))
       ON CONFLICT (id) DO NOTHING
       RETURNING id`,
      [
        orderId,
        order.buyer,
        order.seller,
        typeof order.token === "string" ? order.token : "",
        typeof order.escrowContractId === "string" ? order.escrowContractId : "",
        order.status,
        RANK[order.status],
        order.ledger,
        order.amount === "" ? "0" : order.amount,
        order.createTxHash ?? null,
        order.fundTxHash ?? null,
        order.disputeTxHash ?? null,
        order.releaseTxHash ?? null,
        order.refundTxHash ?? null,
        typeof order.updatedAt === "string" ? order.updatedAt : null,
      ],
    );

    if (inserted.rowCount === 0) {
      skipped += 1;
      continue;
    }
    imported += 1;

    for (const status of Object.keys(HASH_FIELDS)) {
      const field = HASH_FIELDS[status];
      const hash = order[field];
      if (typeof hash === "string" && hash !== "") {
        await client.query(
          "INSERT INTO payments (order_id, kind, tx_hash, ledger) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING",
          [orderId, status, hash, order.ledger],
        );
      }
    }
    if (order.status === "disputed") {
      await client.query(
        "INSERT INTO disputes (order_id, status) VALUES ($1,'open') ON CONFLICT (order_id) DO NOTHING",
        [orderId],
      );
    }
  }
  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}

console.log(`imported ${imported}, skipped ${skipped} (source: ${ordersFile})`);
