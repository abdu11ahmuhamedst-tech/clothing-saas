import { randomUUID } from "node:crypto";
import { loadMemberStores } from "../auth/operations.mjs";
import { UUID, validateProduct, validateVariant, validateVariants } from "./validate.mjs";

const failure = (message, outcome = "error", productId = null) => ({ outcome, message, productId });
function databaseFailure(error, kind, productId, partial = false) {
  const known = ["23505", "23503", "23514", "23502", "42501", "22001", "22003"].includes(error?.code);
  const message = error?.code === "23505" ? (kind === "product" ? "That slug or submission already exists. Check the catalog before retrying." : "That SKU or size/color combination already exists.")
    : error?.code === "42501" ? "Your account cannot save these fields. No permissions were changed."
    : error?.code === "23503" ? "A related record changed or is unavailable. Reload and select it again."
    : known ? "The database rejected these values. Check the fields and try again."
    : "The save result could not be confirmed. Reload the catalog/editor before retrying; do not resubmit blindly.";
  return failure(partial ? `The product draft was saved. ${message}` : message, known ? (partial ? "partial" : "error") : "uncertain", productId);
}
async function memberStore(client, storeId) {
  if (typeof storeId !== "string" || !UUID.test(storeId)) return null;
  const result = await loadMemberStores(client); // getUser + current database memberships, every write.
  if (result.status !== "ready") return null;
  return result.stores.find((store) => store.id === storeId) ?? null;
}
async function ownedProduct(client, storeId, productId) {
  if (typeof productId !== "string" || !UUID.test(productId)) return null;
  const result = await client.from("products").select("id,store_id,is_published")
    .eq("store_id", storeId).eq("id", productId).maybeSingle();
  if (result.error || result.data?.store_id !== storeId || result.data?.id !== productId) return null;
  return result.data;
}
async function validCategory(client, storeId, categoryId) {
  if (categoryId === null) return true;
  const result = await client.from("categories").select("id,store_id").eq("store_id", storeId).eq("id", categoryId).maybeSingle();
  return !result.error && result.data?.id === categoryId && result.data?.store_id === storeId;
}

// No upsert, deletes or guessed RPC. Separate API calls are explicitly NOT a transaction.
export async function createDraft(client, storeId, draftId, productInput, variantInputs) {
  let saved = false;
  let attempted = false;
  try {
    let product, variants;
    try { product = validateProduct(productInput); variants = validateVariants(variantInputs); }
    catch (error) { return failure(error.message); }
    if (!UUID.test(draftId)) return failure("Invalid submission. Reload the form.");
    const store = await memberStore(client, storeId);
    if (!store) return failure("Store access could not be verified. Sign in or reload.");
    if (!await validCategory(client, store.id, product.category_id)) return failure("The selected category is not available to this store.");
    attempted = true;
    const inserted = await client.from("products").insert({ ...product, id: draftId, store_id: store.id, is_published: false }).select("id").single();
    if (inserted.error) return databaseFailure(inserted.error, "product", draftId);
    if (inserted.data?.id !== draftId) return failure("The draft save could not be confirmed. Check the catalog before retrying.", "uncertain", draftId);
    saved = true;
    // Recheck authentication/membership immediately before the next independent mutation.
    if (!await memberStore(client, store.id) || !await ownedProduct(client, store.id, draftId)) {
      return failure("The product draft was saved, but access changed before variants could be saved. Reload the catalog.", "partial", draftId);
    }
    const result = await client.from("product_variants").insert(variants.map((row) => ({ ...row, id: randomUUID(), store_id: store.id, product_id: draftId, is_published: false })));
    if (result.error) return databaseFailure(result.error, "variant", draftId, true);
    return { outcome: "saved", productId: draftId, message: "Draft and variants saved. Open the editor to review and publish them separately." };
  } catch {
    return failure(saved ? "The product draft was saved; variant results are uncertain. Reload the editor before adding variants again."
      : "The save result could not be confirmed. Check the catalog before retrying.", attempted ? "uncertain" : "error", attempted ? draftId : null);
  }
}

export async function saveProduct(client, storeId, productId, input) {
  let attempted = false;
  try {
    let fields;
    try { fields = validateProduct(input); } catch (error) { return failure(error.message); }
    const store = await memberStore(client, storeId);
    if (!store || !await ownedProduct(client, store.id, productId)) return failure("Product access could not be verified. Reload the catalog.");
    if (!await validCategory(client, store.id, fields.category_id)) return failure("The selected category is not available to this store.");
    attempted = true;
    const result = await client.from("products").update(fields).eq("store_id", store.id).eq("id", productId).select("id");
    if (result.error) return databaseFailure(result.error, "product", productId);
    if (result.data?.length !== 1 || result.data[0].id !== productId) return failure("No product save was confirmed. Access may have changed. Reload before retrying.", "uncertain", productId);
    return { outcome: "saved", productId, message: "Product details saved. Variant changes are saved independently." };
  } catch { return failure("The save could not be confirmed. Reload before retrying.", attempted ? "uncertain" : "error", productId); }
}

/** @param {number | null} expectedStock */
export async function saveVariant(client, storeId, productId, variantId, input, create = false, expectedStock = null) {
  let attempted = false;
  try {
    let fields;
    try { fields = validateVariant(input); } catch (error) { return failure(error.message); }
    if (!UUID.test(variantId)) return failure("Invalid variant. Reload the editor.");
    const store = await memberStore(client, storeId);
    if (!store || !await ownedProduct(client, store.id, productId)) return failure("Product access could not be verified. Reload the catalog.");
    if (!create) {
      const existing = await client.from("product_variants").select("id,store_id,product_id,stock_quantity")
        .eq("store_id", store.id).eq("product_id", productId).eq("id", variantId).maybeSingle();
      if (existing.error || existing.data?.id !== variantId || existing.data?.store_id !== store.id || existing.data?.product_id !== productId) {
        return failure("Variant access could not be verified. Reload the editor.");
      }
    }
    if (!create && (!Number.isInteger(expectedStock) || expectedStock < 0 || expectedStock > 2147483647)) return failure("Reload the editor to verify current stock.");
    attempted = true;
    const result = create
      ? await client.from("product_variants").insert({ ...fields, id: variantId, store_id: store.id, product_id: productId }).select("id")
      : await client.from("product_variants").update(fields).eq("store_id", store.id).eq("product_id", productId).eq("id", variantId).eq("stock_quantity", expectedStock).select("id");
    if (result.error) return databaseFailure(result.error, "variant", productId);
    if (result.data?.length !== 1 || result.data[0].id !== variantId) return failure("No variant save was confirmed. Stock or access may have changed. Reload the editor before retrying.", "uncertain", productId);
    return { outcome: "saved", productId, message: create ? "Variant added. Reload the editor before adding another." : "Variant saved." };
  } catch { return failure("The variant save could not be confirmed. Reload before retrying.", attempted ? "uncertain" : "error", productId); }
}
