"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getPublicSupabaseConfig } from "./config.mjs";

export function createBrowserSupabaseClient() {
  const { url, key } = getPublicSupabaseConfig();
  return createBrowserClient(url, key, {
    cookieOptions: { path: "/", sameSite: "lax", secure: process.env.NODE_ENV === "production" },
  });
}
