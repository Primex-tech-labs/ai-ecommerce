import type { Cart, CartLine, Currency, Money, ProductVariant } from "./types";

export function createCart(id: string, currency: Currency = "USD"): Cart {
  return { id, currency, lines: [] };
}

export function addLine(cart: Cart, variant: ProductVariant, quantity = 1): Cart {
  if (quantity <= 0) return cart;
  const existing = cart.lines.find((line) => line.variantId === variant.id);
  if (existing) {
    return setQuantity(cart, variant.id, existing.quantity + quantity);
  }
  const line: CartLine = {
    variantId: variant.id,
    productId: variant.productId,
    name: variant.name,
    unitPrice: variant.price,
    quantity,
  };
  return { ...cart, lines: [...cart.lines, line] };
}

export function removeLine(cart: Cart, variantId: string): Cart {
  return { ...cart, lines: cart.lines.filter((line) => line.variantId !== variantId) };
}

export function setQuantity(cart: Cart, variantId: string, quantity: number): Cart {
  if (quantity <= 0) return removeLine(cart, variantId);
  return {
    ...cart,
    lines: cart.lines.map((line) =>
      line.variantId === variantId ? { ...line, quantity } : line,
    ),
  };
}

export function clearCart(cart: Cart): Cart {
  return { ...cart, lines: [] };
}

export function countItems(cart: Cart): number {
  return cart.lines.reduce((total, line) => total + line.quantity, 0);
}

export function subtotal(cart: Cart): Money {
  const amount = cart.lines.reduce(
    (total, line) => total + line.unitPrice.amount * line.quantity,
    0,
  );
  return { amount: round(amount), currency: cart.currency };
}

export function applyDiscount(total: Money, percent: number): Money {
  const clamped = Math.min(Math.max(percent, 0), 100);
  return { amount: round(total.amount * (1 - clamped / 100)), currency: total.currency };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
