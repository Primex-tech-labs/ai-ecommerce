import { Badge } from "@repo/ui";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/LogoutButton";
import { OrderActions } from "@/components/OrderActions";
import { authEnabled, getSessionUser } from "@/lib/auth";
import { listOrders, listOrdersByOwner } from "@/lib/orders-server";

export const dynamic = "force-dynamic";

function shorten(value: string): string {
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-6)}`;
}

function latestHash(order: {
  createTxHash?: string;
  fundTxHash?: string;
  disputeTxHash?: string;
  releaseTxHash?: string;
  refundTxHash?: string;
}): string | undefined {
  return (
    order.refundTxHash ??
    order.releaseTxHash ??
    order.disputeTxHash ??
    order.fundTxHash ??
    order.createTxHash
  );
}

export default async function OrdersPage() {
  const requiresAuth = authEnabled();
  const user = requiresAuth ? await getSessionUser() : null;
  if (requiresAuth && !user) {
    redirect("/login");
  }

  const orders = user ? await listOrdersByOwner(user.id) : await listOrders();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Orders</h1>
          <p className="text-slate-600">
            Escrow orders tracked from on-chain events. Buyers can release funds after
            fulfilment; sellers can refund them if an order cannot be completed.
          </p>
        </div>
        {user ? (
          <div className="flex flex-col items-end gap-1">
            <p className="text-sm text-slate-600">{user.email}</p>
            <LogoutButton />
          </div>
        ) : null}
      </div>

      {orders.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-600">
          No orders yet.{" "}
          <Link href="/" className="underline">
            Visit the shop
          </Link>{" "}
          to create one.
        </p>
      ) : (
        <ul className="space-y-4">
          {orders.map((order) => {
            const hash = latestHash(order);
            return (
              <li
                key={order.orderId}
                className="rounded-2xl border border-slate-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-slate-900">{order.orderId}</h2>
                      <Badge>{order.status}</Badge>
                    </div>
                    <dl className="grid gap-1 text-sm text-slate-600">
                      <div className="flex gap-2">
                        <dt className="w-16 text-slate-500">Buyer</dt>
                        <dd className="font-mono" title={order.buyer}>
                          {shorten(order.buyer)}
                        </dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="w-16 text-slate-500">Seller</dt>
                        <dd className="font-mono" title={order.seller}>
                          {shorten(order.seller)}
                        </dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="w-16 text-slate-500">Amount</dt>
                        <dd className="font-mono">{order.amount}</dd>
                      </div>
                      {hash ? (
                        <div className="flex gap-2">
                          <dt className="w-16 text-slate-500">Tx</dt>
                          <dd className="font-mono" title={hash}>
                            {shorten(hash)}
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                  </div>
                  <OrderActions order={order} />
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  Ledger {order.ledger} · Updated{" "}
                  {new Date(order.updatedAt).toLocaleString()}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
