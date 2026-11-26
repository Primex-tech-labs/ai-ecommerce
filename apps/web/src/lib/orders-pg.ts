import type { PoolClient, QueryResultRow } from "pg";
import { getPool } from "./db";
import type { Order, OrderEvent, OrderStatus } from "./orders";

const STATUS_RANK: Record<OrderStatus, number> = {
  created: 1,
  funded: 2,
  disputed: 3,
  released: 4,
  refunded: 4,
};

type OrderHashField =
  | "createTxHash"
  | "fundTxHash"
  | "disputeTxHash"
  | "releaseTxHash"
  | "refundTxHash";
const HASH_FIELDS: Record<OrderStatus, OrderHashField> = {
  created: "createTxHash",
  funded: "fundTxHash",
  disputed: "disputeTxHash",
  released: "releaseTxHash",
  refunded: "refundTxHash",
};

interface OrderRow extends QueryResultRow {
  id: string;
  buyer: string;
  seller: string;
  token: string;
  escrow_contract_id: string;
  status: string;
  status_rank: number;
  ledger: string;
  amount_stroops: string;
  updated_at: Date;
  create_tx_hash: string | null;
  fund_tx_hash: string | null;
  dispute_tx_hash: string | null;
  release_tx_hash: string | null;
  refund_tx_hash: string | null;
}

interface OwnerRow extends QueryResultRow {
  owner_id: string | null;
}

function rowToOrder(row: OrderRow): Order {
  return {
    orderId: row.id,
    buyer: row.buyer,
    seller: row.seller,
    token: row.token,
    amount: row.amount_stroops,
    status: row.status as OrderStatus,
    ledger: Number(row.ledger),
    escrowContractId: row.escrow_contract_id,
    updatedAt: new Date(row.updated_at).toISOString(),
    createTxHash: row.create_tx_hash ?? undefined,
    fundTxHash: row.fund_tx_hash ?? undefined,
    disputeTxHash: row.dispute_tx_hash ?? undefined,
    releaseTxHash: row.release_tx_hash ?? undefined,
    refundTxHash: row.refund_tx_hash ?? undefined,
  };
}

function shouldApplyEvent(existing: Order, event: OrderEvent): boolean {
  if (event.ledger < existing.ledger) return false;
  return STATUS_RANK[event.type] > STATUS_RANK[existing.status];
}

function isValidAmount(amount: string | undefined): boolean {
  if (amount === undefined || amount === "") return true;
  return /^\d+$/.test(amount) && BigInt(amount) > BigInt(0);
}

const UPSERT_SQL = `
INSERT INTO orders (
  id, buyer, seller, token, escrow_contract_id, status, status_rank, ledger, amount_stroops,
  create_tx_hash, fund_tx_hash, dispute_tx_hash, release_tx_hash, refund_tx_hash, updated_at
) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14, now())
ON CONFLICT (id) DO UPDATE SET
  buyer = EXCLUDED.buyer,
  seller = EXCLUDED.seller,
  token = EXCLUDED.token,
  escrow_contract_id = EXCLUDED.escrow_contract_id,
  status = EXCLUDED.status,
  status_rank = EXCLUDED.status_rank,
  ledger = EXCLUDED.ledger,
  amount_stroops = EXCLUDED.amount_stroops,
  create_tx_hash = EXCLUDED.create_tx_hash,
  fund_tx_hash = EXCLUDED.fund_tx_hash,
  dispute_tx_hash = EXCLUDED.dispute_tx_hash,
  release_tx_hash = EXCLUDED.release_tx_hash,
  refund_tx_hash = EXCLUDED.refund_tx_hash,
  updated_at = now()`;

function orderParams(order: Order): unknown[] {
  return [
    order.orderId,
    order.buyer,
    order.seller,
    order.token,
    order.escrowContractId,
    order.status,
    STATUS_RANK[order.status],
    order.ledger,
    order.amount === "" ? "0" : order.amount,
    order.createTxHash ?? null,
    order.fundTxHash ?? null,
    order.disputeTxHash ?? null,
    order.releaseTxHash ?? null,
    order.refundTxHash ?? null,
  ];
}

async function persist(client: PoolClient, order: Order): Promise<void> {
  await client.query(UPSERT_SQL, orderParams(order));
}

export async function getOrder(orderId: string): Promise<Order | null> {
  const result = await getPool().query<OrderRow>("SELECT * FROM orders WHERE id = $1", [orderId]);
  const row = result.rows[0];
  return row ? rowToOrder(row) : null;
}

export async function listOrders(): Promise<Order[]> {
  const result = await getPool().query<OrderRow>(
    "SELECT * FROM orders ORDER BY updated_at DESC, id ASC",
  );
  return result.rows.map(rowToOrder);
}

