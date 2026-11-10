# Milestone 1C — Phase 1 integration preparation

Target supplied by project owner: Supabase project `bvwyayceclripdrecoom`, existing `demo-clothing` store reported as draft. These cloud facts have not been independently verified. No cloud connection, migration execution or record mutation was performed. Prefer adapting the application to the validated existing cloud schema; do not apply the Milestone 1B schema over it.

## Local preparation

Added `@supabase/ssr` 0.12.7, `@supabase/supabase-js` 2.119.0 and `server-only` 0.0.1. Next.js remains 16.4.6. Request-scoped server and browser utilities use only a publishable key. The server utility is protected by `server-only`; its explicit read-only-cookie mode is for Server Components after Proxy refresh, not Auth mutations.

`src/proxy.ts` scopes session refresh to dashboard/Auth/login/signup paths. It verifies claims through the SDK, forwards refreshed request cookies, preserves browser cookie updates and refresh headers, and sets private/no-store headers. Missing configuration returns 503 on those paths; unauthenticated dashboard requests return 401. The marketing homepage stays independent of Supabase. No login/signup/dashboard pages, confirmation handlers, tenant queries or RPC calls have been added. Proxy identity checks are not tenant authorization: future server actions, handlers and data reads must validate identity and enforce cloud membership/RLS independently.

`.env.example` contains only empty public placeholders. Configure the canonical HTTPS project URL, matching 20-letter project reference and modern publishable key in ignored local/deployment configuration only after the target is confirmed. Legacy anon JWT keys are deliberately rejected by this initial configuration validator; use the project's publishable key. No service_role key, password or access token is needed or accepted. Public URL/reference/key are not an authorization boundary, and URL/reference matching alone cannot prove a key belongs to that project. Confirm that through authorized Auth integration testing later.

Cookies use SameSite=Lax, path=/ and Secure in production, with no shared parent-domain setting. Browser SSR cookies are accessible to client-side Auth code; do not assume HttpOnly session isolation. Keep the merchant origin separate from customer custom domains, defend against XSS and review CSP before launch. Callbacks must allowlist same-origin destinations and preserve cookie/cache headers. Mutations need origin/CSRF checks and rate limits. Never cache authenticated responses at the CDN or share server clients between requests.

## Known differences and missing evidence

Only the cloud object names below are available, supplied by the owner. No cloud DDL, generated Database types, policy export, migration history or RPC definitions exist locally.

| Area | Local Milestone 1B | Reported cloud | Integration gate |
| --- | --- | --- | --- |
| Membership | memberships | store_members | Verify user relationship, roles, revocation and escalation controls; names are not proof of equivalent semantics. |
| Domains | domains | store_domains | Verify host normalization, uniqueness, ownership verification and tenant lookup. |
| Catalog | products, variants, inventory | products, product_variants, categories | Inspect columns, money/currency representation, stock model, IDs, category relationships and tenant-safe FKs. No inventory table was listed for cloud; its actual stock model is unknown. |
| Orders | orders, order_items | orders, order_items | Same names do not establish compatibility. Inspect snapshots, state transitions, totals and foreign keys. |
| Billing | No subscriptions table | subscriptions | Determine authoritative subscription/entitlement checks; never accept client-provided entitlement. |
| Tenant root | stores | stores | Inspect lifecycle, owner fields, slug, currency and grants. Existing table conflicts with local CREATE TABLE migrations. |
| Onboarding | No create-store RPC | create_store | Inspect exact overloads/arguments/return types, atomicity, identity derivation, retries, owner assignment and execution grants. |
| Public catalog | Anonymous base-table access denied | get_storefront | Verify draft/unverified/suspended stores are hidden; projection must exclude private inventory, memberships, order/customer PII and billing data. |
| Staff/platform roles | No equivalent RPCs | set_store_staff, is_platform_administrator | Inspect caller/owner checks, platform role source, last-owner protection, SECURITY DEFINER owner/search path and execution grants. |

Auth additionally needs confirmed providers, email confirmation, SMTP readiness, exact localhost/production redirect allowlists, JWT signing mode, session settings and Auth triggers/hooks. Local 228/228 PostgreSQL assertions establish only the local schema behavior; they do not validate cloud RLS or the four cloud functions. Existing object conflicts must stop migration application, not be hidden by IF NOT EXISTS. Do not deploy the test-only Auth shim.

## Fastest safe commercial MVP sequence

1. Obtain an owner-reviewed, sanitized schema/security export (table columns/types/defaults/constraints/indexes, RLS policies, schema/table/column/function grants, function signatures/definitions/owners/search paths, relevant triggers and migration history), plus Auth/API configuration inventory. Use metadata-only inspection through the existing runbook if separately authorized. No secrets or customer rows are needed. Keep app_private unexposed unless a reviewed compatibility decision explicitly changes that design.
2. Compare cloud policies and RPCs against two-tenant isolation, anonymous access, protected-column and role escalation cases in an approved isolated test environment. Generate cloud-specific TypeScript types from verified metadata and build a small adapter; retain local migrations as validated reference material. Any required cloud correction needs a separate reviewed plan and approval.
3. Implement email/password login, confirmation, logout and password recovery with the prepared SSR clients. Match the callback to the verified cloud email-template/PKCE configuration. Use getClaims for verified identity, getUser for fresh Auth state when provisioning, and cloud membership rows for authorization. Never trust getSession alone or user-editable metadata for roles.
4. Use the existing create_store function only if its security contract passes review. Store creation and owner membership must be atomic, derive the actor from verified identity and fix the assigned role server-side. Retry/replay and concurrent requests must not create orphan stores or grant ownership of another store. For the first store, reuse authorized membership in demo-clothing rather than duplicating it. Keep onboarding operator-approved initially; do not infer permission from a supplied slug or draft status.
5. Implement a tenant-bound merchant catalog editor against verified cloud columns and user-context RLS. Then render a narrow public catalog via the audited get_storefront contract. Keep demo-clothing draft until publication is explicitly authorized. Defer checkout, automatic billing, custom-domain onboarding and staff administration until their contracts are tested.

Keep one Next.js deployment and the existing shared Supabase project for the first 10–15 stores. Avoid extra databases, queues, workers or payment infrastructure for this first catalog milestone. Set measured image/storage/egress limits rather than promising unlimited usage.

## Validation results

- npm test: 17 passed, 0 failed (9 prior checks and 8 new configuration/session tests with mocked clients; no cloud requests).
- ESLint and route generation/typecheck passed.
- Production Webpack build passed outside the sandbox, including the Next.js Proxy build; Next.js remained on major 16.
- Initial sandbox build failure was environmental: a spawned Node/TypeScript --showConfig process reported EPERM and empty stdout; Next.js could not parse that output. The identical subprocess returned valid JSON outside the sandbox. No project configuration fix was necessary.
- Full npm audit: 8 moderate advisories, all development-only in the unchanged ESLint/TypeScript ESLint/minimatch chain. Production-only audit: 0 vulnerabilities. No forced fixes or major-version changes were applied.
- Production migration hashes still match the Milestone 1B evidence; database validation was not rerun.

Next action: provide the sanitized cloud schema/RPC/security inventory and Auth configuration metadata, or authorize metadata-only inspection through an approved existing access method. Do not send service_role keys, passwords or access tokens. Until that evidence exists, the prepared SSR infrastructure is not a functional tenant integration or proof of cloud isolation.
