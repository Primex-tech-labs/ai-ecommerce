import { StrKey } from "@stellar/stellar-sdk";

export type StellarAsset =
  | { kind: "native" }
  | { kind: "credit"; code: string; issuer: string };

/**
 * Stellar classic assets (native XLM and issued assets) all use 7 decimal
 * places: 1 unit = 10,000,000 stroops. Non-Stellar assets are not supported.
 */
export const STELLAR_ASSET_DECIMALS = 7;
const STROOPS_PER_UNIT = BigInt(10_000_000);
const MAX_STROOPS = BigInt("9223372036854775807");
const ASSET_CODE = /^[A-Za-z0-9]{1,12}$/;

/** Reject assets whose identity/precision we cannot verify. */
export function validateStellarAsset(asset: StellarAsset): void {
  if (asset.kind === "native") return;
  if (asset.kind !== "credit") {
    throw new Error("unsupported asset kind");
  }
  if (!ASSET_CODE.test(asset.code)) {
    throw new Error("invalid Stellar asset code");
  }
  if (!StrKey.isValidEd25519PublicKey(asset.issuer)) {
    throw new Error("invalid Stellar asset issuer");
  }
}

/** Convert integer major units of a Stellar asset into stroops. */
export function toAssetStroops(amountMajor: number, asset: StellarAsset): bigint {
  validateStellarAsset(asset);
  if (!Number.isSafeInteger(amountMajor) || amountMajor <= 0) {
    throw new Error("amount must be a positive integer");
  }
  const stroops = BigInt(amountMajor) * STROOPS_PER_UNIT;
  if (stroops > MAX_STROOPS) {
    throw new Error("amount exceeds the maximum supported value");
  }
  return stroops;
}
