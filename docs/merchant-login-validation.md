# Existing-account merchant login and dashboard

Implemented from `b548305` using only the owner-verified cloud columns:

- `store_members`: store_id, user_id, role (owner/staff).
- `stores`: id, name, slug, status, currency.

No signup, membership creation, product writes, RPC calls, migrations or RLS changes are included. The Milestone 1B migrations describe a different local schema and must not be applied to the existing cloud project for this feature.

## Security behavior

Login is an email/password Supabase Auth Server Action. Errors use fixed messages; passwords/tokens/SDK messages never appear in URLs, logs or rendered output. Only fixed local redirect destinations are used. Logout is a POST Server Action with `signOut({scope:'local'})`; it signs out this session rather than every device and does not claim success on SDK failure. Next.js's default Server Action Origin/Host checks remain enabled. Production must use HTTPS and retain trustworthy reverse-proxy host/origin headers. Do not broaden allowedOrigins to work around deployment errors.

Proxy verifies claims, refreshes cookies, applies private/no-store headers and redirects unauthenticated dashboard requests to login. The dashboard independently calls `auth.getUser()` server-side before any database reads. It queries memberships with `user_id` equal to that verified identity and requests only the corresponding store IDs through the same public-key, user-cookie Supabase client. It filters the result against the membership set again. No requested store_id/slug is accepted as proof of access. The page is dynamic and contains no shared cached user data. Roles outside the verified owner/staff set do not grant access.

Query failures render a generic retry message and no partial store data. Zero visible memberships/stores render an assignment message. RLS and grants must allow the authenticated user to read their own `store_members` rows as well as their stores. If membership reads fail, inspect those policies through authorized read-only review; do not disable RLS or add privileged keys. Runtime validation below remains pending; mocked tests do not prove the cloud policies. Access tokens already issued may remain valid until expiry after sign-out; logout is not a substitute for membership/RLS revocation or incident response.

## Test against the existing project

1. Create an ignored `.env.local` containing the following public configuration. Fill the publishable-key value from your existing project's settings locally; do not send passwords, keys or tokens in chat. The URL and reference below are public identifiers, not credentials.

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://bvwyayceclripdrecoom.supabase.co
   NEXT_PUBLIC_SUPABASE_PROJECT_REF=bvwyayceclripdrecoom
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<existing project publishable key>
   ```

   This application deliberately accepts modern `sb_publishable_...` keys, not legacy JWT anon keys or privileged keys. Match all three values to the existing project. Public environment values are compiled into browser bundles: configure before building/deploying and restart/rebuild after changing them. Never commit `.env.local`.
2. Run `npm run dev` and open `http://localhost:3000/login`. For production-mode testing, run `npm run build` followed by `npm start` after setting the values. Without configuration, scoped Auth/dashboard requests return generic HTTP 503; the homepage still works.
3. In a private browser session, visit `/dashboard`; expect a redirect to `/login?notice=expired`. Submit incorrect credentials; expect a generic error without confirming account existence. Missing/invalid input should not submit a password sign-in request.
4. Sign in using an **existing, confirmed** email/password Auth account already assigned to a store. Expect `/dashboard` to show only its visible memberships/stores, including draft `demo-clothing` only if assigned. The page lists name, slug, status, currency and member role; it does not publish the store. Refresh and verify the session persists.
5. Use another existing account in a separate browser profile to verify a different membership set. Adding `?store_id=<another-store-id>` to `/dashboard` must not affect results. If an existing account has no memberships, verify the empty state. Do not create/change cloud rows merely to manufacture test fixtures in this phase.
6. Click Sign out; expect `/login?notice=signed-out`. Reload/directly visit `/dashboard`; expect login again. Reload any browser-history dashboard entry and verify no store data is served without authentication. An expired/invalid session must lead to login or a generic availability error, never tenant content. On network/Auth failure, do not treat a failed logout as successful.
7. Confirm responses for login/dashboard carry `Cache-Control: private, no-store`, including redirects/errors, and production cookies have Secure/SameSite=Lax without a shared parent domain. Never capture or publish cookie/token values. Verify the hosting/CDN honors the no-cache policy.

No project API request was made by the development agent. Manual sign-in/sign-out will contact Supabase Auth and change Auth session state by design; the dashboard performs database SELECT requests only. These steps do not authorize modifying database records, policies or migrations. Existing cloud rate-limit/CAPTCHA configuration should be reviewed before public exposure; no distributed rate-limiter service is introduced in this minimal increment.

## Local verification

38 Node tests passed, zero failed: 17 foundation/SSR checks plus 21 Auth/dashboard operation checks. Added coverage includes password validation, login/logout errors, expired/missing users, membership filtering, foreign-row exclusion, multiple stores, revoked memberships, unknown roles and query/network failures. All Supabase interactions in tests are mocked. ESLint, typecheck, production Webpack build and whitespace checks passed. An initial implicit-any error in the dashboard store rendering was fixed with a minimal store-summary type. No live cloud RLS/Auth integration assertion is claimed.
