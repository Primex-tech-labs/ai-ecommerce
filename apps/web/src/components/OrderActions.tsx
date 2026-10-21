"use client";

import { Button } from "@repo/ui";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Order } from "@/lib/orders";
import { signWalletTransaction } from "@/lib/wallet";

const STORAGE_KEY = "primex.wallet";

type Action = "release" | "refund";
type Status = "idle" | "working" | "done" | "error";

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

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
      const buildResponse = await fetch(
        `/api/orders/${encodeURIComponent(order.orderId)}/${action}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ source: address }),
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
      setMessage(action === "release" ? "Escrow released." : "Escrow refunded.");
      router.refresh();
    } catch (error) {
      setStatus("error");
      setMessage((error as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const settled = order.status === "released" || order.status === "refunded";
  const isBuyer = address === order.buyer;
  const isSeller = address === order.seller;

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <Button
          variant="ghost"
          onClick={() => void run("release")}
          disabled={busy !== null || settled || (address !== null && !isBuyer)}
        >
          {busy === "release" ? "Releasing..." : "Release"}
        </Button>
        <Button
          variant="ghost"
          onClick={() => void run("refund")}
          disabled={busy !== null || settled || (address !== null && !isSeller)}
        >
          {busy === "refund" ? "Refunding..." : "Refund"}
        </Button>
      </div>
      {status === "error" ? <p className="text-sm text-red-500">{message}</p> : null}
      {status === "done" ? <p className="text-sm text-green-600">{message}</p> : null}
    </div>
  );
}
