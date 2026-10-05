import type { Product, ProductVariant } from "./types";

export interface CatalogRepository {
  list(): Promise<Product[]>;
  getBySlug(slug: string): Promise<Product | null>;
  search(query: string): Promise<Product[]>;
  similar(productId: string, limit?: number): Promise<Product[]>;
}

function variant(
  productId: string,
  id: string,
  name: string,
  amount: number,
  attributes: Record<string, string> = {},
): ProductVariant {
  return {
    id,
    productId,
    sku: `${productId}-${id}`,
    name,
    price: { amount, currency: "USD" },
    inStock: true,
    attributes,
  };
}

export const seedProducts: Product[] = [
  {
    id: "p-nebula",
    slug: "nebula-ai-robot-vacuum",
    name: "Nebula AI Robot Vacuum",
    description:
      "Self-navigating vacuum with on-device vision and an assistant that schedules cleaning around your day.",
    images: ["/products/nebula-1.svg"],
    tags: ["smart-home", "ai", "cleaning"],
    rating: 4.7,
    variants: [
      variant("p-nebula", "v-base", "Standard", 399, { color: "graphite" }),
      variant("p-nebula", "v-pro", "Pro + Auto-Empty Dock", 649, { color: "graphite" }),
    ],
  },
  {
    id: "p-lumen",
    slug: "lumen-smart-display",
    name: "Lumen Smart Display",
    description:
      "A countertop display with a conversational shopping and recipe assistant built in.",
    images: ["/products/lumen-1.svg"],
    tags: ["smart-home", "display", "assistant"],
    rating: 4.4,
    variants: [
      variant("p-lumen", "v-8", "8 inch", 149, { size: "8in" }),
      variant("p-lumen", "v-10", "10 inch", 199, { size: "10in" }),
    ],
  },
  {
    id: "p-sonic",
    slug: "sonic-ai-headphones",
    name: "Sonic AI Headphones",
    description:
      "Adaptive noise cancelling headphones with real-time translation and voice assistant.",
    images: ["/products/sonic-1.svg"],
    tags: ["audio", "ai", "travel"],
    rating: 4.8,
    variants: [
      variant("p-sonic", "v-black", "Midnight", 279, { color: "black" }),
      variant("p-sonic", "v-white", "Cloud", 279, { color: "white" }),
    ],
  },
];

export class InMemoryCatalog implements CatalogRepository {
  constructor(private readonly products: Product[] = seedProducts) {}

  async list(): Promise<Product[]> {
    return [...this.products];
  }

  async getBySlug(slug: string): Promise<Product | null> {
    return this.products.find((product) => product.slug === slug) ?? null;
  }

  async search(query: string): Promise<Product[]> {
    const q = query.toLowerCase().trim();
    if (!q) return this.list();
    return this.products.filter(
      (product) =>
        product.name.toLowerCase().includes(q) ||
        product.description.toLowerCase().includes(q) ||
        product.tags.some((tag) => tag.includes(q)),
    );
  }

  async similar(productId: string, limit = 3): Promise<Product[]> {
    const source = this.products.find((product) => product.id === productId);
    if (!source) return [];
    return this.products
      .filter((product) => product.id !== productId)
      .map((product) => ({
        product,
        score: product.tags.filter((tag) => source.tags.includes(tag)).length,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((entry) => entry.product);
  }
}
