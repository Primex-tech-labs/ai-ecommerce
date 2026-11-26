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
// Stellar amounts are signed 64-bit integers (i128 in the contract, but the
// practical on-chain limit is bounded well below i64::MAX). Reject anything
// that could not be represented safely.
const MAX_STROOPS = BigInt("9223372036854775807");
const STROOPS_PER_UNIT = BigInt(10_000_000);

/**
 * Convert an integer major-unit amount (e.g. 399) into stroops (399 * 10^7).
 * Integer-only: fractional, non-positive, or overflowing inputs are rejected.
 */
export function toTokenAmount(amount: number): bigint {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error("amount must be a positive integer");
  }
  const stroops = BigInt(amount) * STROOPS_PER_UNIT;
  if (stroops > MAX_STROOPS) {
    throw new Error("amount exceeds the maximum supported value");
  }
  return stroops;
}
