import { describe, expect, it } from "vitest";
import { resolveOrderActionSource } from "./order-actions";
import type { Order } from "./orders";

const order: Order = {
  orderId: "order_1",
  buyer: "GBUYER",
  seller: "GSELLER",
  token: "CTOKEN",
  amount: "10000000",
  status: "funded",
  ledger: 42,
  escrowContractId: "CESCROW",
  updatedAt: new Date(0).toISOString(),
};

describe("resolveOrderActionSource", () => {
  it("allows the buyer to release", () => {
    expect(resolveOrderActionSource(order, "GBUYER", "release")).toEqual({
      ok: true,
      source: "GBUYER",
    });
  });

  it("rejects a non-buyer release", () => {
    expect(resolveOrderActionSource(order, "GSELLER", "release")).toMatchObject({
      ok: false,
      error: "source must match the order buyer",
    });
  });

  it("allows the seller to refund", () => {
    expect(resolveOrderActionSource(order, "GSELLER", "refund")).toEqual({
      ok: true,
      source: "GSELLER",
    });
  });

  it("rejects a non-seller refund", () => {
    expect(resolveOrderActionSource(order, "GBUYER", "refund")).toMatchObject({
      ok: false,
      error: "source must match the order seller",
    });
  });

  it("requires a source", () => {
    expect(resolveOrderActionSource(order, undefined, "release")).toMatchObject({
      ok: false,
      error: "source is required",
    });
  });
});
