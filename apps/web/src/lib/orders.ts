import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export type OrderStatus = "created" | "funded" | "released" | "refunded";

export interface Order {
  orderId: string;
  buyer: string;
  seller: string;
  token: string;
  amount: string;
  status: OrderStatus;
  ledger: number;
  escrowContractId: string;
  updatedAt: string;
  createTxHash?: string;
  fundTxHash?: string;
  releaseTxHash?: string;
  refundTxHash?: string;
}

export interface OrderEvent {
  id: string;
  ledger: number;
  type: OrderStatus;
  orderId: string;
  buyer?: string;
  seller?: string;
  token?: string;
  amount?: string;
  escrowContractId?: string;
  txHash?: string;
}

interface OrderFile {
  orders: Record<string, Order>;
}

const DEFAULT_ORDERS_FILE = ".data/orders.json";
type OrderHashField =
  | "createTxHash"
  | "fundTxHash"
  | "releaseTxHash"
  | "refundTxHash";
const HASH_FIELDS: Record<OrderStatus, OrderHashField> = {
  created: "createTxHash",
  funded: "fundTxHash",
  released: "releaseTxHash",
  refunded: "refundTxHash",
};

// Forward-only lifecycle. A re-delivered or out-of-order event must never move an
// order backwards (e.g. a duplicate `funded` after `released`).
const STATUS_RANK: Record<OrderStatus, number> = {
  created: 1,
  funded: 2,
  released: 3,
  refunded: 3,
};

let writeQueue: Promise<unknown> = Promise.resolve();

function withLock<T>(task: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(task, task);
  writeQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function ordersFile(): string {
  const configured = process.env.ORDERS_FILE;
  const relative =
    configured && configured.trim() !== "" ? configured : DEFAULT_ORDERS_FILE;
  return path.resolve(process.cwd(), relative);
}

async function readStore(): Promise<OrderFile> {
  try {
    const raw = await readFile(ordersFile(), "utf8");
    const parsed = JSON.parse(raw) as Partial<OrderFile>;
    return { orders: parsed.orders ?? {} };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { orders: {} };
    }
    throw error;
  }
}

async function writeStore(store: OrderFile): Promise<void> {
  const file = ordersFile();
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  await rename(temporary, file);
}

/**
 * Returns true when an event should move the order forward. Duplicate events,
 * regressions (`funded` after `released`) and events older than the stored
 * ledger are ignored so the indexer can safely re-deliver them.
 */
function shouldApplyEvent(existing: Order, event: OrderEvent): boolean {
  if (event.ledger < existing.ledger) return false;
  return STATUS_RANK[event.type] > STATUS_RANK[existing.status];
}

/** Escrow amounts are integer base units (stroops). Reject anything else. */
function isValidAmount(amount: string | undefined): boolean {
  if (amount === undefined || amount === "") return true;
  return /^\d+$/.test(amount) && BigInt(amount) > BigInt(0);
}

export async function getOrder(orderId: string): Promise<Order | null> {
  const store = await readStore();
  return store.orders[orderId] ?? null;
}

export async function listOrders(): Promise<Order[]> {
  const store = await readStore();
  return Object.values(store.orders).sort((left, right) => {
    const byUpdated = right.updatedAt.localeCompare(left.updatedAt);
    return byUpdated !== 0 ? byUpdated : left.orderId.localeCompare(right.orderId);
  });
}

export async function updateOrder(
  orderId: string,
  update: Partial<Omit<Order, "orderId">> | ((order: Order) => Order),
): Promise<Order | null> {
  return withLock(async () => {
    const store = await readStore();
    const existing = store.orders[orderId];
    if (!existing) return null;

    const changed =
      typeof update === "function"
        ? update(existing)
        : { ...existing, ...update };
    const order: Order = {
      ...changed,
      orderId,
      updatedAt: new Date().toISOString(),
    };
    store.orders[orderId] = order;
    await writeStore(store);
    return order;
  });
}

export async function upsertFromEvent(event: OrderEvent): Promise<Order> {
  if (!isValidAmount(event.amount)) {
    throw new Error(`invalid event amount for order ${event.orderId}`);
  }

  return withLock(async () => {
    const store = await readStore();
    const existing = store.orders[event.orderId];

    // Idempotent: ignore duplicates, regressions and stale events.
    if (existing && !shouldApplyEvent(existing, event)) {
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

    store.orders[event.orderId] = order;
    await writeStore(store);
    return order;
  });
}
