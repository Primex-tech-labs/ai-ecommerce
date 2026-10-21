import { nativeToScVal, rpc } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import { decodeEscrowEvent } from "./events";

function eventResponse(name: string, orderId: string): rpc.Api.EventResponse {
  return {
    id: "event-1",
    ledger: 42,
    type: "contract",
    topic: [
      nativeToScVal(name, { type: "symbol" }),
      nativeToScVal(orderId, { type: "symbol" }),
    ],
    value: nativeToScVal(250, { type: "i128" }),
  } as unknown as rpc.Api.EventResponse;
}

describe("decodeEscrowEvent", () => {
  it("reads the event name and order id from the topic list", () => {
    const summary = decodeEscrowEvent(eventResponse("released", "order_1"));
    expect(summary).toMatchObject({
      id: "event-1",
      ledger: 42,
      type: "released",
      orderId: "order_1",
    });
  });

  it("accepts every escrow event name", () => {
    for (const name of ["created", "funded", "released", "refunded"]) {
      expect(decodeEscrowEvent(eventResponse(name, "order_2")).type).toBe(name);
    }
  });

  it("returns unknown when the topics cannot be decoded", () => {
    const summary = decodeEscrowEvent({
      id: "event-2",
      ledger: 7,
      type: "contract",
      topic: [],
      value: nativeToScVal(1, { type: "i128" }),
    } as unknown as rpc.Api.EventResponse);
    expect(summary.type).toBe("unknown");
    expect(summary.orderId).toBeUndefined();
  });
});
