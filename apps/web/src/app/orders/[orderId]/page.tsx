import { Badge } from "@repo/ui";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { OrderActions } from "@/components/OrderActions";
import { authEnabled, getSessionUser } from "@/lib/auth";
import { getOrder, getOrderForOwner } from "@/lib/orders-server";

export const dynamic = "force-dynamic";

interface HashRow {
  label: string;
  hash?: string;
}

function hashRows(order: {
  createTxHash?: string;
  fundTxHash?: string;
  disputeTxHash?: string;
  releaseTxHash?: string;
  refundTxHash?: string;
}): HashRow[] {
  return [
    { label: "Create", hash: order.createTxHash },
    { label: "Fund", hash: order.fundTxHash },
    { label: "Dispute", hash: order.disputeTxHash },
    { label: "Release", hash: order.releaseTxHash },
    { label: "Refund", hash: order.refundTxHash },
  ].filter((row) => Boolean(row.hash));
}

export default async function OrderDetailPage({
  params,
}: {
  params: { orderId: string };
}) {
  const requiresAuth = authEnabled();
  const user = requiresAuth ? await getSessionUser() : null;
  if (requiresAuth && !user) {
    redirect("/login");
  }

  const order = user
    ? await getOrderForOwner(params.orderId, user.id)
    : await getOrder(params.orderId);
  if (!order) {
    notFound();
  }

  const hashes = hashRows(order);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/orders" className="text-sm text-slate-600 underline">
          Back to orders
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-900">{order.orderId}</h1>
          <Badge>{order.status}</Badge>
          {order.disputeTxHash ? <Badge>dispute opened</Badge> : null}
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <dl className="grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Buyer</dt>
            <dd className="break-all font-mono">{order.buyer}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Seller</dt>
            <dd className="break-all font-mono">{order.seller}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Amount (stroops)</dt>
            <dd className="font-mono">{order.amount}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Escrow contract</dt>
            <dd className="break-all font-mono">{order.escrowContractId || "-"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Ledger</dt>
            <dd className="font-mono">{order.ledger}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Updated</dt>
            <dd>{new Date(order.updatedAt).toLocaleString()}</dd>
          </div>
        </dl>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">Transactions</h2>
        {hashes.length === 0 ? (
          <p className="text-sm text-slate-600">No transaction hashes recorded yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {hashes.map((row) => (
              <li key={row.label} className="flex flex-wrap gap-2">
                <span className="w-20 text-slate-500">{row.label}</span>
                <span className="break-all font-mono">{row.hash}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">
          Fund movement is authorized on-chain by the buyer, seller, or arbiter wallet.
        </p>
        <OrderActions order={order} />
      </section>
    </div>
  );
}
