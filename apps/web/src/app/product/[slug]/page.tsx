import { Badge } from "@repo/ui";
import { notFound } from "next/navigation";
import { AddToCartButton } from "@/components/AddToCartButton";
import { catalog } from "@/lib/catalog";

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const product = await catalog.getBySlug(params.slug);
  if (!product) notFound();

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <div className="aspect-square w-full rounded-2xl bg-slate-100" />
      <div className="space-y-6">
        <div className="flex flex-wrap gap-2">
          {product.tags.map((tag) => (
            <Badge key={tag}>{tag}</Badge>
          ))}
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-slate-900">{product.name}</h1>
          {product.rating ? (
            <p className="text-sm text-slate-500">{product.rating.toFixed(1)} stars</p>
          ) : null}
        </div>
        <p className="text-slate-600">{product.description}</p>
        <AddToCartButton product={product} />
      </div>
    </div>
  );
}
