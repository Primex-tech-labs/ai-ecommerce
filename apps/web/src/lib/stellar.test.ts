import { describe, expect, it } from "vitest";
import { STELLAR_TOKEN_DECIMALS, toTokenAmount } from "./stellar";

describe("toTokenAmount", () => {
  it("converts integer major units to stroops", () => {
    expect(STELLAR_TOKEN_DECIMALS).toBe(7);
    expect(toTokenAmount(1)).toBe(10_000_000n);
    expect(toTokenAmount(399)).toBe(3_990_000_000n);
  });

  it("rejects zero, negatives and fractional amounts", () => {
    expect(() => toTokenAmount(0)).toThrow();
    expect(() => toTokenAmount(-5)).toThrow();
    expect(() => toTokenAmount(1.5)).toThrow();
  });

  it("rejects amounts that overflow the supported range", () => {
    expect(() => toTokenAmount(Number.MAX_SAFE_INTEGER)).toThrow();
  });
});
