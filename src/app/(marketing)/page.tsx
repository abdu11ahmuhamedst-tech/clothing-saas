import { Brand } from "@/components/brand";

const features = [
  ["01", "A storefront that feels like you", "Your domain, your collection, your identity. A focused shopping experience built around your clothing brand."],
  ["02", "Every size. Every color.", "A planned catalog for products and variants, with inventory tools to keep your collection organized."],
  ["03", "Keep the conversation going", "Planned WhatsApp ordering connects a shopper’s selection with the conversation that closes the sale."],
];

export default function Home() {
  return <>
    <header className="shell flex flex-wrap items-center justify-between gap-5 py-6">
      <Brand />
      <nav aria-label="Main navigation" className="flex items-center gap-6 text-sm">
        <a className="nav-link" href="#platform">The platform</a>
        <a className="nav-link" href="#pricing">Pricing <span aria-hidden="true">↗</span></a>
      </nav>
    </header>
    <main id="main">
      <section className="shell grid items-center gap-12 pb-20 pt-12 lg:grid-cols-2 lg:gap-20 lg:pb-28 lg:pt-20" aria-labelledby="hero-title">
        <div>
          <p className="eyebrow mb-6 flex items-center gap-2"><span className="size-2 rounded-full bg-lime-700" /> Made for independent clothing stores</p>
          <h1 id="hero-title" className="max-w-xl text-5xl leading-[1.06] font-medium tracking-[-0.055em] sm:text-7xl">Your brand.<br />Your storefront.<br /><span className="font-serif italic text-stone-500">Room to grow.</span></h1>
          <p className="mt-7 max-w-md text-lg leading-relaxed text-stone-600">Bring your collection online with a dedicated space for your store. Simple tools, clear pricing, and a personal connection to your customers.</p>
          <a className="button mt-8" href="#platform">Explore the platform <span aria-hidden="true">↗</span></a>
          <p className="mt-5 text-xs text-stone-500">In development · Store onboarding is not open yet</p>
        </div>
        <div className="rounded-2xl bg-[#e8e9df] p-6 sm:p-10">
          <div className="mb-6 flex items-center justify-between text-xs text-stone-600"><span>YOUR NEXT CHAPTER</span><span>EST. BY YOU</span></div>
          <div className="overflow-hidden rounded-lg bg-[#faf9f6] shadow-xl shadow-stone-900/10">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 px-6 py-5"><span className="font-serif text-xl tracking-widest">STUDIO / 01</span><span className="text-xs text-stone-500">Illustrative storefront</span></div>
            <div className="garment-scene" role="img" aria-label="Illustration of a cream shirt on a sage background"><div className="garment" /><span className="absolute bottom-5 left-6 text-xs tracking-[0.18em] text-stone-600">THE EVERYDAY COLLECTION</span></div>
            <div className="flex items-end justify-between gap-3 p-6"><div><p className="text-xs text-stone-500">Considered essentials</p><p className="mt-1 font-serif text-2xl">A little less ordinary.</p></div><span aria-hidden="true" className="text-2xl">↗</span></div>
          </div>
          <p className="mt-6 text-center text-xs text-stone-600">An example of what your independent storefront could become.</p>
        </div>
      </section>
      <section id="platform" className="border-y border-stone-200 bg-white/60 py-20" aria-labelledby="platform-title">
        <div className="shell">
          <p className="eyebrow">The platform · Planned for the MVP</p>
          <h2 id="platform-title" className="mt-4 max-w-lg text-3xl font-medium tracking-tight sm:text-4xl">Less administration.<br />More time for your collection.</h2>
          <div className="mt-12 grid gap-10 md:grid-cols-3">{features.map(([number, title, description]) => <article key={number} className="border-t border-stone-300 pt-5"><p className="font-mono text-xs text-stone-500">{number} /</p><h3 className="mt-6 text-xl font-medium tracking-tight">{title}</h3><p className="mt-3 leading-relaxed text-stone-600">{description}</p></article>)}</div>
        </div>
      </section>
      <section id="pricing" className="shell grid gap-10 py-20 md:grid-cols-2 md:items-center" aria-labelledby="pricing-title">
        <div><p className="eyebrow">Simple pricing</p><h2 id="pricing-title" className="mt-4 text-3xl font-medium tracking-tight sm:text-4xl">Your next step,<br />with a clear starting point.</h2><p className="mt-5 max-w-sm leading-relaxed text-stone-600">One setup fee to get your store ready. A monthly fee for hosting and maintenance.</p></div>
        <div className="rounded-xl border border-stone-200 bg-white p-8 sm:p-10"><p className="eyebrow">Per store · USD</p><div className="mt-6 flex flex-wrap items-baseline gap-3"><span className="text-5xl font-medium tracking-tight">$25</span><span className="text-stone-500">/ month</span></div><p className="mt-3 text-stone-600">+ $300 one-time setup</p><div className="my-7 h-px bg-stone-200" /><p className="text-sm leading-relaxed text-stone-600">Planned package: dedicated storefront, custom domain support, product and inventory tools, and WhatsApp ordering.</p><p className="mt-5 text-xs font-medium text-stone-500">Coming soon. No payments or registrations collected here.</p></div>
      </section>
    </main>
    <footer className="shell flex flex-wrap items-center justify-between gap-5 border-t border-stone-200 py-8"><Brand /><p className="text-xs text-stone-500">Built for the businesses behind the brands.</p></footer>
  </>;
}
