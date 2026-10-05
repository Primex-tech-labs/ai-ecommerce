"use client";

import Link from "next/link";
import { Button, Price } from "@repo/ui";
import { useState } from "react";
import { useCart } from "@/components/CartProvider";
import { StellarCheckoutButton } from "@/components/StellarCheckoutButton";
import { WalletConnectButton } from "@/components/WalletConnectButton";

export default function CheckoutPage() {
  const { cart, subtotal, clear } = useCart();
  const [placed, setPlaced] = useState(false);

  if (placed) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Order confirmed</h1>
        <p className="text-slate-600">
          This is a framework stub. Wire this step to your payment provider and orders service.
        </p>
        <Link href="/" className="text-slate-600 underline">
          Back to shop
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Checkout</h1>
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        {cart.lines.length === 0 ? (
          <p className="text-slate-600">
            Your cart is empty. <Link href="/" className="underline">Add something first.</Link>
          </p>
        ) : (
          <ul className="space-y-2 text-sm text-slate-600">
            {cart.lines.map((line) => (
              <li key={line.variantId} className="flex justify-between">
                <span>
                  {line.name} x {line.quantity}
                </span>
                <Price value={line.unitPrice} />
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="text-lg">
        Total: <Price value={subtotal} />
      </div>
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Pay with Stellar</h2>
          <WalletConnectButton />
        </div>
        <p className="text-sm text-slate-600">
          Funds are held in a Soroban escrow contract and released to the merchant on
          fulfilment.
        </p>
        <StellarCheckoutButton />
      </div>
      <Button
        variant="ghost"
        disabled={cart.lines.length === 0}
        onClick={() => {
          clear();
          setPlaced(true);
        }}
      >
        Place demo order (no payment)
      </Button>
    </div>
  );
}
