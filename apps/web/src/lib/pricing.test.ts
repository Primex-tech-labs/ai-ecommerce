import { describe, expect, it } from "vitest";
import { subtotalFromLines } from "./pricing";

describe("subtotalFromLines", () => {
  it("prices lines from the server-side catalog", () => {
    expect(subtotalFromLines([{ variantId: "v-base", quantity: 2 }])).toBe(798);
  });

  it("adds different variants together", () => {
    expect(
      subtotalFromLines([
        { variantId: "v-8", quantity: 1 },
        { variantId: "v-black", quantity: 2 },
      ]),
    ).toBe(707);
  });

  it("rejects unknown variants", () => {
    expect(() => subtotalFromLines([{ variantId: "does-not-exist", quantity: 1 }])).toThrow(
      "unknown variant",
    );
  });

  it("rejects empty carts and invalid quantities", () => {
    expect(() => subtotalFromLines([])).toThrow("cart lines are required");
    expect(() => subtotalFromLines([{ variantId: "v-base", quantity: 0 }])).toThrow(
      "invalid quantity",
    );
    expect(() => subtotalFromLines([{ variantId: "v-base", quantity: 1.5 }])).toThrow(
      "invalid quantity",
    );
  });
});
