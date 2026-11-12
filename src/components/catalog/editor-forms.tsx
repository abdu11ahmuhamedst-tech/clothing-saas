"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import type { ProductFields, VariantFields, SaveState } from "@/lib/catalog/editor-types";

type Action = (previous: SaveState, data: FormData) => Promise<SaveState>;
const initial: SaveState = { outcome:"idle",message:"",productId:null };
const inputClass = "w-full rounded border border-stone-300 bg-white p-3 font-normal";
function SaveMessage({ state, storeId }: { state: SaveState; storeId: string }) {
  if (!state.message) return null;
  return <div role={state.outcome === "saved" ? "status" : "alert"} className={`my-5 rounded border p-4 text-sm ${state.outcome === "saved" ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
    <p>{state.message}</p>
    {state.productId && <Link href={`/dashboard/products/${encodeURIComponent(state.productId)}/edit?store=${encodeURIComponent(storeId)}`} className="mt-3 inline-block font-medium underline">Open editor / check saved state</Link>}
  </div>;
}
function ProductInputs({ product, categories, create = false }: { product?: ProductFields; categories: {id:string;name:string}[]; create?:boolean }) {
  return <div className="grid gap-5">
    <label className="grid gap-2 text-sm font-medium">Product name<input className={inputClass} name="name" required maxLength={200} defaultValue={product?.name ?? ""} /></label>
    <label className="grid gap-2 text-sm font-medium">Slug<input className={inputClass} name="slug" required maxLength={160} pattern="[a-z0-9]+(-[a-z0-9]+)*" defaultValue={product?.slug ?? ""} /><span className="text-xs font-normal text-stone-500">Lowercase letters, numbers and hyphens; unique within this store.</span></label>
    <label className="grid gap-2 text-sm font-medium">Description<textarea className={inputClass} name="description" maxLength={10000} rows={4} defaultValue={product?.description ?? ""} /></label>
    <label className="grid gap-2 text-sm font-medium">Existing category<select className={inputClass} name="category_id" defaultValue={product?.category_id ?? ""}>
      <option value="">Uncategorized</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
    </select></label>
    {create ? <p className="text-sm text-stone-600">New products and variants are saved as drafts. Review and publish them individually in the editor after creation.</p> : <label className="flex items-center gap-3 text-sm font-medium"><input type="checkbox" name="is_published" defaultChecked={product?.is_published} />Published</label>}
  </div>;
}
function VariantInputs({ variant, currency }: { variant?:VariantFields;currency:string }) {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    <label className="grid gap-2 text-sm font-medium">Size<input name="size" className={inputClass} required maxLength={60} defaultValue={variant?.size ?? ""} /></label>
    <label className="grid gap-2 text-sm font-medium">Color<input name="color" className={inputClass} required maxLength={60} defaultValue={variant?.color ?? ""} /></label>
    <label className="grid gap-2 text-sm font-medium">SKU<input name="sku" className={inputClass} required maxLength={100} defaultValue={variant?.sku ?? ""} /></label>
    <label className="grid gap-2 text-sm font-medium">Price ({currency}; 2 decimals)<input name="price" className={inputClass} required inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,2})?" defaultValue={variant?.price ?? ""} /></label>
    <label className="grid gap-2 text-sm font-medium">Stock quantity<input name="stock_quantity" className={inputClass} required inputMode="numeric" pattern="[0-9]+" defaultValue={variant?.stock_quantity ?? "0"} /></label>
    <label className="flex items-center gap-3 text-sm font-medium"><input name="is_published" type="checkbox" defaultChecked={variant?.is_published ?? false} />Published</label>
  </div>;
}

export function ProductForm({ action, product, categories, storeId }: {action:Action;product:ProductFields;categories:{id:string;name:string}[];storeId:string}) {
  const [state,formAction]=useActionState(action,initial);
  return <form action={formAction} className="rounded-xl border border-stone-200 bg-white p-6">
    <h2 className="mb-5 text-xl font-medium">Product details</h2><SaveMessage state={state} storeId={storeId} />
    <fieldset disabled={state.outcome === "uncertain"} className="grid gap-6"><ProductInputs product={product} categories={categories} /><SubmitButton label="Save product details" pendingLabel="Saving…" /></fieldset>
    <p className="mt-4 text-xs text-stone-500">Save each variant separately. Publish only after confirming all desired variants were saved.</p>
  </form>;
}
export function VariantForm({ action, variant, currency, storeId, create = false }: {action:Action;variant?:VariantFields;currency:string;storeId:string;create?:boolean}) {
  const [state,formAction]=useActionState(action,initial);
  return <form action={formAction} className="rounded-xl border border-stone-200 bg-white p-6">
    <h3 className="mb-5 font-medium">{create ? "Add a variant" : `${variant?.size} / ${variant?.color} — ${variant?.sku}`}</h3>
    <SaveMessage state={state} storeId={storeId} /><fieldset disabled={state.outcome === "uncertain" || state.outcome === "saved"} className="grid gap-5">
      <VariantInputs variant={variant} currency={currency} /><SubmitButton label={create ? "Add variant" : "Save variant"} pendingLabel="Saving…" />
    </fieldset><p className="mt-4 text-xs text-stone-500">Stock is an absolute quantity. Reload if stock changed while you were editing.</p>
  </form>;
}

type DraftVariant = { size:string;color:string;sku:string;price:string;stock_quantity:string;is_published:boolean };
const blank = ():DraftVariant => ({size:"",color:"",sku:"",price:"",stock_quantity:"0",is_published:false});
export function NewProductForm({action,categories,storeId,currency}:{action:Action;categories:{id:string;name:string}[];storeId:string;currency:string}) {
  const [state,formAction]=useActionState(action,initial);
  const [variants,setVariants]=useState<DraftVariant[]>([blank()]);
  const blocked=["saved","partial","uncertain"].includes(state.outcome);
  function update(index:number,field:keyof DraftVariant,value:string) {
    setVariants((rows) => rows.map((row,i) => i===index ? {...row,[field]:value} : row));
  }
  return <form action={formAction} className="grid gap-6">
    <SaveMessage state={state} storeId={storeId} />
    <fieldset disabled={blocked} className="grid gap-6">
      <div className="rounded-xl border border-stone-200 bg-white p-6"><h2 className="mb-5 text-xl font-medium">Product details</h2><ProductInputs categories={categories} create /></div>
      <input type="hidden" name="variants" value={JSON.stringify(variants)} />
      {variants.map((variant,index) => <div key={index} className="rounded-xl border border-stone-200 bg-white p-6">
        <div className="mb-5 flex items-center justify-between"><h3 className="font-medium">Variant {index+1} · Draft</h3>
          {variants.length>1 && <button type="button" className="text-sm underline" onClick={() => setVariants((rows) => rows.filter((_,i) => i!==index))}>Remove unsaved row</button>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {([['size','Size'],['color','Color'],['sku','SKU'],['price',`Price (${currency}; 2 decimals)`],['stock_quantity','Stock quantity']] as const).map(([field,label]) =>
            <label key={field} className="grid gap-2 text-sm font-medium">{label}<input className={inputClass} required value={variant[field]} maxLength={field==='sku'?100:field==='price'?30:field==='stock_quantity'?10:60}
              inputMode={field==='price'?'decimal':field==='stock_quantity'?'numeric':'text'} onChange={(event) => update(index,field,event.target.value)} /></label>)}
        </div>
      </div>)}
      <div className="flex flex-wrap items-center gap-5">
        <button type="button" disabled={variants.length>=20} onClick={() => setVariants((rows) => [...rows,blank()])} className="text-sm underline disabled:opacity-50">Add variant row</button>
        <SubmitButton label="Create product draft" pendingLabel="Saving draft…" />
      </div>
    </fieldset>
    <p className="text-sm text-stone-600">Product and variant saves are separate requests. If any step fails, the draft is kept for recovery; no saved records are deleted. Never resubmit after an uncertain result until you check the editor.</p>
  </form>;
}
