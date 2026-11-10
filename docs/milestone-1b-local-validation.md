# Milestone 1B local PostgreSQL validation

Validated on 2026-11-10 with PostgreSQL 18.6 as unprivileged OS user `abdullahmuhamed`. No Supabase cloud connection, system database/service changes, production migration edits, commit or push occurred.

## Final results

- Both production migrations applied successfully, unchanged and in timestamp order.
- Application checks also passed: nine npm tests, ESLint, typecheck and production Webpack build; Git whitespace checks were clean.
- 228 database assertions passed; 0 failed: 16 first-migration access-boundary assertions and 212 integration/security assertions.
- Final disposable cluster: `/tmp/clothing-saas-pg-1se50uqx`. Private directory/socket permissions are 0700, peer authentication is mapped to restricted local login surrogates, and `listen_addresses` is empty. The private socket uses port number 55439 but no TCP listener is configured.
- Clean shutdown succeeded (`pg_ctl ... -m fast -w stop`); the postmaster PID file was absent afterward. Synthetic data/logs remain in the private disposable directory.
- [Full machine-readable results](milestone-1b-validation-results.json) contain every assertion and migration hashes before/after.

## Coverage

Eight-table tenant visibility matrix for owner/admin/staff/viewer, multi-store membership, nonmember and suspended store; explicit foreign-tenant SELECT predicates; anonymous/no-subject access; permitted catalog writes; forbidden cross-tenant writes and protected-column changes; membership/domain/store privilege escalation; attempts to assume service_role, create roles, disable RLS or replace the helper; forged role metadata; committed membership revocation/demotion; composite foreign keys tested even under service_role; inventory/price/quantity boundaries; generated totals and scoped uniqueness/idempotency constraints; denial of DELETE/TRUNCATE; service bypass and privileged membership updates.

Tests connect as actual restricted login surrogates before assuming application roles, rather than trusting superuser-session SET ROLE alone. Production roles remain NOLOGIN. Individual assertions roll back; only synthetic fixture setup and revocation/demotion transactions commit in the disposable database.

## Investigation history

The first cluster could not start inside the execution sandbox: Unix socket binding returned `Operation not permitted`. No migrations ran there. Running the same lifecycle outside the sandbox, still as UID 1000, resolved this environment restriction without changing production SQL or authentication controls.

The first completed run passed 210/210 assertions. The final fresh-cluster run added 18 stronger checks (16 explicit foreign-tenant reads, caller session identity and membership identity isolation) and passed 228/228. These are separate runs, not summed into the final total. No runtime migration or security assertion failed.

## Security findings and limits

No unexpected tenant-isolation bypass or merchant privilege escalation was found in the tested cases. This is a scoped validation, not a proof of production security.

- Confirmed intended privileged bypass: service_role reads all tenants and can alter memberships without user claims. Keep privileged credentials server-only and separate from normal merchant authorization.
- The minimal test Auth shim does not verify JWTs. Supabase-specific Auth/Data API grants, default privileges, exposed schemas and hosted PostgreSQL version still need separately authorized compatibility testing.
- Viewer access includes customer PII by current design; confirm that business permission explicitly before launch.
- Revocation was tested across committed changes and fresh sessions. Concurrent revocation races, long-lived transaction snapshots and reservation/idempotency concurrency have not been validated.
- Last-owner protection, order state transitions, nonempty orders, authoritative pricing, immutable snapshots and atomic inventory reservations remain future trusted-workflow requirements. Do not expose direct service writes as checkout APIs.

No production migration fix is required by this run. Next recommended work is a separately reviewed trusted-write workflow design and concurrency tests, followed by authorized compatibility inspection. This report does not authorize cloud access or migration application.
