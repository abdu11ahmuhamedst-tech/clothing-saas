import Link from "next/link";

export function Brand() {
  return <Link href="/" className="inline-flex items-center gap-3 font-semibold tracking-tight" aria-label="Clothing SaaS home"><span aria-hidden="true" className="grid size-9 place-items-center rounded-full bg-stone-900 text-sm text-white">c.</span>Clothing<span className="font-normal text-stone-500">SaaS</span></Link>;
}
