# Milestone 1B: local schema proposal

Validation update: the unchanged migrations have now passed disposable PostgreSQL 18.6 validation (228 database assertions, zero failures). See [local validation report](milestone-1b-local-validation.md). Cloud execution remains unauthorized.

Status: local schema and tenant-isolation validation completed. No application database integration, Supabase SDK, CLI, Docker, cloud project, checkout, or authentication flow is introduced. Do not deploy these SQL files until the remaining compatibility inspection and workflow gates below are complete.

## Existing application and cost model

Next.js App Router has a shared layout, a static marketing homepage, reusable brand component, and reserved merchant/storefront route groups. Route groups confer no authorization. Retain one application deployment and one shared PostgreSQL database; no per-store database, background worker, search service, or queue is required for the initial catalog and WhatsApp order-request MVP. No new npm dependency is needed for this phase. Pricing remains a $300 setup and $25 monthly target; budget from measured database/storage/egress usage before promising margins. Image storage, custom-domain hosting limits, email and backups still need a cost review. Do not promise unlimited usage.

## Data relationships

| Table | Purpose and boundaries |
| --- | --- |
| stores | Tenant root; immutable currency, active/draft/suspended lifecycle. Currency is a supported ISO code chosen by trusted onboarding; regex alone does not validate the ISO registry. |
| domains | Globally unique lowercase ASCII/punycode hostname, trusted verification timestamp. No tokens stored here. |
| memberships | Auth user to store role: owner/admin/staff/viewer; only trusted operations can change roles. |
| products | Tenant-local slug, draft/published/archived lifecycle; archive instead of delete. |
| variants | Tenant-local SKU and product/size/color combination; integer minor-unit price in store currency. |
| inventory | One row per tenant variant, on-hand and reserved counts. Available = on_hand - reserved. |
| orders | Tenant-local idempotency key, customer contact, immutable currency referencing store currency. |
| order_items | Same-tenant order and variant; immutable-intent title/SKU/price snapshots with generated line totals. |

Every child relationship uses `(store_id, parent_id)` to reference a composite parent key. An RLS-visible row cannot reference an invisible tenant's product, variant or order. IDs and slugs/SKUs are tenant-scoped; UUIDs are identifiers, never authorization. Only domains are globally unique. All foreign keys restrict deletion; auth user deletion is blocked until membership offboarding is reviewed. There are no cascading tenant/data deletions. The orders index supports tenant time-ordered reads; composite keys cover tenant reads and FK order-item lookup. Additional indexes require observed query plans.

## Access and privilege model

All eight tables enable and force RLS, reset inherited table grants, and explicitly grant only necessary access. Policies apply to authenticated users; anonymous clients have neither grants nor policies. A private, security-invoker helper checks current database membership and suspension status using `auth.uid()`. Its search path is empty, names are qualified, and PUBLIC/anon cannot execute it. It performs no mutation and has no elevated owner privileges. Memberships expose only the caller's membership rows. Stores use a direct membership predicate, so helper → stores → memberships never recurses. No authorization reads user-editable JWT metadata.

| Actor | Allowed operations |
| --- | --- |
| Anonymous | No direct table access; public storefront/checkout deferred. |
| Viewer | Read own membership, store and tenant catalog/inventory/orders/items, including customer PII; assign this role only to trusted merchant personnel. |
| Staff | Viewer access plus insert/update catalog fields. |
| Owner/admin | Staff access plus domain status reads. No direct membership, store or domain mutations. |
| Suspended member | Own membership and store metadata only; catalog/order access and writes denied. |
| Trusted service | Select/insert/update all eight tables for reviewed operations; no delete/truncate grants from these migrations. |

Merchant catalog UPDATE grants exclude tenant IDs, primary keys, product linkage and timestamps; tenants cannot move existing rows. INSERT excludes caller-controlled IDs/timestamps. UPDATE policies check both old and new rows. Viewers cannot write. Ownership is a protected membership role, not a store field or JWT claim. No tenant self-onboarding, self-invitation, role promotion or domain verification RPC exists. Bootstrap and role changes require a separately reviewed trusted workflow, authenticated operator, explicit tenant binding and audit trail. The workflow must serialize membership changes and retain at least one owner; this proposal does not enforce an owner-count invariant. Service credentials and database owners bypass RLS and can invalidate these assumptions; never use them for routine merchant requests. Existing column grants, role inheritance, owners, functions and exposed schemas must be audited on the target project before use.

