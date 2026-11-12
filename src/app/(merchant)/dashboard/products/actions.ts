"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createDraft, saveProduct, saveVariant } from "@/lib/catalog/write.mjs";
import type { SaveState } from "@/lib/catalog/editor-types";

function productInput(data: FormData, create = false) {
  return { name:data.get("name"),slug:data.get("slug"),description:data.get("description"),category_id:data.get("category_id"),is_published:create ? false : data.get("is_published")==="on" };
}
function variantInput(data: FormData) {
  return { size:data.get("size"),color:data.get("color"),sku:data.get("sku"),price:data.get("price"),stock_quantity:data.get("stock_quantity"),is_published:data.get("is_published")==="on" };
}
const unavailable: SaveState = { outcome:"error",message:"Saving is temporarily unavailable. Please reload and try again.",productId:null };
function refreshCatalog() {
  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/products/[productId]/edit", "page");
  revalidatePath("/dashboard");
}

export async function createProductAction(storeId: string, draftId: string, _previous: SaveState, data: FormData): Promise<SaveState> {
  let variants;
  const encoded = data.get("variants");
  if (typeof encoded !== "string" || encoded.length > 100000) return { ...unavailable,message:"The variant list is invalid or too large." };
  try { variants = JSON.parse(encoded); } catch { return { ...unavailable,message:"The variant list is invalid." }; }
  let result: SaveState;
  try { result = await createDraft(await createServerSupabaseClient(),storeId,draftId,productInput(data,true),variants); }
  catch { return unavailable; }
  if (result.outcome !== "error") refreshCatalog();
  return result;
}

export async function updateProductAction(storeId: string, productId: string, _previous: SaveState, data: FormData): Promise<SaveState> {
  let result: SaveState;
  try { result = await saveProduct(await createServerSupabaseClient(),storeId,productId,productInput(data)); }
  catch { return unavailable; }
  if (result.outcome !== "error") refreshCatalog();
  if (result.outcome === "saved") redirect(`/dashboard/products/${encodeURIComponent(productId)}/edit?store=${encodeURIComponent(storeId)}&saved=product`);
  return result;
}

export async function updateVariantAction(storeId: string, productId: string, variantId: string, expectedStock: number, _previous: SaveState, data: FormData): Promise<SaveState> {
  let result: SaveState;
  try { result = await saveVariant(await createServerSupabaseClient(),storeId,productId,variantId,variantInput(data),false,expectedStock); }
  catch { return unavailable; }
  if (result.outcome !== "error") refreshCatalog();
  if (result.outcome === "saved") redirect(`/dashboard/products/${encodeURIComponent(productId)}/edit?store=${encodeURIComponent(storeId)}&saved=variant`);
  return result;
}

export async function addVariantAction(storeId: string, productId: string, variantId: string, _previous: SaveState, data: FormData): Promise<SaveState> {
  let result: SaveState;
  try { result = await saveVariant(await createServerSupabaseClient(),storeId,productId,variantId,variantInput(data),true); }
  catch { return unavailable; }
  if (result.outcome !== "error") refreshCatalog();
  if (result.outcome === "saved") redirect(`/dashboard/products/${encodeURIComponent(productId)}/edit?store=${encodeURIComponent(storeId)}&saved=variant`);
  return result;
}
