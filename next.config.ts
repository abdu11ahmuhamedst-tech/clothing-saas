import type { NextConfig } from "next";
import { securityHeaders } from "./src/config/security.mjs";
const config: NextConfig = {
  poweredByHeader: false,
  async headers() { return [{ source: "/:path*", headers: securityHeaders }]; },
};
export default config;
