import { NextResponse } from "next/server";
import {
  INDEXER_SIGNATURE_HEADER,
  verifyIndexerSignature,
} from "@/lib/indexer-signature";
import { upsertFromEvent, type OrderEvent, type OrderStatus } from "@/lib/orders";

const EVENT_TYPES: readonly OrderStatus[] = [
  "created",
  "funded",
  "released",
  "refunded",
];

function isOrderEvent(value: unknown): value is OrderEvent {
  if (value === null || typeof value !== "object") return false;
  const event = value as Record<string, unknown>;
  return (
    typeof event.id === "string" &&
    typeof event.ledger === "number" &&
    typeof event.type === "string" &&
    EVENT_TYPES.includes(event.type as OrderStatus) &&
    typeof event.orderId === "string" &&
    event.orderId !== "" &&
    (event.buyer === undefined || typeof event.buyer === "string") &&
    (event.seller === undefined || typeof event.seller === "string") &&
    (event.token === undefined || typeof event.token === "string") &&
    (event.amount === undefined || typeof event.amount === "string")
  );
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const secret = process.env.ORDERS_WEBHOOK_SECRET;

  if (!secret) {
    console.warn(
      "ORDERS_WEBHOOK_SECRET is not set: accepting unsigned order webhooks (development only)",
    );
  } else if (
    !verifyIndexerSignature(
      rawBody,
      request.headers.get(INDEXER_SIGNATURE_HEADER),
      secret,
    )
  ) {
    return NextResponse.json({ error: "invalid indexer signature" }, { status: 401 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!isOrderEvent(parsed)) {
    return NextResponse.json({ error: "invalid order event" }, { status: 400 });
  }

  const order = await upsertFromEvent(parsed);
  return NextResponse.json({ ok: true, order });
}
