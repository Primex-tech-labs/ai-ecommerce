import { seedProducts } from "@repo/commerce-core";

export interface CartLineInput {
  variantId: string;
  quantity: number;
}

/**
 * Recompute an order total from the server-side catalog. The browser sends
 * variant ids and quantities only, so a tampered request cannot set its own
 * price.
 *
 * Monetary model: catalog prices are integer major units (e.g. 399 = 399 XLM),
 * and totals are computed with integer arithmetic only. Fractional or
 * overflowing values are rejected instead of silently rounded.
 */
export function subtotalFromLines(lines: CartLineInput[]): number {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new Error("cart lines are required");
  }
  let total = 0;
  for (const line of lines) {
    if (!line || typeof line.variantId !== "string") {
      throw new Error("each cart line needs a variantId");
    }
    const quantity = Number(line.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
      throw new Error(`invalid quantity for ${line.variantId}`);
    }
    let unitPrice: number | undefined;
    for (const product of seedProducts) {
      const variant = product.variants.find((candidate) => candidate.id === line.variantId);
      if (variant) {
        unitPrice = variant.price.amount;
        break;
      }
    }
    if (unitPrice === undefined) {
      throw new Error(`unknown variant: ${line.variantId}`);
    }
    if (!Number.isSafeInteger(unitPrice) || unitPrice <= 0) {
      throw new Error(`invalid price for ${line.variantId}`);
    }
    const lineTotal = unitPrice * quantity;
    if (!Number.isSafeInteger(lineTotal)) {
      throw new Error(`line total overflow for ${line.variantId}`);
    }
    total += lineTotal;
    if (!Number.isSafeInteger(total)) {
      throw new Error("order total overflow");
    }
  }
  return total;
}
