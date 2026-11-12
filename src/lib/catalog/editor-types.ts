import type { CatalogStore } from "./types";
export type ProductFields = { id: string; name: string; slug: string; description: string; category_id: string | null; is_published: boolean };
export type VariantFields = { id: string; size: string; color: string; sku: string; price: string; stock_quantity: string; is_published: boolean };
export type EditorContext = {
  status: string; store: CatalogStore | null; categories: { id: string; name: string }[];
  product: ProductFields | null; variants: VariantFields[];
};
export type SaveState = { outcome: string; message: string; productId: string | null };
