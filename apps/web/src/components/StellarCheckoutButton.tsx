"use client";

import { Button } from "@repo/ui";
import { useEffect, useState } from "react";
import { useCart } from "./CartProvider";
import { signWalletTransaction } from "@/lib/wallet";

const STORAGE_KEY = "primex.wallet";

type Status = "idle" | "working" | "done" | "error";

export function StellarCheckoutButton() {
  const { subtotal, clear, cart } = useCart();
  const [address, setAddress] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [explorerUrl, setExplorerUrl] = useState("");

  useEffect(() => {
    setAddress(window.localStorage.getItem(STORAGE_KEY));
    const onChange = (event: Event) => {
      setAddress((event as CustomEvent<string | null>).detail);
    };
    window.addEventListener("wallet:changed", onChange);
    return () => window.removeEventListener("wallet:changed", onChange);
  }, []);

  async function pay() {
    if (cart.lines.length === 0) return;
    if (!address) {
      setStatus("error");
      setMessage("Connect a Stellar wallet first.");
      return;
    }
    setStatus("working");
    setMessage("");
    try {
      const orderId = `order_${Date.now()}`;
      const createResponse = await fetch("/api/payments/stellar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId, buyer: address, amount: subtotal.amount }),
      });
      if (!createResponse.ok) throw new Error(await createResponse.text());
      const { xdr, networkPassphrase } = (await createResponse.json()) as {
        xdr: string;
        networkPassphrase: string;
      };

      const signedTxXdr = await signWalletTransaction(xdr, networkPassphrase, address);

      const submitResponse = await fetch("/api/payments/stellar/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId, signedXdr: signedTxXdr }),
      });
      if (!submitResponse.ok) throw new Error(await submitResponse.text());
      const result = (await submitResponse.json()) as { hash: string; explorerUrl: string };

      setExplorerUrl(result.explorerUrl);
      setStatus("done");
      clear();
    } catch (error) {
      setStatus("error");
      setMessage((error as Error).message);
    }
  }

  if (status === "done") {
    return (
      <p className="text-sm text-green-600">
        Payment submitted.{" "}
        <a className="underline" href={explorerUrl} target="_blank" rel="noreferrer">
          View on explorer
        </a>
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Button onClick={pay} disabled={status === "working" || cart.lines.length === 0}>
        {status === "working" ? "Waiting for wallet..." : "Pay with Stellar (escrow)"}
      </Button>
      {status === "error" ? <p className="text-sm text-red-500">{message}</p> : null}
    </div>
  );
}
