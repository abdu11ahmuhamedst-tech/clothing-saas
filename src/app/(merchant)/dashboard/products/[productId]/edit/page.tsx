import { randomUUID } from "node:crypto";
import { ProductForm,VariantForm } from "@/components/catalog/editor-forms";
import { editorContext,EditorFrame,EditorUnavailable } from "@/components/catalog/editor-page";
import { updateProductAction,updateVariantAction,addVariantAction } from "../../actions";

export const dynamic="force-dynamic";
export const metadata={title:"Edit product — Clothing SaaS",robots:{index:false,follow:false}};
export default async function EditProductPage({params,searchParams}:{params:Promise<{productId:string}>;searchParams:Promise<{store?:string|string[];saved?:string}>}) {
  const [{productId},query]=await Promise.all([params,searchParams]);
  const result=await editorContext(typeof query.store==="string"?query.store:"",productId);
  const store=result.store;
  const product=result.product;
  const newVariantId=randomUUID();
  return <EditorFrame title="Edit product" storeId={store?.id ?? ""}>
    {result.status!=="ready" || !store || !product ? <EditorUnavailable /> : <div className="grid gap-6">
      <p className="text-stone-600">{store.name} · Product details and each variant are saved independently.</p>
      {["product","variant"].includes(query.saved ?? "") && <p role="status" className="rounded border border-green-200 bg-green-50 p-4">Changes saved. Review the latest values below.</p>}
      <ProductForm key={JSON.stringify(product)} action={updateProductAction.bind(null,store.id,product.id)} product={product} categories={result.categories} storeId={store.id} />
      <h2 className="mt-4 text-2xl font-medium">Variants &amp; inventory</h2>
      {result.variants.length===0 && <p className="text-stone-600">No variants are saved yet. Add the missing variants below.</p>}
      {result.variants.map((variant) => <VariantForm key={JSON.stringify(variant)} action={updateVariantAction.bind(null,store.id,product.id,variant.id,Number(variant.stock_quantity))} variant={variant} currency={store.currency} storeId={store.id} />)}
      <VariantForm key={newVariantId} create action={addVariantAction.bind(null,store.id,product.id,newVariantId)} currency={store.currency} storeId={store.id} />
    </div>}
  </EditorFrame>;
}
