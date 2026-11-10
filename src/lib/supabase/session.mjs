import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server.js";
import { getPublicSupabaseConfig } from "./config.mjs";

/**
 * Refresh only scoped Auth/merchant traffic. This does not authorize tenant data.
 * @param {import('next/server').NextRequest} request
 * @param {{ clientFactory?: typeof createServerClient, configuration?: () => {url: string, key: string} }} dependencies
 */
export async function updateSession(request, {
  clientFactory = createServerClient,
  configuration = getPublicSupabaseConfig,
} = {}) {
  let response = NextResponse.next({ request });
  const refreshedCookies = new Map();
  const refreshHeaders = new Headers();
  const finish = (result) => {
    for (const { name, value, options } of refreshedCookies.values()) {
      result.cookies.set(name, value, options);
    }
    refreshHeaders.forEach((value, name) => result.headers.set(name, value));
    result.headers.set("Cache-Control", "private, no-store");
    result.headers.set("Pragma", "no-cache");
    result.headers.set("Expires", "0");
    return result;
  };
  try {
    const { url, key } = configuration();
    const supabase = clientFactory(url, key, {
      cookieOptions: { path: "/", sameSite: "lax", secure: process.env.NODE_ENV === "production" },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          for (const cookie of cookiesToSet) {
            request.cookies.set(cookie.name, cookie.value);
            refreshedCookies.set(cookie.name, cookie);
          }
          // Rebuild downstream request headers after updating its cookies.
          response = NextResponse.next({ request });
          new Headers(headers).forEach((value, name) => refreshHeaders.set(name, value));
        },
      },
    });
    const { data, error } = await supabase.auth.getClaims();
    const dashboard = request.nextUrl.pathname === "/dashboard" || request.nextUrl.pathname.startsWith("/dashboard/");
    if (dashboard && (error || !data?.claims?.sub)) {
      return finish(NextResponse.json({ error: "Authentication required." }, { status: 401 }));
    }
    return finish(response);
  } catch {
    // No tokens, SDK errors, configuration values or request URLs enter logs/responses.
    return finish(NextResponse.json({ error: "Authentication is temporarily unavailable." }, { status: 503 }));
  }
}
