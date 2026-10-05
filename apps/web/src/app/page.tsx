import { ChatWidget } from "@repo/ui";
import { ProductGrid } from "@/components/ProductGrid";
import { catalog } from "@/lib/catalog";

export default async function HomePage() {
  const products = await catalog.list();
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <section className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">AI-assisted storefront</h1>
          <p className="text-slate-600">
            Discover products with an assistant that knows the catalog.
          </p>
        </div>
        <ProductGrid products={products} />
      </section>
      <aside className="lg:sticky lg:top-8 lg:h-[calc(100vh-8rem)]">
        <ChatWidget />
      </aside>
    </div>
  );
}
