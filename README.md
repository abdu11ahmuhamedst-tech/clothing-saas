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

Parenthesized route groups organize code without adding URL segments. The merchant group now exposes login, dashboard and product routes; the storefront group remains reserved. Supabase SSR utilities, existing-account login/logout and a membership-scoped dashboard are implemented. The project owner has verified Auth, catalog reads, product creation and inventory editing against the existing cloud project; tenant storefront routing and checkout remain unimplemented. Milestone 1B migrations were validated unchanged in a disposable local PostgreSQL 18.6 cluster; they have not been applied to Supabase cloud. Planned features and illustrative storefront content are labeled on the homepage.

Milestone 1B completed local validation: see [schema and access design](docs/milestone-1b-architecture.md), [versioned SQL migrations](supabase/migrations/), [validation report](docs/milestone-1b-local-validation.md), [database test harness](tests/database/), and [future cloud inspection runbook](docs/supabase-cloud-inspection.md). All 228 database assertions passed with zero failures. Static schema tests run with `npm test`; the database harness runs separately and requires explicit local database execution. Next gates are trusted-write workflow/concurrency validation and separately authorized Supabase compatibility inspection. Route groups and request-provided tenant IDs are not authorization boundaries. Add cache isolation and an appropriate CSP alongside dynamic/authenticated routes. Remote database operations require explicit approval.

Pricing target: $300 setup and $25/month per store. One shared application deployment and shared PostgreSQL database are planned. No deployment or remote changes are part of this foundation.

Development and production scripts select Next.js’s supported Webpack bundler because this environment blocks the local worker ports required by Turbopack. ESLint 9 is retained for plugin peer compatibility; npm reports its support deprecation and moderate development-only advisories in the TypeScript ESLint/minimatch chain. No forced overrides are used.

## Merchant login

Existing-account email/password login is available at `/login`, with an RLS-scoped store list at `/dashboard`. Configure only the three public Supabase values in ignored `.env.local` before running/building. Follow the [merchant login validation guide](docs/merchant-login-validation.md) for exact setup and live checks. No signup, provisioning, cloud migrations or privileged key is required. The project owner has verified the implemented login/dashboard and product workflows against the existing cloud project; automated tests remain mocked.

## Read-only product catalog

Open `/dashboard/products` after signing in, or choose **View products** on a dashboard store card. The server validates membership before reading the selected store's products, categories and variants. See [Phase A catalog notes](docs/product-catalog-phase-a.md) for data boundaries, tests and Phase B prerequisites. Draft-first creation and separate product/variant editing are now described in the Phase B section below.

## Product creation and editing

Milestone 1E-B adds draft-first creation and separate product/variant editing through user-scoped Server Actions. Use the catalog's **Add product** and **Edit product** links. See [product management safety and testing](docs/product-management-phase-b.md) for partial-save recovery, exact price/stock limits and manual test steps. No atomic multi-request guarantee or delete feature is provided.
