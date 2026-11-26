import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import {
  createSession,
  createUser,
  findSessionUser,
  findUserByEmail,
  revokeSession,
} from "./auth-repo";
import { getPool } from "./db";
import { hashPassword } from "./password";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const suite = hasDatabase ? describe : describe.skip;

suite("auth repository (postgres)", () => {
  const emails: string[] = [];

  function email(): string {
    const value = `auth-${Date.now()}-${randomUUID()}@example.com`;
    emails.push(value);
    return value;
  }

  afterAll(async () => {
    if (emails.length > 0) {
      await getPool().query("DELETE FROM users WHERE lower(email) = ANY($1::text[])", [
        emails.map((value) => value.toLowerCase()),
      ]);
    }
  });

  it("creates a user and finds it case-insensitively", async () => {
    const address = email();
    const user = await createUser(address, await hashPassword("password-12345"));
    expect(user).not.toBeNull();
    const found = await findUserByEmail(address.toUpperCase());
    expect(found?.user.id).toBe(user?.id);
  });

  it("does not create duplicate accounts for the same email", async () => {
    const address = email();
    const hash = await hashPassword("password-12345");
    expect(await createUser(address, hash)).not.toBeNull();
    expect(await createUser(address.toUpperCase(), hash)).toBeNull();
  });

  it("creates, resolves and revokes a session", async () => {
    const address = email();
    const user = await createUser(address, await hashPassword("password-12345"));
    if (!user) throw new Error("user not created");
    const id = `sess-${randomUUID()}`;
    await createSession(id, user.id, new Date(Date.now() + 60_000), null, null);
    await expect(findSessionUser(id)).resolves.toMatchObject({ id: user.id });
    await revokeSession(id);
    await expect(findSessionUser(id)).resolves.toBeNull();
  });

  it("does not resolve expired sessions", async () => {
    const address = email();
    const user = await createUser(address, await hashPassword("password-12345"));
    if (!user) throw new Error("user not created");
    const id = `sess-${randomUUID()}`;
    await createSession(id, user.id, new Date(Date.now() - 1_000), null, null);
    await expect(findSessionUser(id)).resolves.toBeNull();
  });
});