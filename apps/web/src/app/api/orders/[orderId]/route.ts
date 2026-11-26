import { NextResponse } from "next/server";
import { authEnabled, getSessionUser } from "@/lib/auth";
import { getOrder, getOrderForOwner } from "@/lib/orders-server";

export async function GET(
  _request: Request,
  { params }: { params: { orderId: string } },
) {
  const requiresAuth = authEnabled();
  const user = requiresAuth ? await getSessionUser() : null;
  if (requiresAuth && !user) {
    return NextResponse.json({ error: "authentication required" }, { status: 401 });
  }

  // Owner-scoped: a signed-in user only sees their own order; a missing or
  // foreign order both return 404 so existence is not leaked.
  const order = user
    ? await getOrderForOwner(params.orderId, user.id)
    : await getOrder(params.orderId);

  if (!order) {
    return NextResponse.json({ error: "order not found" }, { status: 404 });
  }
  return NextResponse.json(order, { headers: { "cache-control": "no-store" } });
}
