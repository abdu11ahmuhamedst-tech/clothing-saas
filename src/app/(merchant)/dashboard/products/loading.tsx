export default function ProductsLoading() {
  return <main id="main" className="shell py-10" aria-busy="true" aria-label="Loading products">
    <p role="status" className="text-sm text-stone-600">Loading your catalog…</p>
    <div className="mt-10 space-y-6" aria-hidden="true">{[1, 2, 3].map((item) => <div key={item} className="h-48 rounded-xl border border-stone-200 bg-white motion-safe:animate-pulse" />)}</div>
  </main>;
}
