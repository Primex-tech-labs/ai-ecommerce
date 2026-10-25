import { Networks } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import { deriveNativeSacContractId, deriveSacContractId } from "./sac";

const USDC_TESTNET_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

describe("deriveSacContractId", () => {
  it("matches the known USDC testnet SAC id", () => {
    expect(deriveSacContractId("USDC", USDC_TESTNET_ISSUER, Networks.TESTNET)).toBe(
      "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
    );
  });

  it("is deterministic", () => {
    const first = deriveSacContractId("USDC", USDC_TESTNET_ISSUER, Networks.TESTNET);
    const second = deriveSacContractId("USDC", USDC_TESTNET_ISSUER, Networks.TESTNET);
    expect(second).toBe(first);
  });

  it("depends on the network passphrase", () => {
    const testnet = deriveSacContractId("USDC", USDC_TESTNET_ISSUER, Networks.TESTNET);
    const mainnet = deriveSacContractId("USDC", USDC_TESTNET_ISSUER, Networks.PUBLIC);
    expect(mainnet).not.toBe(testnet);
  });

  it("rejects an invalid issuer", () => {
    expect(() => deriveSacContractId("USDC", "not-an-account", Networks.TESTNET)).toThrow(
      /asset issuer/,
    );
  });

  it("rejects an invalid asset code", () => {
    expect(() =>
      deriveSacContractId("TOO-LONG-CODE", USDC_TESTNET_ISSUER, Networks.TESTNET),
    ).toThrow(/asset code/);
    expect(() => deriveSacContractId("", USDC_TESTNET_ISSUER, Networks.TESTNET)).toThrow(
      /asset code/,
    );
  });

  it("requires a network passphrase", () => {
    expect(() => deriveSacContractId("USDC", USDC_TESTNET_ISSUER, "")).toThrow(
      /network passphrase/,
    );
  });
});

describe("deriveNativeSacContractId", () => {
  it("matches the known native testnet SAC id", () => {
    expect(deriveNativeSacContractId(Networks.TESTNET)).toBe(
      "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
    );
  });
});