export async function listOrdersByOwner(
  ownerId: string,
  options: { limit?: number; offset?: number } = {},
): Promise<Order[]> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const offset = Math.max(options.offset ?? 0, 0);
  const result = await getPool().query<OrderRow>(
    "SELECT * FROM orders WHERE owner_id = $1 ORDER BY updated_at DESC LIMIT $2 OFFSET $3",
    [ownerId, limit, offset],
  );
  return result.rows.map(rowToOrder);
}

export async function updateOrder(
  orderId: string,
  update: Partial<Omit<Order, "orderId">> | ((order: Order) => Order),
): Promise<Order | null> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<OrderRow>(
      "SELECT * FROM orders WHERE id = $1 FOR UPDATE",
      [orderId],
    );
    const row = result.rows[0];
    if (!row) {
      await client.query("COMMIT");
      return null;
    }
    const existing = rowToOrder(row);
    const changed =
      typeof update === "function" ? update(existing) : { ...existing, ...update };
    const order: Order = {
      ...changed,
      orderId,
      updatedAt: new Date().toISOString(),
    };
    await persist(client, order);
    await client.query("COMMIT");
    return order;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function upsertFromEvent(event: OrderEvent): Promise<Order> {
  if (!isValidAmount(event.amount)) {
    throw new Error(`invalid event amount for order ${event.orderId}`);
  }

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<OrderRow>(
      "SELECT * FROM orders WHERE id = $1 FOR UPDATE",
      [event.orderId],
    );
    const existing = result.rows[0] ? rowToOrder(result.rows[0]) : null;

    if (existing && !shouldApplyEvent(existing, event)) {
      await client.query("COMMIT");
      return existing;
    }

    const order: Order = {
      ...(existing ?? {}),
      orderId: event.orderId,
      buyer: event.buyer ?? existing?.buyer ?? "",
      seller: event.seller ?? existing?.seller ?? "",
      token: event.token ?? existing?.token ?? "",
      amount: event.amount ?? existing?.amount ?? "",
      status: event.type,
      ledger: event.ledger,
      escrowContractId:
        event.escrowContractId ??
        existing?.escrowContractId ??
        process.env.ESCROW_CONTRACT_ID ??
        "",
      updatedAt: new Date().toISOString(),
    };

    if (event.txHash) {
      order[HASH_FIELDS[event.type]] = event.txHash;
    }

    await persist(client, order);

    if (event.txHash) {
      await client.query(
        "INSERT INTO payments (order_id, kind, tx_hash, ledger) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING",
        [order.orderId, event.type, event.txHash, event.ledger],
      );
    }

    if (event.type === "disputed") {
      await client.query(
        "INSERT INTO disputes (order_id, status) VALUES ($1,'open') ON CONFLICT (order_id) DO NOTHING",
        [order.orderId],
      );
    } else if (event.type === "released" || event.type === "refunded") {
      const resolved = event.type === "released" ? "resolved_seller" : "resolved_buyer";
      await client.query(
        "UPDATE disputes SET status = $2, resolved_tx_hash = COALESCE($3, resolved_tx_hash), resolved_at = now() WHERE order_id = $1 AND status = 'open'",
        [order.orderId, resolved, event.txHash ?? null],
      );
    }

    await client.query("COMMIT");
    return order;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export interface ClaimOrderInput {
  buyer: string;
  seller: string;
  token: string;
  arbiter?: string;
  escrowContractId: string;
  amountStroops: string;
}

/**
 * Bind an order id to the authenticated owner. Creates a pending order row if
 * none exists yet; refuses to hand an existing order to a different user.
 */
export async function claimOrderOwner(
  orderId: string,
  ownerId: string,
  input: ClaimOrderInput,
): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query<OwnerRow>(
      "SELECT owner_id FROM orders WHERE id = $1 FOR UPDATE",
      [orderId],
    );
    const row = existing.rows[0];
    if (row) {
      if (row.owner_id && row.owner_id !== ownerId) {
        throw new Error("order belongs to another user");
      }
      if (!row.owner_id) {
        await client.query(
          "UPDATE orders SET owner_id = $2, updated_at = now() WHERE id = $1",
          [orderId, ownerId],
        );
      }
    } else {
      await client.query(
        `INSERT INTO orders (id, owner_id, buyer, seller, arbiter, token, escrow_contract_id, status, status_rank, ledger, amount_stroops)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'created',1,0,$8)`,
        [
          orderId,
          ownerId,
          input.buyer,
          input.seller,
          input.arbiter ?? null,
          input.token,
          input.escrowContractId,
          input.amountStroops,
        ],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
