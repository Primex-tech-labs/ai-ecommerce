"use client";

import Link from "next/link";
import { Button, Price } from "@repo/ui";
import { useCart } from "@/components/CartProvider";

export default function CartPage() {
  const { cart, subtotal, remove, setQuantity, clear } = useCart();

  if (cart.lines.length === 0) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Your cart is empty</h1>
        <Link href="/" className="text-slate-600 underline">
          Continue shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Your cart</h1>
      <ul className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
        {cart.lines.map((line) => (
          <li key={line.variantId} className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="font-medium text-slate-900">{line.name}</p>
              <Price value={line.unitPrice} />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={line.quantity}
                onChange={(event) => setQuantity(line.variantId, Number(event.target.value))}
                className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-sm"
              />
              <Button variant="ghost" onClick={() => remove(line.variantId)}>
                Remove
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between">
        <div className="text-lg">
          Subtotal: <Price value={subtotal} />
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={clear}>
            Clear
          </Button>
          <Link href="/checkout">
            <Button>Checkout</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