The grants deliberately withhold inventory and order writes from merchants. A future narrow transaction/RPC must lock inventory rows in deterministic order, recheck store and variant availability, use authoritative prices, create an order and items, reserve inventory atomically, and handle idempotency replay consistently. Confirmation/fulfillment/cancellation must enforce valid state transitions and exactly-once reservation changes. Direct trusted writes currently can violate workflow rules (empty orders, changed snapshots, invalid transitions, stale prices); do not expose them as an application feature. An order is a request, not evidence of payment. Totals are sums of generated item totals; shipping, discounts, taxes, payments, returns, multi-warehouse and reservation expiry are deferred. Bound quantities/prices prevent line-total overflow; currency formatting must handle currency-specific minor-unit exponents, not assume two decimals. No payment-card fields are stored.

## Public storefront boundary (future work)

Do not add blanket anonymous SELECT policies to these base tables: orders contain PII and catalog may be unpublished. Build a narrowly projected public catalog read path only after reviewing authorization and abuse controls. Resolve a normalized host to an active store through a domain with verified_at set; reverify ownership and hosting/TLS configuration outside SQL. Do not trust forwarded host headers except those overwritten by the trusted proxy. Reject unknown/unverified hosts, ports, trailing-dot ambiguity and malformed IDNs; use an explicit platform-host allowlist. A timestamp alone proves no DNS ownership. Keep app_private out of the Data API's exposed schemas. Tenant IDs in request bodies are untrusted. Cache keys must include the verified tenant and publication scope; merchant/PII responses should not use shared caching. Checkout needs rate limits, bounded payloads, server pricing and a reviewed transactional interface before public release.

## Verification boundary and release gates

`npm test` includes static SQL contract tests for table coverage, forced RLS, tenant-aware FKs, grants, nonrecursive authorization, escalation restrictions and numeric constraints. These tests inspect source text; they do not parse PostgreSQL or prove runtime behavior. Separately, both migrations were executed unchanged against disposable local PostgreSQL 18.6 using a test-only Auth shim: 228 database assertions passed with zero failures. This validates the tested PostgreSQL behavior but does not establish hosted Supabase Auth/Data API compatibility.

Before any cloud application, run database integration tests with two stores and distinct users, multi-store members, all four roles, anonymous/no-JWT sessions, suspended stores and revoked memberships. Use actual anon/authenticated roles and JWT subject settings, never only the database owner. Test SELECT/INSERT/UPDATE/DELETE/TRUNCATE permissions on every table; cross-tenant child references; attempts to mutate tenant IDs, IDs, roles, domains and verified_at; viewer catalog edits; helper execution as anon; membership recursion; unknown hosts; transaction rollback on failed constraints; role-revocation races; concurrent reservations and idempotency. Confirm table/function/schema grants and default privileges from catalogs. Test the trusted onboarding/order workflows separately when implemented. No destructive production fixtures or automatic down migration is supplied. See [cloud inspection guide](supabase-cloud-inspection.md).

## References

The design follows [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security) and [Data API security guidance](https://supabase.com/docs/guides/api/securing-your-api). PostgreSQL explicitly documents that [referential-integrity checks bypass RLS](https://www.postgresql.org/docs/17/ddl-rowsecurity.html), which is why composite tenant foreign keys are mandatory. These are public documentation sources, not access to a Supabase project.

## Initial static verification result (2026-11-10)

All nine Node tests passed (six schema contracts and three foundation checks). ESLint, TypeScript route generation/typecheck, production Webpack build and Git whitespace checks passed. The sandbox stalled the existing Node-to-Git subprocess test; the same suite passed outside that sandbox with no source changes to the existing test. At this initial static verification stage, no dependencies or database tooling were installed and no SQL was executed. Subsequent local database validation is documented in the linked validation report; the static checks alone establish source-level contracts.
