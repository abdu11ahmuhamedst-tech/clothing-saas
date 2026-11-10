-- All tables remain closed to anon. No public catalog or checkout RPC yet.
begin;

-- No SECURITY DEFINER: helper uses caller permissions and membership self-read RLS.
-- Role decisions come from protected rows, never user-controlled JWT metadata.
create schema app_private;
revoke all on schema app_private from public, anon, authenticated;
grant usage on schema app_private to authenticated;
create function app_private.has_store_role(target_store uuid, allowed_roles text[])
returns boolean
language sql stable security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    join public.stores s on s.id = m.store_id
    where m.store_id = target_store and m.user_id = (select auth.uid())
      and m.role = any(allowed_roles) and s.status <> 'suspended'
  );
$$;
revoke all on function app_private.has_store_role(uuid, text[]) from public, anon, authenticated;
grant execute on function app_private.has_store_role(uuid, text[]) to authenticated;

-- Stores policy directly checks memberships; it does not call the helper (no recursion).
create policy memberships_self_read on public.memberships for select to authenticated
using (user_id = (select auth.uid()));
create policy stores_member_read on public.stores for select to authenticated
using (exists (select 1 from public.memberships m where m.store_id = stores.id and m.user_id = (select auth.uid())));
grant select on table public.stores to authenticated;
grant select on table public.domains to authenticated;
grant select on table public.memberships to authenticated;
grant select on table public.products to authenticated;
grant select on table public.variants to authenticated;
grant select on table public.inventory to authenticated;
grant select on table public.orders to authenticated;
grant select on table public.order_items to authenticated;
create policy domains_member_read on public.domains for select to authenticated
using (app_private.has_store_role(store_id, array['owner', 'admin']));
create policy products_member_read on public.products for select to authenticated
using (app_private.has_store_role(store_id, array['owner', 'admin', 'staff', 'viewer']));
create policy variants_member_read on public.variants for select to authenticated
using (app_private.has_store_role(store_id, array['owner', 'admin', 'staff', 'viewer']));
create policy inventory_member_read on public.inventory for select to authenticated
using (app_private.has_store_role(store_id, array['owner', 'admin', 'staff', 'viewer']));
create policy orders_member_read on public.orders for select to authenticated
using (app_private.has_store_role(store_id, array['owner', 'admin', 'staff', 'viewer']));
create policy order_items_member_read on public.order_items for select to authenticated
using (app_private.has_store_role(store_id, array['owner', 'admin', 'staff', 'viewer']));
grant insert (store_id, slug, title, description, status), update (slug, title, description, status) on public.products to authenticated;
create policy products_catalog_insert on public.products for insert to authenticated
with check (app_private.has_store_role(store_id, array['owner', 'admin', 'staff']));
create policy products_catalog_update on public.products for update to authenticated
using (app_private.has_store_role(store_id, array['owner', 'admin', 'staff']))
with check (app_private.has_store_role(store_id, array['owner', 'admin', 'staff']));
grant insert (store_id, product_id, sku, size, color, price_minor, active), update (sku, size, color, price_minor, active) on public.variants to authenticated;
create policy variants_catalog_insert on public.variants for insert to authenticated
with check (app_private.has_store_role(store_id, array['owner', 'admin', 'staff']));
create policy variants_catalog_update on public.variants for update to authenticated
using (app_private.has_store_role(store_id, array['owner', 'admin', 'staff']))
with check (app_private.has_store_role(store_id, array['owner', 'admin', 'staff']));

-- Trusted operations only. service_role bypasses RLS: never use it for merchant requests.
-- No DELETE or TRUNCATE privileges. Archive instead; retention is a separate reviewed operation.
grant select, insert, update on public.stores to service_role;
grant select, insert, update on public.domains to service_role;
grant select, insert, update on public.memberships to service_role;
grant select, insert, update on public.products to service_role;
grant select, insert, update on public.variants to service_role;
grant select, insert, update on public.inventory to service_role;
grant select, insert, update on public.orders to service_role;
grant select, insert, update on public.order_items to service_role;

commit;
