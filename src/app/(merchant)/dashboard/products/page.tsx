import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { ProductCard } from "@/components/catalog/product-card";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { loadCatalog, catalogPage } from "@/lib/catalog/read.mjs";
import type { CatalogResult } from "@/lib/catalog/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Products — Clothing SaaS", robots: { index: false, follow: false } };

async function readCatalog(store: string | undefined, page: number): Promise<CatalogResult> {
  try {
    const client = await createServerSupabaseClient({ readOnlyCookies: true });
    return await loadCatalog(client, store, page);
  } catch {
    return { status: "unavailable", stores: [], store: null, products: [], page, hasNext: false };
  }
}

export default async function ProductsPage({ searchParams }: {
  searchParams: Promise<{ store?: string | string[]; page?: string | string[] }>;
}) {
  const params = await searchParams;
  const page = catalogPage(params.page);
  const result = await readCatalog(typeof params.store === "string" ? params.store : params.store === undefined ? undefined : "", page);
  if (result.status === "unauthorized") redirect("/login?notice=expired");
  if (result.status === "not-found") notFound();
  const href = (target: number) => `/dashboard/products?store=${encodeURIComponent(result.store?.id ?? "")}&page=${target}`;
  return <main id="main" className="shell py-10">
    <header className="flex flex-wrap items-center justify-between gap-5"><Brand /><Link href="/dashboard" className="text-sm underline underline-offset-4">Your stores</Link></header>
    <section className="mt-12" aria-labelledby="products-title">
      <p className="eyebrow">Merchant catalog</p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-5">
        <div><h1 id="products-title" className="text-4xl font-medium tracking-tight">Products</h1>
          <p className="mt-3 text-stone-600">{result.store ? result.store.name : "Your store catalog"}</p></div>
        <span className="rounded-full border border-stone-200 px-3 py-1.5 text-xs text-stone-500">Merchant catalog</span>
      </div>
      {result.status === "ready" && result.store && <Link href={`/dashboard/products/new?store=${encodeURIComponent(result.store.id)}`} className="button mt-6">Add product</Link>}
      {result.stores.length > 1 && <nav aria-label="Select store" className="mt-6 flex flex-wrap gap-2">
        {result.stores.map((store) => <Link key={store.id} href={`/dashboard/products?store=${encodeURIComponent(store.id)}`}
          aria-current={result.store?.id === store.id ? "page" : undefined}
          className={`rounded-full border px-4 py-2 text-sm ${result.store?.id === store.id ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 bg-white"}`}>{store.name}</Link>)}
      </nav>}
      {result.status === "unavailable" ? <div role="alert" className="mt-8 rounded-xl border border-stone-200 bg-white p-6">
        <h2 className="text-xl font-medium">Catalog temporarily unavailable</h2>
        <p className="mt-3 text-stone-600">We couldn’t load the catalog. Please try again shortly.</p>
        <Link href={result.store ? href(page) : "/dashboard/products"} className="mt-5 inline-block underline underline-offset-4">Try again</Link>
      </div> : !result.store ? <div className="mt-8 rounded-xl border border-stone-200 bg-white p-6">
        <h2 className="text-xl font-medium">No stores assigned yet</h2><p className="mt-3 text-stone-600">Contact your store administrator to get access.</p>
      </div> : <>
        {result.products.length === 0 ? <div className="mt-8 rounded-xl border border-stone-200 bg-white p-6">
          <h2 className="text-xl font-medium">{page === 1 ? "No products yet" : "No products on this page"}</h2>
          <p className="mt-3 text-stone-600">{page === 1 ? "This store has no products available to your account. Use Add product to save your first draft." : "Return to the previous page to see more products."}</p>
        </div> : <div className="mt-8 grid gap-6">{result.products.map((product) => <ProductCard key={product.id} product={product} currency={result.store!.currency} storeId={result.store!.id} />)}</div>}
        {(page > 1 || result.hasNext) && <nav aria-label="Product pages" className="mt-8 flex items-center justify-between gap-4 text-sm">
          {page > 1 ? <Link href={href(page - 1)} className="underline underline-offset-4">← Previous</Link> : <span />}
          <span className="text-stone-500">Page {page}</span>
          {result.hasNext ? <Link href={href(page + 1)} className="underline underline-offset-4">Next →</Link> : <span />}
        </nav>}
      </>}
    </section>
  </main>;
}
