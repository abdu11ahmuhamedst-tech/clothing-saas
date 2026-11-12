import { loadMemberStores } from "../auth/operations.mjs";
import { UUID, decimalPrice } from "./validate.mjs";

/** @returns {Promise<import('./editor-types').EditorContext>} */
export async function loadEditor(client, storeId, productId) {
  const empty = { store: null, categories: [], product: null, variants: [] };
  try {
    const member = await loadMemberStores(client);
    if (member.status !== "ready") return { ...empty, status: member.status };
    const store = typeof storeId === "string" && UUID.test(storeId) ? member.stores.find((item) => item.id === storeId) : null;
    if (!store) return { ...empty, status: "not-found" };
    const categories = await client.from("categories").select("id,store_id,name", { count: "exact" }).eq("store_id", store.id).order("name").range(0, 999);
    if (categories.error || !Array.isArray(categories.data) || !Number.isSafeInteger(categories.count) || categories.count > categories.data.length) return { ...empty, store, status: "unavailable" };
    const choices = categories.data.filter((item) => item.store_id === store.id).map((item) => ({id:item.id,name:item.name}));
    if (productId === undefined) return { ...empty, store, categories: choices, status: "ready" };
    if (!UUID.test(productId)) return { ...empty, status: "not-found" };
    const product = await client.from("products").select("id,store_id,category_id,name,slug,description,is_published")
      .eq("store_id", store.id).eq("id", productId).maybeSingle();
    if (product.error) return { ...empty, store, status: "unavailable" };
    if (product.data?.id !== productId || product.data?.store_id !== store.id) return { ...empty, status: "not-found" };
    const variants = await client.from("product_variants").select("id,store_id,product_id,size,color,sku,price_cents,stock_quantity,is_published", {count:"exact"})
      .eq("store_id", store.id).eq("product_id", productId).order("id").range(0,999);
    if (variants.error || !Array.isArray(variants.data) || !Number.isSafeInteger(variants.count) || variants.count > variants.data.length) return { ...empty, store, status: "unavailable" };
    const row = product.data;
    return { status:"ready",store,categories:choices,
      product:{id:row.id,name:row.name,slug:row.slug,description:row.description ?? "",category_id:row.category_id,is_published:row.is_published===true},
      variants:variants.data.filter((item) => item.store_id===store.id && item.product_id===productId).map((item) => ({
        id:item.id,size:item.size ?? "",color:item.color ?? "",sku:item.sku ?? "",price:decimalPrice(item.price_cents),
        stock_quantity:Number.isInteger(item.stock_quantity) && item.stock_quantity>=0 ? String(item.stock_quantity) : "",
        is_published:item.is_published===true,
      })),
    };
  } catch { return {...empty,status:"unavailable"}; }
}
