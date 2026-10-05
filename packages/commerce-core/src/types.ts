export type Currency = "USD" | "EUR" | "GBP";

export interface Money {
  amount: number;
  currency: Currency;
}

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  name: string;
  price: Money;
  inStock: boolean;
  attributes: Record<string, string>;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  images: string[];
  tags: string[];
  variants: ProductVariant[];
  rating?: number;
}

export interface CartLine {
  variantId: string;
  productId: string;
  name: string;
  unitPrice: Money;
  quantity: number;
}

export interface Cart {
  id: string;
  currency: Currency;
  lines: CartLine[];
}
