import { resolveConfig, type StellarConfig } from "@repo/stellar";

export function getStellarConfig(): StellarConfig {
  return resolveConfig({
    STELLAR_NETWORK: process.env.STELLAR_NETWORK,
    STELLAR_RPC_URL: process.env.STELLAR_RPC_URL,
    STELLAR_HORIZON_URL: process.env.STELLAR_HORIZON_URL,
    STELLAR_NETWORK_PASSPHRASE: process.env.STELLAR_NETWORK_PASSPHRASE,
    ESCROW_CONTRACT_ID: process.env.ESCROW_CONTRACT_ID,
  });
}

export const STELLAR_TOKEN_DECIMALS = 7;

export function toTokenAmount(amount: number): bigint {
  return BigInt(Math.round(amount * 10 ** STELLAR_TOKEN_DECIMALS));
}
