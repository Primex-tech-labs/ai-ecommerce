import { describe, expect, it } from "vitest";
import { addLine, countItems, createCart, setQuantity, subtotal } from "../src/cart";
import type { ProductVariant } from "../src/types";

const variant: ProductVariant = {
  id: "v-1",
  productId: "p-1",
  sku: "p-1-v-1",
  name: "Standard",
  price: { amount: 10, currency: "USD" },
  inStock: true,
  attributes: {},
};

describe("cart", () => {
  it("adds lines and computes subtotal", () => {
    const cart = addLine(addLine(createCart("c1"), variant, 2));
    expect(countItems(cart)).toBe(2);
    expect(subtotal(cart).amount).toBe(20);
  });

  it("merges quantities for the same variant", () => {
    const cart = addLine(addLine(createCart("c1"), variant, 1), variant, 3);
    expect(cart.lines).toHaveLength(1);
    expect(countItems(cart)).toBe(4);
  });

  it("removes a line when quantity drops to zero", () => {
    const cart = setQuantity(addLine(createCart("c1"), variant, 2), "v-1", 0);
    expect(cart.lines).toHaveLength(0);
  });
});
