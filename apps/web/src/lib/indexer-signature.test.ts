import { describe, expect, it } from "vitest";
import { signIndexerPayload, verifyIndexerSignature } from "./indexer-signature";

const SECRET = "test-webhook-secret";
const BODY = JSON.stringify({
  id: "event-1",
  ledger: 12,
  type: "funded",
  orderId: "order_1",
  buyer: "GBUYER",
  seller: "GSELLER",
  token: "CTOKEN",
  amount: "10000000",
});

describe("verifyIndexerSignature", () => {
  it("accepts a valid HMAC-SHA256 signature", () => {
    const signature = signIndexerPayload(BODY, SECRET);
    expect(verifyIndexerSignature(BODY, signature, SECRET)).toBe(true);
  });

  it("rejects a missing or malformed signature when a secret is set", () => {
    expect(verifyIndexerSignature(BODY, null, SECRET)).toBe(false);
    expect(verifyIndexerSignature(BODY, "", SECRET)).toBe(false);
    expect(verifyIndexerSignature(BODY, "not-hex", SECRET)).toBe(false);
  });

  it("rejects a signature for different body bytes", () => {
    const signature = signIndexerPayload(BODY, SECRET);
    expect(verifyIndexerSignature(`${BODY} `, signature, SECRET)).toBe(false);
    expect(verifyIndexerSignature(BODY, signIndexerPayload(BODY, "other"), SECRET)).toBe(false);
  });

  it("accepts unsigned payloads when no secret is configured", () => {
    expect(verifyIndexerSignature(BODY, null, undefined)).toBe(true);
  });
});
