"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { passwordLogin, localLogout } from "@/lib/auth/operations.mjs";

// Server Actions use POST and Next.js's built-in Origin/Host checks.
// No user-provided redirect destination or tenant ID is accepted.
export async function login(formData: FormData) {
  const result = await passwordLogin(formData, createServerSupabaseClient);
  if (result === "success") redirect("/dashboard");
  redirect(result === "invalid" ? "/login?error=signin" : "/login?error=unavailable");
}

export async function logout() {
  const result = await localLogout(createServerSupabaseClient);
  if (result === "success") redirect("/login?notice=signed-out");
  // Do not claim logout succeeded if the SDK could not clear/revoke the session.
  redirect("/dashboard?notice=logout-failed");
}
