import "server-only";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { loadEditor } from "@/lib/catalog/editor-read.mjs";
import type { EditorContext } from "@/lib/catalog/editor-types";

export async function editorContext(storeId:string,productId?:string):Promise<EditorContext> {
  let result:EditorContext;
  try { result=await loadEditor(await createServerSupabaseClient({readOnlyCookies:true}),storeId,productId); }
  catch { result={status:"unavailable",store:null,product:null,categories:[],variants:[]}; }
  if (result.status==="unauthorized") redirect("/login?notice=expired");
  if (result.status==="not-found") notFound();
  return result;
}
export function EditorFrame({title,storeId,children}:{title:string;storeId:string;children:React.ReactNode}) {
  return <main id="main" className="shell py-10"><header className="flex flex-wrap items-center justify-between gap-4"><Brand />
    <Link href={`/dashboard/products?store=${encodeURIComponent(storeId)}`} className="text-sm underline">Back to products</Link></header>
    <section className="mx-auto mt-12 max-w-4xl"><h1 className="mb-8 text-3xl font-medium tracking-tight">{title}</h1>{children}</section>
  </main>;
}
export function EditorUnavailable() {
  return <p role="alert" className="rounded-xl border border-stone-200 bg-white p-6">The editor is temporarily unavailable. Reload the page to try again.</p>;
}
