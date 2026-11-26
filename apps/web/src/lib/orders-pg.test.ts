import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPool } from "./db";
import { getOrder, listOrders, updateOrder, upsertFromEvent } from "./orders-pg";
import type { OrderEvent } from "./orders";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const suite = hasDatabase ? describe : describe.skip;

// These tests run only when DATABASE_URL is set (CI / local Postgres).
// The schema must be migrated first (pnpm --filter @repo/web db:migrate).
suite("postgres order repository", () => {
  const created: string[] = [];
  let sequence = 0;

  function id(): string {
    sequence += 1;
    const value = `pg-${Date.now()}-${process.pid}-${sequence}`;
    created.push(value);
    return value;
  }

  function event(overrides: Partial<OrderEvent> & { orderId: string }): OrderEvent {
    return {
      id: `evt-${Math.random().toString(36).slice(2)}`,
      ledger: 100,
      type: "created",
      buyer: "GBUYER",
      seller: "GSELLER",
      token: "CTOKEN",
      amount: "10000000",
      ...overrides,
    };
  }

  beforeAll(async () => {
    await getPool().query("SELECT 1");
  });

  afterAll(async () => {
    if (created.length > 0) {
      await getPool().query("DELETE FROM orders WHERE id = ANY($1)", [created]);
    }
  });

  it("persists an order created from an event", async () => {
    const orderId = id();
    const order = await upsertFromEvent(event({ orderId }));

    expect(order).toMatchObject({
      orderId,
      buyer: "GBUYER",
      seller: "GSELLER",
      status: "created",
      ledger: 100,
    });
    await expect(getOrder(orderId)).resolves.toMatchObject({ status: "created" });
    expect((await listOrders()).some((row) => row.orderId === orderId)).toBe(true);
  });

  it("is forward-only and ignores duplicates/regressions", async () => {
    const orderId = id();
    await upsertFromEvent(event({ orderId }));
    await upsertFromEvent(event({ orderId, ledger: 101, type: "funded" }));
    await upsertFromEvent(event({ orderId, ledger: 102, type: "released" }));

    const regression = await upsertFromEvent(event({ orderId, ledger: 103, type: "funded" }));
    expect(regression).toMatchObject({ status: "released", ledger: 102 });

    const refundAfterRelease = await upsertFromEvent(
      event({ orderId, ledger: 104, type: "refunded" }),
    );
    expect(refundAfterRelease).toMatchObject({ status: "released" });
  });

  it("records disputes and resolution atomically", async () => {
    const orderId = id();
    await upsertFromEvent(event({ orderId }));
    await upsertFromEvent(event({ orderId, ledger: 101, type: "funded" }));
    await upsertFromEvent(event({ orderId, ledger: 102, type: "disputed", txHash: "0xdispute" }));

    const dispute = await getPool().query(
      "SELECT status FROM disputes WHERE order_id = $1",
      [orderId],
    );
    expect(dispute.rows[0]).toMatchObject({ status: "open" });

    await upsertFromEvent(event({ orderId, ledger: 103, type: "released", txHash: "0xrelease" }));
    const resolved = await getPool().query(
      "SELECT status, resolved_tx_hash FROM disputes WHERE order_id = $1",
      [orderId],
    );
    expect(resolved.rows[0]).toMatchObject({
      status: "resolved_seller",
      resolved_tx_hash: "0xrelease",
    });
  });

  it("serialises concurrent event writes for the same order", async () => {
    const orderId = id();
    await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        upsertFromEvent(event({ orderId, ledger: 100 + index })),
      ),
    );
    const finalOrder = await getOrder(orderId);
    expect(finalOrder).not.toBeNull();
    expect(finalOrder?.status).toBe("created");
  });

  it("updates an existing order", async () => {
    const orderId = id();
    await upsertFromEvent(event({ orderId }));
    const updated = await updateOrder(orderId, (order) => ({ ...order, status: "refunded" }));
    expect(updated).toMatchObject({ status: "refunded" });
    await expect(getOrder(orderId)).resolves.toMatchObject({ status: "refunded" });
  });
});
