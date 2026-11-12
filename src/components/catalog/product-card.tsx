import Link from "next/link";
import type { CatalogProduct } from "@/lib/catalog/types";
import { formatPrice } from "@/lib/catalog/format.mjs";
import { PublicationBadge } from "./publication-badge";

export function ProductCard({ product, currency, storeId }: { product: CatalogProduct; currency: string; storeId: string }) {
  return <article className="min-w-0 overflow-hidden rounded-xl border border-stone-200 bg-white">
    <div className="flex flex-wrap items-start justify-between gap-4 p-6">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-stone-500">{product.category}</p>
        <h2 className="mt-2 break-words text-xl font-medium tracking-tight">{product.name}</h2>
        {product.slug && <p className="mt-1 break-words text-xs text-stone-500">{product.slug}</p>}
        {product.description && <p className="mt-3 line-clamp-3 whitespace-pre-line break-words text-sm leading-relaxed text-stone-600">{product.description}</p>}
      </div>
      <div className="grid justify-items-end gap-3"><PublicationBadge published={product.published} /><Link href={`/dashboard/products/${encodeURIComponent(product.id)}/edit?store=${encodeURIComponent(storeId)}`} className="text-sm underline">Edit product</Link></div>
    </div>
    {product.variants.length === 0 ? <p className="border-t border-stone-100 px-6 py-5 text-sm text-stone-500">No variants available for this product.</p> :
      <div className="overflow-x-auto border-t border-stone-100" role="region" aria-label={`${product.name} variants`} tabIndex={0}>
        <table className="w-full min-w-[580px] text-left text-sm">
          <caption className="sr-only">Sizes, colors, prices and stock for {product.name}</caption>
          <thead className="bg-stone-50 text-xs text-stone-500"><tr>
            {["Size", "Color / SKU", "Price", "Stock", "Status"].map((title) => <th key={title} scope="col" className="px-6 py-3 font-medium">{title}</th>)}
          </tr></thead>
          <tbody>{product.variants.map((variant) => <tr key={variant.id} className="border-t border-stone-100">
            <td className="px-6 py-4">{variant.size}</td>
            <td className="max-w-56 break-words px-6 py-4">{variant.color}<span className="mt-1 block text-xs text-stone-500">{variant.sku}</span></td>
            <td className="whitespace-nowrap px-6 py-4 tabular-nums">{formatPrice(variant.priceCents, currency)}</td>
            <td className="px-6 py-4 tabular-nums">{variant.stockQuantity === null ? "Unavailable" : variant.stockQuantity === 0 ? "Out of stock" : variant.stockQuantity}</td>
            <td className="px-6 py-4"><PublicationBadge published={variant.published} /></td>
          </tr>)}</tbody>
        </table>
      </div>}
  </article>;
}
