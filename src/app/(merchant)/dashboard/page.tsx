import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { SubmitButton } from "@/components/submit-button";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { loadMemberStores } from "@/lib/auth/operations.mjs";
import { logout } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your stores — Clothing SaaS", robots: { index: false, follow: false } };

type StoreSummary = {
  id: string; name: string; slug: string; status: string; currency: string; role: "owner" | "staff";
};

async function readDashboard(): Promise<{ status: string; stores: StoreSummary[] }> {
  try {
    const client = await createServerSupabaseClient({ readOnlyCookies: true });
    return await loadMemberStores(client);
  } catch {
    return { status: "unavailable", stores: [] };
  }
}

export default async function DashboardPage({ searchParams }: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const result = await readDashboard();
  if (result.status === "unauthorized") redirect("/login?notice=expired");
  const params = await searchParams;
  return <main id="main" className="shell py-10">
    <header className="flex flex-wrap items-center justify-between gap-5">
      <Brand />
      <form action={logout}><SubmitButton label="Sign out" pendingLabel="Signing out…" /></form>
    </header>
    <section className="mt-14" aria-labelledby="stores-title">
      <p className="eyebrow">Merchant dashboard</p>
      <h1 id="stores-title" className="mt-3 text-4xl font-medium tracking-tight">Your stores</h1>
      {params.notice === "logout-failed" && <p role="alert" className="mt-5 text-red-900">Sign-out could not be completed. Please try again.</p>}
      {result.status === "unavailable" ? <div role="alert" className="mt-8 rounded-xl border border-stone-200 bg-white p-6">
        <p>We couldn’t load your stores. Please try again shortly.</p>
        <Link href="/dashboard" className="mt-4 inline-block underline underline-offset-4">Try again</Link>
      </div> : result.stores.length === 0 ? <div className="mt-8 rounded-xl border border-stone-200 bg-white p-6">
        <h2 className="text-xl font-medium">No stores assigned yet</h2>
        <p className="mt-3 text-stone-600">You’re signed in, but no stores are available to your account. Contact your store administrator.</p>
      </div> : <ul className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {result.stores.map((store) => <li key={store.id} className="rounded-xl border border-stone-200 bg-white p-6">
          <h2 className="text-xl font-medium">{store.name}</h2>
          <p className="mt-2 text-sm text-stone-500">{store.slug}</p>
          <dl className="mt-5 grid grid-cols-2 gap-2 text-sm">
            <dt className="text-stone-500">Your role</dt><dd>{store.role}</dd>
            <dt className="text-stone-500">Status</dt><dd>{store.status}</dd>
            <dt className="text-stone-500">Currency</dt><dd>{store.currency}</dd>
          </dl>
          <Link href={`/dashboard/products?store=${encodeURIComponent(store.id)}`} className="mt-6 inline-block text-sm font-medium underline underline-offset-4">View products →</Link>
        </li>)}
      </ul>}
    </section>
  </main>;
}
