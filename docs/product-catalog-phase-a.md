# Milestone 1E — Product Management, Phase A

Follow-up: draft-first product creation and separate product/variant editing are now implemented in [Phase B](product-management-phase-b.md). This document records the earlier read-only phase.

Read-only catalog implemented on top of the existing uncommitted Milestone 1D Auth/dashboard work. No product/category/variant mutation, cloud schema/policy/grant/data change, dependency change or database migration is included.

## Use

Sign in normally, then open `http://localhost:3000/dashboard/products` or use **View products** on a dashboard store card. With no store parameter, the page selects the first store returned by the validated membership list. With multiple stores, use the store links. A store-specific URL is `/dashboard/products?store=<member-store-id>`; the value is a selection request only, never authorization. Unknown, unassigned or malformed selections return a generic 404 without catalog reads. A user with no stores gets the assignment empty state. Existing authentication/session refresh and no-store response headers cover this route.

The page displays product name, slug, plain-text description, category and draft/published badge, then variant size, color, SKU, price, stock and publication status. It supports no-products/no-variants states, loading skeletons and generic query-error recovery. Product cards and publication badges are reusable presentation components for later creation/editing. No inactive create/edit/delete controls are shown.

## Read boundary and verified contracts

The server creates the same request-scoped publishable-key/user-cookie SSR client used by the dashboard. `loadMemberStores` calls `auth.getUser()` before membership queries, filters memberships by verified user ID and owner/staff role, and intersects RLS-visible stores with those memberships. Catalog reads begin only after finding the requested store in that validated list.

Queries use only the owner-supplied cloud columns:

- products: id, store_id, category_id, name, slug, description, is_published.
- categories: id, store_id, name, slug, is_published.
- product_variants: id, store_id, product_id, size, color, sku, price_cents, stock_quantity, is_published.

Each catalog query uses `store_id = validatedStore.id`. Categories are restricted to the current products' category IDs; variants to the current products' IDs. Returned DTOs additionally reject foreign tenant/product relationships. No URL-supplied category/product IDs, service_role key, RPC or write operation is used. React escapes names/descriptions; no HTML from the database is rendered as markup. The page is dynamic and relies on user-context RLS as the final database boundary; membership checks do not replace RLS or tenant-consistent foreign keys.

Products are paged 20 at a time, ordered by name then ID, using exact RLS-visible counts. Related variants are bounded to 1,000 rows per product page. If the API count indicates truncation, the page fails closed rather than displaying incomplete prices/stock. The same applies if exact count metadata is unavailable. Catalogs exceeding that bound will need independently paged/expanded variant reads. Out-of-range product pages have an empty state and Previous navigation. Zero stock is shown as out of stock; malformed prices/stock are unavailable rather than silently coerced to zero. `price_cents` is divided by 100 as specified by the verified field name; do not generalize this into a guessed ISO currency minor-unit conversion. Unsupported currency metadata displays a labeled decimal fallback.

## Verification

Local checks: 60 Node tests passed, 0 failed (38 prior tests preserved; 22 added catalog tests). ESLint, route-generation/typecheck and the Next.js 16.4.6 production Webpack build passed. The build includes dynamic `/dashboard/products`; it ran outside the sandbox to avoid the previously diagnosed TypeScript subprocess restriction. Tests use mocked clients and verify missing/expired users, revoked/no membership, nonmember store rejection before catalog reads, owner/staff access, explicit store scoping on every query, multi-store selection, foreign-row exclusion, pagination, empty products/variants, query failures, network exceptions, variant truncation and numeric formatting. They do not claim to revalidate hosted RLS.

Manual checks using existing records only:

1. Open the Products link for demo-clothing and compare visible product/category/variant data with your existing catalog. Both draft and published rows should be visible only as allowed by existing merchant policies.
2. Replace the store query value with a store the account does not belong to. Expect generic 404 and no catalog data. Reload after logout; expect login. If another existing member account is available, verify its independent store list.
3. For an existing store with no visible products, verify the empty state. If no such fixture exists, use the automated test; do not create/delete cloud records just to test this phase.
4. Check narrow/mobile layouts: cards should fit, store links wrap, and variant tables scroll horizontally. Loading and error states must not display stale products from another store.

No live cloud requests were made by the development agent. Manually opening the configured page makes authenticated SELECT/Auth requests only. Keep all uncommitted Milestone 1D/1E changes for review; do not commit/push until explicitly requested.

## Phase B prerequisites

Review the existing INSERT/UPDATE grants and RLS separately, confirm exact column types/nullability/defaults/constraints (including SKU/slug uniqueness and price/stock limits), and decide whether owner and staff both may mutate catalog rows. Plan server-side validation and transactional product/variant writes with tenant-consistent category selection and fixed tenant IDs. Add CSRF/origin checks via Server Actions, mutation error handling, idempotency/concurrency behavior, form components and adversarial tests. No write path is authorized or implemented by Phase A.
