import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { getPool } from "./db";
import { rateLimit } from "./rate-limit";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const suite = hasDatabase ? describe : describe.skip;

suite("rate limiting (postgres)", () => {
  const prefixes: string[] = [];

  function identifier(): string {
    const value = `rl-${randomUUID()}`;
    prefixes.push(value);
    return value;
  }

  afterAll(async () => {
    if (prefixes.length > 0) {
      await getPool().query("DELETE FROM rate_limits WHERE bucket LIKE ANY($1::text[])", [
        prefixes.map((value) => `%:${value}%`),
      ]);
    }
  });

  it("blocks requests over the limit within a window", async () => {
    const id = identifier();
    await expect(rateLimit("test:bucket", id, 2, 60)).resolves.toMatchObject({
      allowed: true,
    });
    await expect(rateLimit("test:bucket", id, 2, 60)).resolves.toMatchObject({
      allowed: true,
    });
    const blocked = await rateLimit("test:bucket", id, 2, 60);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });
});