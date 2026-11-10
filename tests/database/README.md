# Disposable PostgreSQL validation harness

Status: validated on PostgreSQL 18.6. Final run: 228 assertions passed, zero failed; both production migrations applied unchanged. See `docs/milestone-1b-local-validation.md`.

`bootstrap.sql` is TEST ONLY. It supplies a minimal Auth contract and NOLOGIN application roles plus restricted peer-mapped login surrogates. It is not a production migration or JWT verifier.

`validate.py --directory /tmp/clothing-saas-pg-<unique>` requires a LOCAL_VALIDATION_ONLY marker, a private `socket` directory, socket port 55439 and database `clothing_validation`. It refuses paths outside the named disposable directory convention and ignores inherited PG connection variables. A local peer map must map the current OS user to the three test login surrogates. Tests connect through separate restricted login sessions, then SET ROLE to the exact application role; they do not rely on a superuser session for escalation assertions.

Run only after bootstrap and both unchanged migrations have succeeded in a fresh isolated cluster. The harness commits synthetic fixtures, temporarily revokes/demotes a synthetic membership, and rolls back individual adversarial statements. It writes exact per-test results and pass/fail counts to `security-results.json` inside the disposable directory. It does not install packages, apply migrations, start/stop PostgreSQL or connect to a cloud project. Starting and stopping the cluster must be wrapped in a separate lifecycle with guaranteed shutdown.

Expected errors are checked by SQLSTATE. The completed runtime validation is recorded in the linked report. Python syntax checks and npm static tests are separate checks and do not replace database assertions.

## Run a new isolated validation

After native PostgreSQL client/server installation, run `python3 tests/database/run-local.py` as the unprivileged OS user. It creates a new mode-0700 directory under `/tmp`, initializes a new cluster, disables TCP, restricts the Unix socket, configures peer mapping for local login surrogates, applies the test bootstrap and unchanged migrations, runs boundary/security assertions and stops PostgreSQL in a finally block. It never uses a system database or service. If sandbox socket creation is denied, request permission to run this same local command outside the sandbox. Reports and synthetic data remain in the uniquely named directory; no automatic deletion occurs.

The Auth shim reads a test-controlled subject setting. It does not validate JWT signatures or implement Supabase Auth/Data API behavior. Never install this bootstrap in a real project. Each run requires a fresh cluster because fixtures use deterministic keys.
