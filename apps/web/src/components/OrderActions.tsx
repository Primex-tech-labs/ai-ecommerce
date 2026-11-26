"use client";

import { Button } from "@repo/ui";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Order } from "@/lib/orders";
import { signWalletTransaction } from "@/lib/wallet";

const STORAGE_KEY = "primex.wallet";
const ARBITER = process.env.NEXT_PUBLIC_STELLAR_ARBITER_ADDRESS;

type Action =
  | "release"
  | "refund"
  | "dispute"
  | "resolve-release"
  | "resolve-refund";
type Status = "idle" | "working" | "done" | "error";

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

const ENDPOINTS: Record<
  Action,
  { path: string; body: (source: string) => Record<string, unknown> }
> = {
  release: { path: "release", body: (source) => ({ source }) },
  refund: { path: "refund", body: (source) => ({ source }) },
  dispute: { path: "dispute", body: (source) => ({ source }) },
  "resolve-release": {
    path: "resolve",
    body: (source) => ({ source, decision: "release" }),
  },
  "resolve-refund": {
    path: "resolve",
    body: (source) => ({ source, decision: "refund" }),
  },
};

const LABELS: Record<Action, { idle: string; busy: string; done: string }> = {
  release: { idle: "Release", busy: "Releasing...", done: "Escrow released." },
  refund: { idle: "Refund", busy: "Refunding...", done: "Escrow refunded." },
  dispute: {
    idle: "Raise dispute",
    busy: "Opening dispute...",
    done: "Dispute opened.",
  },
  "resolve-release": {
    idle: "Resolve to seller",
    busy: "Resolving...",
    done: "Resolved in favour of the seller.",
  },
  "resolve-refund": {
    idle: "Resolve to buyer",
    busy: "Resolving...",
    done: "Resolved in favour of the buyer.",
  },
};

export function OrderActions({ order }: { order: Order }) {
  const router = useRouter();
  const [address, setAddress] = useState<string | null>(null);
  const [busy, setBusy] = useState<Action | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setAddress(window.localStorage.getItem(STORAGE_KEY));
    const onChange = (event: Event) => {
      setAddress((event as CustomEvent<string | null>).detail);
    };
    window.addEventListener("wallet:changed", onChange);
    return () => window.removeEventListener("wallet:changed", onChange);
  }, []);

  async function run(action: Action) {
    if (!address) {
      setStatus("error");
      setMessage("Connect a Stellar wallet first.");
      return;
    }

    setBusy(action);
    setStatus("working");
    setMessage("");
    try {
      const endpoint = ENDPOINTS[action];
      const buildResponse = await fetch(
        `/api/orders/${encodeURIComponent(order.orderId)}/${endpoint.path}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(endpoint.body(address)),
        },
      );
      if (!buildResponse.ok) throw new Error(await errorMessage(buildResponse));

      const { xdr, networkPassphrase } = (await buildResponse.json()) as {
        xdr: string;
        networkPassphrase: string;
      };
      const signedXdr = await signWalletTransaction(xdr, networkPassphrase, address);

      const submitResponse = await fetch("/api/payments/stellar/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId: order.orderId, signedXdr }),
      });
      if (!submitResponse.ok) throw new Error(await errorMessage(submitResponse));

      const result = (await submitResponse.json()) as { status?: string };
      if (result.status !== "SUCCESS") {
        throw new Error(`transaction ${result.status ?? "not confirmed"}`);
      }

      setStatus("done");
      setMessage(LABELS[action].done);
      router.refresh();
    } catch (error) {
      setStatus("error");
      setMessage((error as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const funded = order.status === "funded";
  const disputed = order.status === "disputed";
  const settled = order.status === "released" || order.status === "refunded";
  const isBuyer = address === order.buyer;
  const isSeller = address === order.seller;
  const isParty = isBuyer || isSeller;
  const isArbiter = ARBITER !== undefined && ARBITER !== "" && address === ARBITER;

  return (
    <div className="flex flex-col items-end gap-2">
      {funded ? (
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => void run("release")}
            disabled={busy !== null || (address !== null && !isBuyer)}
          >
            {busy === "release" ? LABELS.release.busy : LABELS.release.idle}
          </Button>
          <Button
            variant="ghost"
            onClick={() => void run("refund")}
            disabled={busy !== null || (address !== null && !isSeller)}
          >
            {busy === "refund" ? LABELS.refund.busy : LABELS.refund.idle}
          </Button>
          <Button
            variant="ghost"
            onClick={() => void run("dispute")}
            disabled={busy !== null || (address !== null && !isParty)}
          >
            {busy === "dispute" ? LABELS.dispute.busy : LABELS.dispute.idle}
          </Button>
        </div>
      ) : null}

      {disputed ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {isArbiter ? (
            <>
              <Button
                variant="ghost"
                onClick={() => void run("resolve-release")}
                disabled={busy !== null}
              >
                {busy === "resolve-release"
                  ? LABELS["resolve-release"].busy
                  : LABELS["resolve-release"].idle}
              </Button>
              <Button
                variant="ghost"
                onClick={() => void run("resolve-refund")}
                disabled={busy !== null}
              >
                {busy === "resolve-refund"
                  ? LABELS["resolve-refund"].busy
                  : LABELS["resolve-refund"].idle}
              </Button>
            </>
          ) : (
            <p className="text-sm text-slate-500">Under dispute - awaiting arbiter.</p>
          )}
        </div>
      ) : null}

      {settled ? <p className="text-sm text-slate-500">Settled.</p> : null}
      {status === "error" ? <p className="text-sm text-red-500">{message}</p> : null}
      {status === "done" ? <p className="text-sm text-green-600">{message}</p> : null}
    </div>
  );
}
