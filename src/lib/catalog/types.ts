export type CatalogStore = {
  id: string; name: string; slug: string; status: string; currency: string; role: string;
};
export type CatalogVariant = {
  id: string; size: string; color: string; sku: string;
  priceCents: number | null; stockQuantity: number | null; published: boolean;
};
export type CatalogProduct = {
  id: string; name: string; slug: string; description: string;
  published: boolean; category: string; variants: CatalogVariant[];
};
export type CatalogResult = {
  status: "ready" | "unauthorized" | "unavailable" | "not-found";
  stores: CatalogStore[]; store: CatalogStore | null; products: CatalogProduct[];
  page: number; hasNext: boolean;
};
