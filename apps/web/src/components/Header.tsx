"use client";

import Link from "next/link";
import { WalletConnectButton } from "./WalletConnectButton";
import { useCart } from "./CartProvider";

export function Header() {
  const { count } = useCart();
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-semibold text-slate-900">
          Primex AI Store
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/" className="text-slate-600 hover:text-slate-900">
            Shop
          </Link>
          <Link href="/cart" className="text-slate-600 hover:text-slate-900">
            Cart ({count})
          </Link>
          <WalletConnectButton />
        </nav>
      </div>
    </header>
  );
}
