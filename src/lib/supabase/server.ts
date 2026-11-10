import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicSupabaseConfig } from "./config.mjs";

// Use readOnlyCookies only in Server Components after Proxy refresh.
// Auth mutations belong in Route Handlers/Server Actions with writable cookies.
export async function createServerSupabaseClient({ readOnlyCookies = false } = {}) {
  const { url, key } = getPublicSupabaseConfig();
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookieOptions: { path: "/", sameSite: "lax", secure: process.env.NODE_ENV === "production" },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        if (readOnlyCookies) return;
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
      },
    },
  });
}
