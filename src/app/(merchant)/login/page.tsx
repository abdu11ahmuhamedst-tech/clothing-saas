import Link from "next/link";
import { Brand } from "@/components/brand";
import { SubmitButton } from "@/components/submit-button";
import { login } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in — Clothing SaaS", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const params = await searchParams;
  const error = params.error === "signin" ? "Unable to sign in. Check your email and password, then try again."
    : params.error === "unavailable" ? "Sign-in is temporarily unavailable. Please try again."
    : params.notice === "expired" ? "Your session has ended. Please sign in again." : null;
  return <main id="main" className="shell py-10">
    <Brand />
    <section className="mx-auto mt-16 max-w-md rounded-xl border border-stone-200 bg-white p-8" aria-labelledby="login-title">
      <p className="eyebrow">Merchant account</p>
      <h1 id="login-title" className="mt-3 text-3xl font-medium tracking-tight">Sign in to your stores</h1>
      <p className="mt-3 text-sm leading-relaxed text-stone-600">Use your existing merchant account. Contact your store administrator if you need access.</p>
      {error && <p role="alert" className="mt-5 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error}</p>}
      {params.notice === "signed-out" && <p role="status" className="mt-5 text-sm text-stone-600">You have signed out of this session.</p>}
      <form action={login} className="mt-6 grid gap-5">
        <label className="grid gap-2 text-sm font-medium">Email
          <input name="email" type="email" autoComplete="username" required maxLength={254} className="rounded border border-stone-300 p-3 font-normal" />
        </label>
        <label className="grid gap-2 text-sm font-medium">Password
          <input name="password" type="password" autoComplete="current-password" required maxLength={4096} className="rounded border border-stone-300 p-3 font-normal" />
        </label>
        <SubmitButton label="Sign in" pendingLabel="Signing in…" />
      </form>
      <Link href="/" className="mt-6 inline-block text-sm underline underline-offset-4">Back to homepage</Link>
    </section>
  </main>;
}
