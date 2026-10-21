import { buildRefundEscrow } from "@repo/stellar";
import { NextResponse } from "next/server";
import { resolveOrderActionSource } from "@/lib/order-actions";
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

  let body: { source?: unknown };
  try {
    body = (await request.json()) as { source?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const source = resolveOrderActionSource(order, body.source, "refund");
  if (!source.ok) {
    return NextResponse.json({ error: source.error }, { status: 400 });
  }

  const config = getStellarConfig();
  if (!config.escrowContractId) {
    return NextResponse.json(
      { error: "Stellar checkout is not configured" },
      { status: 503 },
    );
  }

  try {
    const transaction = await buildRefundEscrow(config, order.orderId, source.source);
    return NextResponse.json(transaction);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
