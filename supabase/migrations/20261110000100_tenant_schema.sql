-- Milestone 1B proposal. LOCAL PREPARATION ONLY; not executed.
-- Requires Supabase auth.users/auth.uid and anon/authenticated/service_role roles.
-- Apply only to an inspected, compatible database in a later approved phase.
begin;

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 120),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'draft' check (status in ('draft', 'active', 'suspended')),
  created_at timestamptz not null default now(),
  unique (id, currency)
);

create table public.domains (
  store_id uuid not null references public.stores(id) on delete restrict,
  id uuid not null default gen_random_uuid(),
  hostname text not null unique check (
    length(hostname) between 3 and 253 and hostname = lower(hostname)
    and hostname ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]([a-z0-9-]{0,61}[a-z0-9])?$'
  ),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (store_id, id)
);

create table public.memberships (
  store_id uuid not null references public.stores(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  role text not null check (role in ('owner', 'admin', 'staff', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (store_id, user_id)
);
create index memberships_user_store on public.memberships (user_id, store_id);

create table public.products (
  store_id uuid not null references public.stores(id) on delete restrict,
  id uuid not null default gen_random_uuid(),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 160),
  title text not null check (length(title) between 1 and 200),
  description text not null default '' check (length(description) <= 10000),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  primary key (store_id, id),
  unique (store_id, slug)
);

create table public.variants (
  store_id uuid not null,
  id uuid not null default gen_random_uuid(),
  product_id uuid not null,
  sku text not null check (length(sku) between 1 and 100),
  size text not null default '' check (length(size) <= 60),
  color text not null default '' check (length(color) <= 60),
  price_minor bigint not null check (price_minor between 0 and 1000000000000),
  active boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (store_id, id),
  unique (store_id, sku),
  unique (store_id, product_id, size, color),
  foreign key (store_id, product_id) references public.products(store_id, id) on delete restrict
);

create table public.inventory (
  store_id uuid not null,
  variant_id uuid not null,
  on_hand integer not null default 0 check (on_hand between 0 and 100000000),
  reserved integer not null default 0 check (reserved between 0 and on_hand),
  primary key (store_id, variant_id),
  foreign key (store_id, variant_id) references public.variants(store_id, id) on delete restrict
);

create table public.orders (
  store_id uuid not null,
  id uuid not null default gen_random_uuid(),
  currency text not null,
  idempotency_key uuid not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'fulfilled', 'cancelled')),
  customer_name text not null check (length(customer_name) between 1 and 200),
  customer_phone text not null check (length(customer_phone) between 3 and 40),
  created_at timestamptz not null default now(),
  primary key (store_id, id),
  unique (store_id, idempotency_key),
  foreign key (store_id, currency) references public.stores(id, currency) on delete restrict
);
create index orders_store_created on public.orders (store_id, created_at desc);

create table public.order_items (
  store_id uuid not null,
  id uuid not null default gen_random_uuid(),
  order_id uuid not null,
  variant_id uuid not null,
  product_title text not null check (length(product_title) between 1 and 200),
  variant_label text not null check (length(variant_label) <= 200),
  sku text not null check (length(sku) between 1 and 100),
  quantity integer not null check (quantity between 1 and 10000),
  unit_price_minor bigint not null check (unit_price_minor between 0 and 1000000000000),
  line_total_minor bigint generated always as (quantity::bigint * unit_price_minor) stored,
  primary key (store_id, id),
  unique (store_id, order_id, variant_id),
  foreign key (store_id, order_id) references public.orders(store_id, id) on delete restrict,
  foreign key (store_id, variant_id) references public.variants(store_id, id) on delete restrict
);

alter table public.stores enable row level security;
alter table public.stores force row level security;
revoke all on table public.stores from public, anon, authenticated, service_role;
alter table public.domains enable row level security;
alter table public.domains force row level security;
revoke all on table public.domains from public, anon, authenticated, service_role;
alter table public.memberships enable row level security;
alter table public.memberships force row level security;
revoke all on table public.memberships from public, anon, authenticated, service_role;
alter table public.products enable row level security;
alter table public.products force row level security;
revoke all on table public.products from public, anon, authenticated, service_role;
alter table public.variants enable row level security;
alter table public.variants force row level security;
revoke all on table public.variants from public, anon, authenticated, service_role;
alter table public.inventory enable row level security;
alter table public.inventory force row level security;
revoke all on table public.inventory from public, anon, authenticated, service_role;
alter table public.orders enable row level security;
alter table public.orders force row level security;
revoke all on table public.orders from public, anon, authenticated, service_role;
alter table public.order_items enable row level security;
alter table public.order_items force row level security;
revoke all on table public.order_items from public, anon, authenticated, service_role;

commit;
