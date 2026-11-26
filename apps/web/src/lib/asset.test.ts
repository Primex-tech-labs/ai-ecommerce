import { Keypair } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import {
  STELLAR_ASSET_DECIMALS,
  toAssetStroops,
  validateStellarAsset,
} from "./asset";

const issuer = Keypair.random().publicKey();

describe("stellar asset precision", () => {
  it("uses 7 decimals for native and issued Stellar assets", () => {
    expect(STELLAR_ASSET_DECIMALS).toBe(7);
    expect(toAssetStroops(1, { kind: "native" })).toBe(10_000_000n);
    expect(toAssetStroops(399, { kind: "native" })).toBe(3_990_000_000n);
    expect(
      toAssetStroops(2, { kind: "credit", code: "USDC", issuer }),
    ).toBe(20_000_000n);
  });

  it("rejects invalid asset identity", () => {
    expect(() =>
      validateStellarAsset({ kind: "credit", code: "TOOLONGCODE123", issuer }),
    ).toThrow();
    expect(() =>
      validateStellarAsset({ kind: "credit", code: "USDC", issuer: "not-an-address" }),
    ).toThrow();
  });

  it("rejects invalid amounts", () => {
    expect(() => toAssetStroops(0, { kind: "native" })).toThrow();
    expect(() => toAssetStroops(-1, { kind: "native" })).toThrow();
    expect(() => toAssetStroops(1.5, { kind: "native" })).toThrow();
    expect(() => toAssetStroops(Number.MAX_SAFE_INTEGER, { kind: "native" })).toThrow();
  });
});
