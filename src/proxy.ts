import type { NextRequest } from "next/server";
import { updateSession } from "./lib/supabase/session.mjs";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

// Keep the public marketing page independent of Supabase configuration/network.
export const config = {
  matcher: ["/dashboard/:path*", "/auth/:path*", "/login", "/signup"],
};
