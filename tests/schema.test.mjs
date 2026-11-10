import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";

const directory = new URL("../supabase/migrations/", import.meta.url);
const files = readdirSync(directory).sort();
const sql = files.map((file) => readFileSync(new URL(file, directory), "utf8").replace(/--[^\n]*/g, "")).join("\n");
const tables = ["stores", "domains", "memberships", "products", "variants", "inventory", "orders", "order_items"];
const body = (table) => {
  const match = sql.match(new RegExp(`create table public\\.${table} \\(([\\s\\S]*?)\\n\\);`));
  assert.ok(match, `missing table ${table}`);
  return match[1];
};

test("versioned, transactional migrations contain no destructive operations or extensions", () => {
  assert.equal(files.length, 2);
  for (const file of files) {
    assert.match(file, /^\d{14}_[a-z_]+\.sql$/);
    const text = readFileSync(new URL(file, directory), "utf8").replace(/--[^\n]*/g, "").trim();
    assert.match(text, /^begin;/);
    assert.match(text, /commit;$/);
  }
  assert.doesNotMatch(sql, /(?:^|;)\s*(?:drop|truncate|delete|create extension)\b/i);
});

test("every tenant table enables and forces RLS, resets grants, and has explicit authenticated read policy", () => {
  assert.equal((sql.match(/create table /g) ?? []).length, tables.length);
  for (const table of tables) {
    body(table);
    assert.ok(sql.includes(`alter table public.${table} enable row level security;`));
    assert.ok(sql.includes(`alter table public.${table} force row level security;`));
    assert.ok(sql.includes(`revoke all on table public.${table} from public, anon, authenticated, service_role;`));
    assert.match(sql, new RegExp(`create policy \\w+ on public\\.${table} for select to authenticated`));
    if (table !== "stores") assert.match(body(table), /store_id uuid not null/);
  }
  assert.doesNotMatch(sql, /grant [^;]+ to (?:public|anon);/);
  assert.doesNotMatch(sql, /using\s*\(true\)|with check\s*\(true\)/i);
});

test("every tenant-child foreign key carries store_id to its parent", () => {
  const expected = {
    variants: [["product_id", "products", "id"]],
    inventory: [["variant_id", "variants", "id"]],
    orders: [["currency", "stores", "currency"]],
    order_items: [["order_id", "orders", "id"], ["variant_id", "variants", "id"]],
  };
  for (const [table, edges] of Object.entries(expected)) {
    for (const [column, parent, target] of edges) {
      assert.ok(body(table).includes(`foreign key (store_id, ${column}) references public.${parent}(${parent === "stores" ? "id" : "store_id"}, ${target}) on delete restrict`));
    }
  }
  for (const table of tables.filter((name) => name !== "stores")) {
    assert.match(body(table), /primary key \(store_id, (?:id|user_id|variant_id)\)/);
  }
  assert.doesNotMatch(sql, /on delete cascade|on update cascade/i);
  assert.match(body("memberships"), /references auth\.users\(id\) on delete restrict/);
});

test("membership authorization is nonrecursive, caller scoped, and cannot be edited by merchants", () => {
  assert.match(sql, /language sql stable security invoker\s+set search_path = ''/);
  assert.doesNotMatch(sql, /security definer|auth\.jwt|user_metadata/i);
  assert.match(sql, /m\.user_id = \(select auth\.uid\(\)\)/);
  assert.match(sql, /m\.role = any\(allowed_roles\) and s\.status <> 'suspended'/);
  assert.match(sql, /memberships_self_read[\s\S]*?using \(user_id = \(select auth\.uid\(\)\)\);/);
  const writes = [...sql.matchAll(/grant ([^;]+) on (?:table )?public\.(\w+) to authenticated;/g)]
    .filter(([, permissions]) => /insert|update|delete|all|truncate/i.test(permissions));
  assert.deepEqual(writes.map(([, , table]) => table).sort(), ["products", "variants"]);
  for (const [, permissions] of writes) {
    const updated = permissions.match(/update \(([^)]+)\)/)?.[1];
    assert.ok(updated);
    assert.doesNotMatch(updated, /store_id|product_id|\bid\b|created_at/);
  }
  assert.doesNotMatch(sql, /create policy \w+ on public\.(?:memberships|stores|domains|orders|order_items|inventory) for (?:all|insert|update|delete)/);
});

test("catalog insert and update require writer membership for both old and new rows", () => {
  for (const table of ["products", "variants"]) {
    const writer = `app_private.has_store_role(store_id, array['owner', 'admin', 'staff'])`;
    assert.ok(sql.includes(`create policy ${table}_catalog_insert on public.${table} for insert to authenticated\nwith check (${writer});`));
    assert.ok(sql.includes(`create policy ${table}_catalog_update on public.${table} for update to authenticated\nusing (${writer})\nwith check (${writer});`));
  }
});

test("money, inventory and order snapshots have bounded integer constraints", () => {
  assert.match(body("inventory"), /reserved between 0 and on_hand/);
  assert.match(body("order_items"), /quantity between 1 and 10000/);
  for (const table of ["variants", "order_items"]) assert.match(body(table), /between 0 and 1000000000000/);
  assert.match(body("order_items"), /generated always as \(quantity::bigint \* unit_price_minor\) stored/);
  assert.match(body("orders"), /unique \(store_id, idempotency_key\)/);
  assert.match(body("variants"), /unique \(store_id, sku\)/);
  assert.match(body("products"), /unique \(store_id, slug\)/);
  assert.match(body("domains"), /hostname text not null unique/);
});
