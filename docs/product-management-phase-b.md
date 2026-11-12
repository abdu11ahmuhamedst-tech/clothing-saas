# Milestone 1E-B — Product and inventory forms

Acceptance update (2026-11-13): the project owner reported that manual product creation and inventory editing tests passed against the existing Supabase project. This is owner-reported live acceptance, separate from the agent-run mocked regression suite. No cloud access or writes are part of commit preparation.

Implementation preserves uncommitted Auth and read-only catalog work. No live INSERT/UPDATE/DELETE, sample data, migration, cloud policy/grant/function change, commit or push was executed during development. Tests use mocked user-scoped clients only.

## Routes and workflow

- Catalog: `http://localhost:3000/dashboard/products`
- Create: `http://localhost:3000/dashboard/products/new?store=<verified-member-store-uuid>`
- Edit: `http://localhost:3000/dashboard/products/<product-uuid>/edit?store=<verified-member-store-uuid>`

Use **Add product** or **Edit product** in the catalog; these links supply the IDs. A store parameter is mandatory on editor routes. It requests a selection, not authorization. New-product and editor reads verify current `getUser()` identity, owner/staff membership and RLS-visible store access before loading categories or product data. Unauthorized/foreign records have no editable form.

New products require name, lowercase hyphenated slug, optional existing category, description and 1–20 initial variants. Product and initial variants are always created as drafts, regardless of submitted publication flags. This deliberate two-stage workflow supersedes immediate publication during creation. Review the saved product in the editor, publish the desired variants individually, then explicitly publish the product. No signup, category creation, product/variant deletion or bulk inventory operation is included.

Product details and each variant have their own save action. The editor also allows adding one new variant at a time, which is useful for recovering a partially created draft. Success redirects/reloads latest editor values and invalidates catalog/dashboard data; error messages stay with the affected form. Newly rendered variants/forms use fresh keys so successful navigations do not retain stale input defaults. Publishing an empty or incomplete product remains a merchant choice; the UI asks for review and does not claim a database-enforced completeness invariant.

## Non-atomic creation and recovery

There is no verified atomic cloud RPC. Creation performs:

1. Validate all input locally on the server, verify membership and category ownership.
2. INSERT the product as a draft using a stable, server-generated UUID bound to that rendered form.
3. Recheck current Auth/membership and product ownership.
4. INSERT the validated initial variant batch, also as drafts, using server-generated UUIDs and fixed store/product links. No unverified database ID defaults are assumed.

These requests are **not one transaction**. The draft may remain without variants. Nothing automatically deletes it, retries a mutation or promotes it to published. Known second-step rejection produces an explicit partial-save message and editor link. An unknown network/timeout result produces an uncertain-save message: reload the catalog/editor to reconcile actual state before retrying. The create form stops accepting submissions after saved/partial/uncertain results. Stable IDs and database uniqueness reduce duplicate submissions; this is not a cross-request exactly-once guarantee or a persistent idempotency ledger. Reloading the create page generates another ID, so check the catalog first after uncertainty.

Single-product/variant updates also require exactly one returned ID before reporting success. Zero affected rows (RLS revocation, stale stock or missing record) are not reported as success. Variant updates compare stock against the value displayed by the server-rendered form. This avoids silently replacing a different concurrent stock value. It does not implement stock reservations, inventory movements, multi-row transactions or conflict detection for all metadata. Product metadata uses last-writer-wins semantics. Do not use these absolute stock edits as an order fulfillment transaction.

## Validation and authorization

Every mutation calls `auth.getUser()` through the existing current-membership loader. Only member owner/staff access is admitted by the application; platform-administrator policy privileges do not bypass this application requirement. Product/category/variant IDs are validated as UUIDs; every existing product/category/variant is checked under the verified store. Variant reads and updates also filter by product_id. RLS and tenant-consistent foreign keys remain the final protection against membership/category races.

UPDATE payloads contain only:

- products: name, slug, description, category_id, is_published.
- product_variants: size, color, sku, price_cents, stock_quantity, is_published.

IDs, store_id and product_id are never included in UPDATE payloads. INSERT links come from the verified context rather than submitted record objects. All operations use the publishable-key/user-cookie SSR client; no service_role key or privileged RPC is introduced. Server Actions retain Next.js's default POST/Origin checks. Do not broaden Origin settings or bypass policies if a deployment or permission error occurs.

