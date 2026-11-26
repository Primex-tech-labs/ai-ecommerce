import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { getPool } from "./db";
import { claimOrderOwner, getOrderForOwner } from "./orders-pg";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const suite = hasDatabase ? describe : describe.skip;

const DETAILS = {
  buyer: "GBUYER",
  seller: "GSELLER",
  token: "CTOKEN",
  escrowContractId: "CESCROW",
  amountStroops: "10000000",
};

suite("owner-scoped order retrieval (postgres)", () => {
  const orderIds: string[] = [];
  const userIds: string[] = [];

  async function makeUser(): Promise<string> {
    const email = `detail-${randomUUID()}@example.com`;
    const result = await getPool().query(
      "INSERT INTO users (email, password_hash) VALUES ($1, 'x') RETURNING id",
      [email],
    );
    const id = (result.rows[0] as { id?: string } | undefined)?.id;
    if (!id) throw new Error("failed to create user");
    userIds.push(id);
    return id;
  }

  afterAll(async () => {
    if (orderIds.length > 0) {
      await getPool().query("DELETE FROM orders WHERE id = ANY($1::text[])", [orderIds]);
    }
    if (userIds.length > 0) {
      await getPool().query("DELETE FROM users WHERE id = ANY($1::uuid[])", [userIds]);
    }
  });

  it("returns an order only to its owner", async () => {
    const owner = await makeUser();
    const other = await makeUser();
    const id = `detail-${randomUUID()}`;
    orderIds.push(id);

    await claimOrderOwner(id, owner, DETAILS);

    await expect(getOrderForOwner(id, owner)).resolves.toMatchObject({ orderId: id });
    await expect(getOrderForOwner(id, other)).resolves.toBeNull();
  });
});
