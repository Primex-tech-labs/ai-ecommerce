import type { Product } from "@repo/commerce-core";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Price } from "./Price";

export interface ProductCardProps {
  product: Product;
  onAdd?: (slug: string) => void;
}

export function ProductCard({ product, onAdd }: ProductCardProps) {
  const variant = product.variants[0];
  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="aspect-square w-full rounded-xl bg-slate-100" />
      <div className="flex flex-wrap gap-1">
        {product.tags.slice(0, 3).map((tag) => (
          <Badge key={tag}>{tag}</Badge>
        ))}
      </div>
      <h3 className="text-base font-semibold text-slate-900">{product.name}</h3>
      <p className="line-clamp-2 text-sm text-slate-600">{product.description}</p>
      <div className="mt-auto flex items-center justify-between pt-2">
        {variant ? <Price value={variant.price} /> : null}
        <Button onClick={() => onAdd?.(product.slug)}>Add to cart</Button>
      </div>
    </article>
  );
}
