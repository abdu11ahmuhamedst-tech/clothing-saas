# Clothing SaaS

Local application foundation: Next.js 16 App Router, React, TypeScript, Tailwind CSS 4, and ESLint. Requires Node.js 22 and npm.

## Setup

```sh
npm ci
npm run dev
```

Open http://localhost:3000. No environment variables or database connection are required. `.env.example` contains empty placeholders for future Supabase integration. When integration is implemented, use an ignored `.env.local`. Never put credentials in the example file or expose privileged keys through `NEXT_PUBLIC_*` variables.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

Typechecking generates route types before running TypeScript. Tests use Node's built-in runner to verify baseline header configuration, Git exclusions, and empty environment placeholders. Commit the lockfile for reproducible `npm ci` installs. System fonts and a CSS illustration require no external font or image requests.

## Architecture

- `src/app/layout.tsx`, `globals.css`: shared document, metadata, styles, and accessibility defaults.
- `src/app/(marketing)/page.tsx`: responsive platform homepage at `/`.
- `src/app/(storefront)/`: reserved for future custom-domain storefronts.
- `src/app/(merchant)/`: reserved for future authenticated `/dashboard` routes.
- `src/components/`: reusable presentation components.
- `src/config/security.mjs`: baseline response headers.
- `tests/`: dependency-free foundation security checks.

Parenthesized route groups organize code without adding URL segments. The reserved groups contain documentation only and expose no routes. No Supabase SDK, authentication, tenant routing, database, migrations, checkout, or dashboard is implemented. Planned features and illustrative storefront content are labeled on the homepage.

Next milestone: design the tenant schema and security model, then implement and test RLS, tenant-safe relationships, verified domain resolution, and membership authorization in an isolated local database. Route groups and request-provided tenant IDs are not authorization boundaries. Add cache isolation and an appropriate CSP alongside dynamic/authenticated routes. Remote database operations require explicit approval.

Pricing target: $300 setup and $25/month per store. One shared application deployment and shared PostgreSQL database are planned. No deployment or remote changes are part of this foundation.

Development and production scripts select Next.js’s supported Webpack bundler because this environment blocks the local worker ports required by Turbopack. ESLint 9 is retained for plugin peer compatibility; npm reports its support deprecation and moderate development-only advisories in the TypeScript ESLint/minimatch chain. No forced overrides are used.
