-- TEST ONLY: minimal Auth contract, not JWT verification. Disposable cluster only.
create role anon nologin nosuperuser nocreatedb nocreaterole nobypassrls;
create role authenticated nologin nosuperuser nocreatedb nocreaterole nobypassrls;
create role service_role nologin nosuperuser nocreatedb nocreaterole bypassrls;
create schema auth;
revoke all on schema auth from public;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable security invoker
set search_path = '' as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
revoke all on function auth.uid() from public;
grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
revoke create on schema public from public;
-- Local peer-mapped login surrogates; tests SET ROLE to the exact application role.
create role test_anon login nosuperuser nocreatedb nocreaterole nobypassrls;
create role test_authenticated login nosuperuser nocreatedb nocreaterole nobypassrls;
create role test_service_role login nosuperuser nocreatedb nocreaterole nobypassrls;
grant anon to test_anon;
grant authenticated to test_authenticated;
grant service_role to test_service_role;
