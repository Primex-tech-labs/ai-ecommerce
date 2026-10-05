import type { ModuleInterface, Networks } from "@creit.tech/stellar-wallets-kit";

type Kit = typeof import("@creit.tech/stellar-wallets-kit");

let initialized = false;

export async function initWallet(): Promise<Kit> {
  const kit = await import("@creit.tech/stellar-wallets-kit");
  if (!initialized) {
    const [freighter, xbull, lobstr, rabet, albedo] = await Promise.all([
      import("@creit.tech/stellar-wallets-kit/modules/freighter"),
      import("@creit.tech/stellar-wallets-kit/modules/xbull"),
      import("@creit.tech/stellar-wallets-kit/modules/lobstr"),
      import("@creit.tech/stellar-wallets-kit/modules/rabet"),
      import("@creit.tech/stellar-wallets-kit/modules/albedo"),
    ]);
    const network: Networks =
      process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet"
        ? kit.Networks.PUBLIC
        : kit.Networks.TESTNET;
    kit.StellarWalletsKit.init({
      network,
      selectedWalletId: freighter.FREIGHTER_ID,
      modules: [
        new freighter.FreighterModule(),
        new xbull.xBullModule(),
        new lobstr.LobstrModule(),
        new rabet.RabetModule(),
        new albedo.AlbedoModule(),
      ] as ModuleInterface[],
    });
    initialized = true;
  }
  return kit;
}

export async function connectWallet(): Promise<string> {
  const kit = await initWallet();
  const { address } = await kit.StellarWalletsKit.authModal();
  return address;
}

export async function signWalletTransaction(
  xdr: string,
  networkPassphrase: string,
  address: string,
): Promise<string> {
  const kit = await initWallet();
  const { signedTxXdr } = await kit.StellarWalletsKit.signTransaction(xdr, {
    networkPassphrase,
    address,
  });
  return signedTxXdr;
}
