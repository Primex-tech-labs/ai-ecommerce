"use client";

import type { Product } from "@repo/commerce-core";
import { Button, Price } from "@repo/ui";
import { useState } from "react";
import { useCart } from "./CartProvider";

export function AddToCartButton({ product }: { product: Product }) {
  const { add } = useCart();
  const [variantId, setVariantId] = useState(product.variants[0]?.id ?? "");
  const variant = product.variants.find((item) => item.id === variantId) ?? product.variants[0];

  if (!variant) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {product.variants.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setVariantId(item.id)}
            className={
              item.id === variant.id
                ? "rounded-lg border border-slate-900 px-3 py-2 text-sm font-medium"
                : "rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600"
            }
          >
            {item.name}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-4">
        <Price value={variant.price} />
        <Button onClick={() => add(product, variant)} disabled={!variant.inStock}>
          {variant.inStock ? "Add to cart" : "Out of stock"}
        </Button>
      </div>
    </div>
  );
}
