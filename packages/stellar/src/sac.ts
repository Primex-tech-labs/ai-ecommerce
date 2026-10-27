import { Asset, StrKey } from "@stellar/stellar-sdk";

/** Stellar asset codes are 1-12 alphanumeric characters. */
const ASSET_CODE_PATTERN = /^[A-Za-z0-9]{1,12}$/;

export function assertAssetCode(code: string): void {
  if (!ASSET_CODE_PATTERN.test(code)) {
    throw new Error(
      `asset code must be 1-12 alphanumeric characters, got ${JSON.stringify(code)}`,
    );
  }
}

export function assertAssetIssuer(issuer: string): void {
  if (!StrKey.isValidEd25519PublicKey(issuer)) {
    throw new Error(
      `asset issuer must be a Stellar account (G...), got ${JSON.stringify(issuer)}`,
    );
  }
}

/** Build the classic asset that backs a Stellar Asset Contract. */
export function sacAsset(code: string, issuer: string): Asset {
  assertAssetCode(code);
  assertAssetIssuer(issuer);
  return new Asset(code, issuer);
}

/**
 * Derive the Stellar Asset Contract id for a classic asset.
 *
 * The id is deterministic: it is the hash of the asset and the network
 * passphrase, so the same asset always maps to one contract on a network.
 * Creating the SAC on-chain is a separate step (`setup:sac`).
 */
export function deriveSacContractId(
  code: string,
  issuer: string,
  networkPassphrase: string,
): string {
  if (!networkPassphrase) {
    throw new Error("network passphrase is required to derive a SAC id");
  }
  return sacAsset(code, issuer).contractId(networkPassphrase);
}

/** Derive the Stellar Asset Contract id for native XLM. */
export function deriveNativeSacContractId(networkPassphrase: string): string {
  if (!networkPassphrase) {
    throw new Error("network passphrase is required to derive a SAC id");
  }
  return Asset.native().contractId(networkPassphrase);
}
