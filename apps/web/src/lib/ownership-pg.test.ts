import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { getPool } from "./db";
import { claimOrderOwner, listOrdersByOwner } from "./orders-pg";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const suite = hasDatabase ? describe : describe.skip;

const DETAILS = {
  buyer: "GBUYER",
  seller: "GSELLER",
  token: "CTOKEN",
  escrowContractId: "CESCROW",
  amountStroops: "10000000",
};

suite("order ownership (postgres)", () => {
  const orderIds: string[] = [];
  const userIds: string[] = [];

  async function makeUser(): Promise<string> {
    const email = `owner-${randomUUID()}@example.com`;
    const result = await getPool().query(
      "INSERT INTO users (email, password_hash) VALUES ($1, 'x') RETURNING id",
      [email],
    );
    const id = (result.rows[0] as { id?: string } | undefined)?.id;
    if (!id) throw new Error("failed to create user");
    userIds.push(id);
    return id;
  }

  function orderId(): string {
    const value = `own-${randomUUID()}`;
    orderIds.push(value);
    return value;
  }

  afterAll(async () => {
    if (orderIds.length > 0) {
      await getPool().query("DELETE FROM orders WHERE id = ANY($1::text[])", [orderIds]);
    }
    if (userIds.length > 0) {
      await getPool().query("DELETE FROM users WHERE id = ANY($1::uuid[])", [userIds]);
    }
  });

  it("scopes listings to the order owner", async () => {
    const ownerA = await makeUser();
    const ownerB = await makeUser();
    const id = orderId();

    await claimOrderOwner(id, ownerA, DETAILS);

    const aOrders = await listOrdersByOwner(ownerA);
    expect(aOrders.some((order) => order.orderId === id)).toBe(true);

    const bOrders = await listOrdersByOwner(ownerB);
    expect(bOrders.some((order) => order.orderId === id)).toBe(false);
  });

  it("refuses to reassign an order to a different owner", async () => {
    const ownerA = await makeUser();
    const ownerB = await makeUser();
    const id = orderId();

    await claimOrderOwner(id, ownerA, DETAILS);
    await expect(claimOrderOwner(id, ownerB, DETAILS)).rejects.toThrow(/another user/);
  });
});