import { buildResolveDispute } from "@repo/stellar";
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

  if (order.status !== "disputed") {
    return NextResponse.json(
      { error: `order is ${order.status}; only disputed orders can be resolved` },
      { status: 409 },
    );
  }

  let body: { source?: unknown; decision?: unknown };
  try {
    body = (await request.json()) as { source?: unknown; decision?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const arbiter = process.env.STELLAR_ARBITER_ADDRESS;
  if (!arbiter) {
    return NextResponse.json(
      { error: "dispute resolution is not configured" },
      { status: 503 },
    );
  }

  if (typeof body.source !== "string" || body.source !== arbiter) {
    return NextResponse.json(
      { error: "only the configured arbiter can resolve this dispute" },
      { status: 403 },
    );
  }

  if (body.decision !== "release" && body.decision !== "refund") {
    return NextResponse.json(
      { error: "decision must be 'release' or 'refund'" },
      { status: 400 },
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
    const transaction = await buildResolveDispute(
      config,
      order.orderId,
      arbiter,
      body.decision === "release",
    );
    return NextResponse.json(transaction);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
