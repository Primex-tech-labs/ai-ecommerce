"use client";

import type { Product } from "@repo/commerce-core";
import { ProductCard } from "@repo/ui";
import { useCart } from "./CartProvider";

export function ProductGrid({ products }: { products: Product[] }) {
  const { add } = useCart();
  return (
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} onAdd={() => add(product)} />
      ))}
    </div>
  );
}