Application input limits (conservative UI limits, not assertions about cloud text constraints): name 200, slug 160, description 10,000, size/color 60 each, SKU 100 characters; initial batch 20 variants, encoded payload 100 KB. Blank required strings, malformed slugs, invalid UUID categories, non-boolean publication values and duplicate trimmed case-insensitive SKU or size/color pairs within an initial batch are rejected. Existing database uniqueness remains authoritative, including collisions across other products and concurrent submissions. The application may reject case-only batch duplicates even if cloud uniqueness is case-sensitive.

Prices are decimal **strings** converted with BigInt arithmetic into exact integer cents. At most two decimal places are accepted; exponent notation, negatives and extra precision are rejected. Since the verified cloud contract is `price_cents`, 100 cents represents one displayed currency unit. The application caps cents at JavaScript's exact JSON integer ceiling (9,007,199,254,740,991), narrower than PostgreSQL bigint; no floating-point multiplication determines stored values. Existing values outside that safe client range require a future bigint-aware read/display design, not coercion. Stock is an integer from 0 through 2,147,483,647. The app does not infer a three-decimal currency scale from ISO metadata or change cloud money semantics.

SQLSTATE 23505 maps to safe duplicate slug/SKU/combination messages, 42501 to a permission message, and constraint failures to safe validation messages. Raw SQL, constraint identifiers, tokens and SDK messages are not exposed. Exact existing editable-column grants were not supplied locally; the payload uses the requested business fields and will fail closed if any field lacks UPDATE permission. No grant broadening is proposed. Confirm those exact grants through authorized inspection if manual saves return a permission denial.

## Manual test against demo-clothing — owner initiated only

These steps intentionally create/edit cloud data when you choose to execute them; the agent has not performed them. Use the existing configured account and project. Do not use privileged keys.

1. Sign in, open `/dashboard/products`, select demo-clothing and click **Add product**. The generated link supplies the verified store UUID.
2. Enter a unique test name/slug, an existing category or Uncategorized, and two distinct size/color/SKU variants. For example enter price `12.29` and stock `3`. Submit once. Expect the product and initial variants to remain draft and a link to the editor.
3. Open the editor, confirm price and stock values, save an ordinary product-field edit and one variant edit independently, then return to the catalog and confirm refreshed values. Publish only if you intend the existing storefront to expose this record; keeping everything draft is sufficient to test persistence.
4. Test duplicate values on an intended test record: use a SKU/combination already in use for that store, and expect a safe rejection without deleting anything. For a creation batch conflict with an existing store SKU, the product draft can already be saved: open its editor and add the missing variants with corrected values; do not resubmit the whole product blindly.
5. A foreign store/product/variant URL must not provide edit access. In a second browser tab, save a different stock value, then submit the older stock form; expect a conflict/uncertain result and reload before retrying. Use existing alternate accounts for membership checks; do not change memberships or policies just for this implementation.
6. On any uncertain network result, reload and inspect actual state. Do not intentionally interrupt production requests merely to simulate failures; the automated suite covers these paths. No automatic cleanup or delete feature is provided; retain drafts or arrange separately approved manual cleanup later.

## Validation and remaining approvals

Final local results: **100 tests passed, 0 failed** (the previous 60 plus 40 new checks). ESLint, route generation/typecheck, production Webpack build on Next.js 16.4.6 and Git whitespace checks passed. Dynamic create/edit routes were included in the build; no cloud mutation was executed.

The new focused suite has 40 tests covering exact prices and limits, input/duplicate checks, membership and tenant ownership, draft publication enforcement, partial/ambiguous saves, editable-field whitelists, denied grants, composite filters, stock comparisons and editor boundaries. An initial mock omitted `.in()`, causing membership lookups to fail; the mock was corrected without weakening application checks. A missing stock-parameter type annotation was corrected after typecheck feedback.

No cloud database change is required by this implementation. Atomic product/variant provisioning, persistent idempotency, inventory reservation workflows, new policies/grants/RPCs or broader administrator access would require a separately reviewed and explicitly approved cloud change. Live mutation behavior and the exact current grants have not been validated by this agent.
