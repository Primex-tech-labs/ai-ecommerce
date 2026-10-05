"use client";

import {
  addLine,
  clearCart,
  countItems,
  createCart,
  removeLine,
  setQuantity as setLineQuantity,
  subtotal as cartSubtotal,
  type Cart,
  type Money,
  type Product,
  type ProductVariant,
} from "@repo/commerce-core";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "primex.cart";

interface CartContextValue {
  cart: Cart;
  count: number;
  subtotal: Money;
  add: (product: Product, variant?: ProductVariant) => void;
  remove: (variantId: string) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart>(() => createCart(newId()));

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      setCart(JSON.parse(raw) as Cart);
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  }, [cart]);

  const add = useCallback((product: Product, variant?: ProductVariant) => {
    const target = variant ?? product.variants[0];
    if (!target) return;
    setCart((current) => addLine(current, target, 1));
  }, []);

  const remove = useCallback((variantId: string) => {
    setCart((current) => removeLine(current, variantId));
  }, []);

  const setQuantity = useCallback((variantId: string, quantity: number) => {
    setCart((current) => setLineQuantity(current, variantId, quantity));
  }, []);

  const clear = useCallback(() => {
    setCart((current) => clearCart(current));
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      count: countItems(cart),
      subtotal: cartSubtotal(cart),
      add,
      remove,
      setQuantity,
      clear,
    }),
    [cart, add, remove, setQuantity, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}
