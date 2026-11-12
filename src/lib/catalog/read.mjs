import { loadMemberStores } from "../auth/operations.mjs";

export const PAGE_SIZE = 20;
export function catalogPage(value) {
  const page = typeof value === "string" && /^[1-9]\d{0,4}$/.test(value) ? Number(value) : 1;
  return page <= 10000 ? page : 1;
}

/**
 * Read only through the caller's SSR client. Never accepts a privileged client.
 * @returns {Promise<import('./types').CatalogResult>}
 */
export async function loadCatalog(client, requestedStoreId, page = 1) {
  const empty = { stores: [], store: null, products: [], page, hasNext: false };
  try {
    const membership = await loadMemberStores(client);
    if (membership.status !== "ready") return { ...empty, status: membership.status };
    const stores = membership.stores;
    const store = requestedStoreId === undefined ? stores[0] : stores.find((item) => item.id === requestedStoreId);
    if (!store) return { ...empty, stores, status: requestedStoreId === undefined ? "ready" : "not-found" };
    // Only use the ID from the membership-validated store object from this point.
    const products = await client.from("products")
      .select("id,store_id,category_id,name,slug,description,is_published", { count: "exact" })
      .eq("store_id", store.id).order("name").order("id")
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    if (products.error || !Array.isArray(products.data) || !Number.isSafeInteger(products.count)) {
      return { ...empty, stores, store, status: "unavailable" };
    }
    const rows = products.data.filter((item) => item.store_id === store.id && typeof item.id === "string");
    if (rows.length === 0) return { ...empty, stores, store, status: "ready" };
    const categoryIds = [...new Set(rows.map((item) => item.category_id).filter((id) => typeof id === "string"))];
    const [categories, variants] = await Promise.all([
      categoryIds.length ? client.from("categories").select("id,store_id,name,slug,is_published")
        .eq("store_id", store.id).in("id", categoryIds) : Promise.resolve({ data: [], error: null }),
      client.from("product_variants")
        .select("id,store_id,product_id,size,color,sku,price_cents,stock_quantity,is_published", { count: "exact" })
        .eq("store_id", store.id).in("product_id", rows.map((item) => item.id)).order("id").range(0, 999),
    ]);
    if (categories.error || variants.error || !Array.isArray(categories.data) || !Array.isArray(variants.data) ||
        !Number.isSafeInteger(variants.count) || variants.count > variants.data.length) {
      // Do not silently display incomplete stock/prices if the API truncates variants.
      return { ...empty, stores, store, status: "unavailable" };
    }
    const categoryNames = new Map(categories.data.filter((item) => item.store_id === store.id)
      .map((item) => [item.id, typeof item.name === "string" ? item.name : "Category unavailable"]));
    const groupedVariants = new Map();
    const productIds = new Set(rows.map((item) => item.id));
    for (const variant of variants.data) {
      if (variant.store_id !== store.id || !productIds.has(variant.product_id) || typeof variant.id !== "string") continue;
      const list = groupedVariants.get(variant.product_id) ?? [];
      list.push({
        id: variant.id, size: typeof variant.size === "string" ? variant.size : "—",
        color: typeof variant.color === "string" ? variant.color : "—",
        sku: typeof variant.sku === "string" ? variant.sku : "—",
        priceCents: Number.isSafeInteger(variant.price_cents) && variant.price_cents >= 0 ? variant.price_cents : null,
        stockQuantity: Number.isSafeInteger(variant.stock_quantity) && variant.stock_quantity >= 0 ? variant.stock_quantity : null,
        published: variant.is_published === true,
      });
      groupedVariants.set(variant.product_id, list);
    }
    return {
      status: "ready", stores, store, page,
      hasNext: page * PAGE_SIZE < products.count,
      products: rows.map((item) => ({
        id: item.id, name: typeof item.name === "string" ? item.name : "Unnamed product",
        slug: typeof item.slug === "string" ? item.slug : "",
        description: typeof item.description === "string" ? item.description : "",
        published: item.is_published === true,
        category: item.category_id == null ? "Uncategorized" : categoryNames.get(item.category_id) ?? "Category unavailable",
        variants: groupedVariants.get(item.id) ?? [],
      })),
    };
  } catch {
    return { ...empty, status: "unavailable" };
  }
}
