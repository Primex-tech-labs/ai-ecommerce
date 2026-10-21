import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  getOrder,
  listOrders,
  updateOrder,
  upsertFromEvent,
  type OrderEvent,
} from "./orders";

let directory: string;
let file: string;
const previousOrdersFile = process.env.ORDERS_FILE;
const previousContractId = process.env.ESCROW_CONTRACT_ID;

function event(overrides: Partial<OrderEvent> = {}): OrderEvent {
  return {
    id: "event-1",
    ledger: 100,
    type: "created",
    orderId: "order_1",
    buyer: "GBUYER",
    seller: "GSELLER",
    token: "CTOKEN",
    amount: "10000000",
    ...overrides,
  };
}

beforeAll(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), "primex-orders-"));
  file = path.join(directory, "nested", "orders.json");
  process.env.ORDERS_FILE = file;
  process.env.ESCROW_CONTRACT_ID = "CESCROW";
});

beforeEach(async () => {
  await rm(file, { force: true });
});

afterAll(async () => {
  await rm(directory, { recursive: true, force: true });
  if (previousOrdersFile === undefined) delete process.env.ORDERS_FILE;
  else process.env.ORDERS_FILE = previousOrdersFile;
  if (previousContractId === undefined) delete process.env.ESCROW_CONTRACT_ID;
  else process.env.ESCROW_CONTRACT_ID = previousContractId;
});

describe("order store", () => {
  it("creates an order from the created event and persists it", async () => {
    const order = await upsertFromEvent(event());

    expect(order).toMatchObject({
      orderId: "order_1",
      buyer: "GBUYER",
      seller: "GSELLER",
      token: "CTOKEN",
      amount: "10000000",
      status: "created",
      ledger: 100,
      escrowContractId: "CESCROW",
    });

    const persisted = JSON.parse(await readFile(file, "utf8")) as {
      orders: Record<string, unknown>;
    };
    expect(persisted.orders.order_1).toMatchObject({ status: "created" });
    await expect(getOrder("order_1")).resolves.toMatchObject({ status: "created" });
  });

  it("upserts status transitions without losing buyer/seller data", async () => {
    await upsertFromEvent(event());
    await upsertFromEvent(
      event({
        id: "event-2",
        ledger: 101,
        type: "funded",
        buyer: undefined,
        seller: undefined,
        token: undefined,
        amount: undefined,
      }),
    );
    const released = await upsertFromEvent(
      event({ id: "event-3", ledger: 102, type: "released", txHash: "0xrelease" }),
    );

    expect(released).toMatchObject({
      status: "released",
      ledger: 102,
      buyer: "GBUYER",
      seller: "GSELLER",
      token: "CTOKEN",
      amount: "10000000",
      releaseTxHash: "0xrelease",
    });
    expect(await listOrders()).toHaveLength(1);
  });

  it("returns null for an unknown order", async () => {
    await expect(getOrder("missing")).resolves.toBeNull();
    await expect(updateOrder("missing", { status: "released" })).resolves.toBeNull();
  });

  it("updates an existing order", async () => {
    await upsertFromEvent(event());
    const updated = await updateOrder("order_1", (order) => ({
      ...order,
      status: "refunded",
    }));
    expect(updated).toMatchObject({ status: "refunded" });
    await expect(getOrder("order_1")).resolves.toMatchObject({ status: "refunded" });
  });

  it("serialises concurrent writes instead of losing updates", async () => {
    await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        upsertFromEvent(
          event({
            id: `event-${index}`,
            orderId: `order_${index}`,
          }),
        ),
      ),
    );

    const orders = await listOrders();
    expect(orders).toHaveLength(10);
    expect(new Set(orders.map((order) => order.orderId)).size).toBe(10);
  });
});
