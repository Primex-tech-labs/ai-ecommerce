import { buildDisputeEscrow } from "@repo/stellar";
import { NextResponse } from "next/server";
import { getOrder } from "@/lib/orders";
import { getStellarConfig } from "@/lib/stellar";

export async function POST(
  request: Request,
  { params }: { params: { orderId: string } },
) {
  const order = await getOrder(params.orderId);
  if (!order) {
    return NextResponse.json({ error: "order not found" }, { status: 404 });
  }

  if (order.status !== "funded") {
    return NextResponse.json(
      { error: `order is ${order.status}; only funded orders can be disputed` },
      { status: 409 },
    );
  }

  let body: { source?: unknown };
  try {
    body = (await request.json()) as { source?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const source = body.source;
  if (
    typeof source !== "string" ||
    (source !== order.buyer && source !== order.seller)
  ) {
    return NextResponse.json(
      { error: "source must be the order buyer or seller" },
      { status: 403 },
    );
  }

  const config = getStellarConfig();
  if (!config.escrowContractId) {
    return NextResponse.json(
      { error: "Stellar checkout is not configured" },
      { status: 503 },
    );
  }

  if (
    order.escrowContractId &&
    order.escrowContractId !== config.escrowContractId
  ) {
    return NextResponse.json(
      { error: "order escrow contract does not match the configured contract" },
      { status: 409 },
    );
  }

  try {
    const transaction = await buildDisputeEscrow(config, order.orderId, source);
    return NextResponse.json(transaction);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
