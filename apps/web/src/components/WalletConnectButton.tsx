"use client";

import { Button } from "@repo/ui";
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "primex.wallet";

export function WalletConnectButton() {
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAddress(window.localStorage.getItem(STORAGE_KEY));
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    try {
      const kit = await import("@creit.tech/stellar-wallets-kit");
      const network =
        process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet"
          ? kit.WalletNetwork.PUBLIC
          : kit.WalletNetwork.TESTNET;
      kit.StellarWalletsKit.init({
        network,
        selectedWalletId: kit.FREIGHTER_ID,
        modules: kit.allowAllModules(),
      });
      const { address: connected } = await kit.StellarWalletsKit.authModal();
      window.localStorage.setItem(STORAGE_KEY, connected);
      setAddress(connected);
      window.dispatchEvent(new CustomEvent("wallet:changed", { detail: connected }));
    } catch (caught) {
      setError((caught as Error).message);
    }
  }, []);

  const disconnect = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    setAddress(null);
    window.dispatchEvent(new CustomEvent("wallet:changed", { detail: null }));
  }, []);

  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" onClick={address ? disconnect : connect}>
        {address ? `${address.slice(0, 4)}...${address.slice(-4)}` : "Connect wallet"}
      </Button>
      {error ? <span className="text-xs text-red-500">{error}</span> : null}
    </div>
  );
}
