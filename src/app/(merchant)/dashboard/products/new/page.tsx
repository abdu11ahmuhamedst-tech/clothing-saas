import { randomUUID } from "node:crypto";
import { NewProductForm } from "@/components/catalog/editor-forms";
import { editorContext,EditorFrame,EditorUnavailable } from "@/components/catalog/editor-page";
import { createProductAction } from "../actions";

export const dynamic="force-dynamic";
export const metadata={title:"Add product — Clothing SaaS",robots:{index:false,follow:false}};
export default async function NewProductPage({searchParams}:{searchParams:Promise<{store?:string|string[]}>}) {
  const params=await searchParams;
  const result=await editorContext(typeof params.store==="string"?params.store:"");
  return <EditorFrame title="Add product" storeId={result.store?.id ?? ""}>
    {result.status!=="ready" || !result.store ? <EditorUnavailable /> : <>
      <p className="mb-6 text-stone-600">{result.store.name} · Save a draft first, then review and publish.</p>
      <NewProductForm action={createProductAction.bind(null,result.store.id,randomUUID())} categories={result.categories} storeId={result.store.id} currency={result.store.currency} />
    </>}
  </EditorFrame>;
}
