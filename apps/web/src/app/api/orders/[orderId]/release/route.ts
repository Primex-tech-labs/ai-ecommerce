import { buildReleaseEscrow } from "@repo/stellar";
import { NextResponse } from "next/server";
import { authEnabled, getSessionUser } from "@/lib/auth";
import { resolveOrderActionSource } from "@/lib/order-actions";
import { getOrder } from "@/lib/orders-server";
import { getStellarConfig } from "@/lib/stellar";

export async function POST(
  request: Request,
  { params }: { params: { orderId: string } },
) {
  const order = await getOrder(params.orderId);
  if (!order) {
    return NextResponse.json({ error: "order not found" }, { status: 404 });
  }
  if (authEnabled()) {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "authentication required" }, { status: 401 });
    }
  }


  // Only a funded escrow can be released. Releasing anything else would build a
  // transaction the contract will reject.
  if (order.status !== "funded") {
    return NextResponse.json(
      { error: `order is ${order.status}; only funded orders can be released` },
      { status: 409 },
    );
  }

  let body: { source?: unknown };
  try {
    body = (await request.json()) as { source?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const source = resolveOrderActionSource(order, body.source, "release");
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
    const transaction = await buildReleaseEscrow(config, order.orderId, source.source);
    return NextResponse.json(transaction);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
