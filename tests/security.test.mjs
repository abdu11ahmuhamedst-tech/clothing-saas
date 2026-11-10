import assert from "node:assert/strict";
import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { securityHeaders } from "../src/config/security.mjs";

test("baseline headers deny framing and MIME sniffing", () => {
  const headers = Object.fromEntries(securityHeaders.map(({ key, value }) => [key, value]));
  assert.equal(headers["X-Frame-Options"], "DENY");
  assert.equal(headers["X-Content-Type-Options"], "nosniff");
  assert.equal(headers["Referrer-Policy"], "strict-origin-when-cross-origin");
  assert.equal(headers["Permissions-Policy"], "camera=(), microphone=(), geolocation=()");
});

test("Git ignores environment files, credentials, dependencies and build artifacts", () => {
  const paths = [".env", ".env.local", ".env.production", ".env.secret", ".aws/credentials", "credentials.json", "private.key", ".npmrc", "node_modules/example.js", ".next/server/app.js"];
  const ignored = execFileSync("git", ["check-ignore", "--no-index", "--stdin"], { input: paths.join("\n"), encoding: "utf8" }).trim().split("\n");
  assert.deepEqual(ignored, paths);
  const result = execFileSync("git", ["check-ignore", "--no-index", "--non-matching", "--verbose", ".env.example"], { encoding: "utf8" });
  assert.match(result, /!\.env\.example/);
});

test("environment template contains empty placeholders only", () => {
  const lines = readFileSync(new URL("../.env.example", import.meta.url), "utf8").trim().split("\n");
  for (const line of lines) assert.match(line, /^[A-Z][A-Z0-9_]*=$/);
});
