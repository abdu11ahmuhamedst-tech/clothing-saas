"""Explicit local-only integration runner. Requires an already bootstrapped disposable DB.
No migrations, bootstrap, installs or remote connections are performed by this runner.
Each assertion opens a fresh session and rolls its transaction back.
"""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import sys

parser = argparse.ArgumentParser()
parser.add_argument('--directory', required=True)
args = parser.parse_args()
root = Path(args.directory).resolve()
if root.parent != Path('/tmp') or not root.name.startswith('clothing-saas-pg-'):
    sys.exit('Refusing a non-disposable directory')
if not (root / 'LOCAL_VALIDATION_ONLY').is_file():
    sys.exit('Missing disposable cluster marker')
env = {k: v for k, v in os.environ.items() if not k.startswith('PG')}
env.update(PGHOST=str(root / 'socket'), PGPORT='55439', PGDATABASE='clothing_validation',
           PGOPTIONS='-c statement_timeout=5000 -c lock_timeout=2000')
results = []

def run(sql, role=None):
    return subprocess.run(['psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose'] + (['-U', 'test_' + role] if role else []),
                          input=sql, text=True, capture_output=True, env=env, timeout=12)

def uid(n):
    return f'00000000-0000-0000-0000-{n:012d}'

def lit(n):
    return f"'{uid(n)}'"

A, B, S = map(lit, [1, 2, 3])
P, Q, R = map(lit, [101, 102, 103])
V, W, X = map(lit, [201, 202, 203])
O, T, Z = map(lit, [301, 302, 303])
tables = ['stores', 'domains', 'memberships', 'products', 'variants', 'inventory', 'orders', 'order_items']

def check(name, sql, expected=None, error=None, role='authenticated', user=11):
    prefix = f"begin; set local role {role}; set local request.jwt.claim.sub = '{uid(user) if user else ''}';\n"
    result = run(prefix + sql + '; rollback;', role)
    passed = (result.returncode != 0 and re.search(r'ERROR:\s+' + error + r':', result.stderr)) if error else (result.returncode == 0 and (expected is None or result.stdout.strip() == expected))
    record = {'name': name, 'passed': bool(passed)}
    if not passed:
        record.update(returncode=result.returncode, stdout=result.stdout, stderr=result.stderr, expected=expected, expected_sqlstate=error)
    results.append(record)
    print(('PASS ' if passed else 'FAIL ') + name, flush=True)

# Deterministic fixture IDs are only used in this isolated test database.
fixture = 'begin;\n' + ''.join(f'insert into auth.users values ({lit(n)});\n' for n in range(11, 19))
for store, product, variant, order, label, state in [(A,P,V,O,'a','active'),(B,Q,W,T,'b','active'),(S,R,X,Z,'s','suspended')]:
    fixture += f"""
insert into public.stores(id,name,currency,status) values ({store},'{label}','USD','{state}');
insert into public.domains(store_id,hostname,verified_at) values ({store},'{label}.example.com',now());
insert into public.products(store_id,id,slug,title,status) values ({store},{product},'shirt','Shirt','published');
insert into public.variants(store_id,id,product_id,sku,size,color,price_minor,active) values ({store},{variant},{product},'SHIRT','M','blue',1250,true);
insert into public.inventory values ({store},{variant},10,2);
insert into public.orders(store_id,id,currency,idempotency_key,customer_name,customer_phone) values ({store},{order},'USD',{order},'Test customer','000');
insert into public.order_items(store_id,order_id,variant_id,product_title,variant_label,sku,quantity,unit_price_minor) values ({store},{order},{variant},'Shirt','M blue','SHIRT',2,1250);
"""
for store, user, role in [(A,11,'owner'),(A,12,'admin'),(A,13,'staff'),(A,14,'viewer'),(B,15,'owner'),(A,17,'staff'),(B,17,'viewer'),(S,18,'owner')]:
    fixture += f"insert into public.memberships(store_id,user_id,role) values ({store},{lit(user)},'{role}');\n"
fixture += 'commit;'
r = run(fixture)
if r.returncode:
    sys.exit('Fixture failure: ' + r.stderr)

check('all eight tables force and enable RLS', "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('" + "','".join(tables) + "') and relrowsecurity and relforcerowsecurity", '8', role='service_role')
check('no TCP listener configured', "select current_setting('listen_addresses') = ''", 't', role='service_role')
check('restricted role attributes', "select count(*) from pg_roles where rolname in ('anon','authenticated') and not rolsuper and not rolcreaterole and not rolcreatedb and not rolbypassrls and not rolcanlogin", '2', role='service_role')
check('service explicitly has BYPASSRLS', "select rolbypassrls and not rolsuper from pg_roles where rolname='service_role'", 't', role='service_role')
for user in [11,12,13,14,15,17,18,16]:
    for table in tables:
        expected = '2' if user==17 and table!='domains' else '1'
        if user==17 and table=='domains': expected='0'
        if user in [13,14] and table=='domains': expected='0'
        if user==18 and table not in ['stores','memberships']: expected='0'
        if user==16: expected='0'
        check(f'user {user} reads {table}', f'select count(*) from public.{table}', expected, user=user)
# Explicit foreign-tenant predicates avoid accepting a count from the wrong tenant.
for user, foreign_store in [(11, B), (15, A)]:
    for table in tables:
        column = 'id' if table == 'stores' else 'store_id'
        check(f'user {user} cannot read foreign tenant {table}',
              f'select count(*) from public.{table} where {column}={foreign_store}', '0', user=user)
check('caller is actual restricted login, not a superuser session',
      "select session_user = 'test_authenticated' and current_user = 'authenticated'", 't')
check('own memberships cannot expose another user identity',
      f'select count(*) from public.memberships where user_id <> {lit(11)}', '0')
for table in tables:
    check(f'anon cannot read {table}', f'select * from public.{table}', error='42501', role='anon', user=None)
    check(f'no subject reads no {table}', f'select count(*) from public.{table}', '0', user=None)
    check(f'merchant cannot delete {table}', f'delete from public.{table}', error='42501')
    check(f'merchant cannot truncate {table}', f'truncate public.{table}', error='42501')
    check(f'service cannot delete {table}', f'delete from public.{table}', error='42501', role='service_role')
    check(f'service cannot truncate {table}', f'truncate public.{table}', error='42501', role='service_role')

for user in [11,12,13]:
    check(f'writer {user} creates product', f"insert into public.products(store_id,slug,title) values ({A},'new','New') returning title", 'New', user=user)
    check(f'writer {user} creates variant', f"insert into public.variants(store_id,product_id,sku,size,price_minor) values ({A},{P},'NEW','L',100) returning sku", 'NEW', user=user)
    check(f'writer {user} edits product', f"with changed as (update public.products set title='Edited' where store_id={A} returning 1) select count(*) from changed", '1', user=user)
    check(f'writer {user} edits variant', f"with changed as (update public.variants set price_minor=200 where store_id={A} returning 1) select count(*) from changed", '1', user=user)
for user in [14,16,18,None]:
    target = S if user==18 else A
    check(f'nonwriter {user} product insert denied', f"insert into public.products(store_id,slug,title) values ({target},'new','New')", error='42501', user=user)
    check(f'nonwriter {user} variant insert denied', f"insert into public.variants(store_id,product_id,sku,price_minor) values ({target},{R if user==18 else P},'NEW',100)", error='42501', user=user)
    for table, assignment in [('products',"title='Edit'"),('variants','price_minor=1')]:
        check(f'nonwriter {user} cannot update {table}', f'with changed as (update public.{table} set {assignment} returning 1) select count(*) from changed', '0', user=user)
check('cross-tenant product insert denied', f"insert into public.products(store_id,slug,title) values ({B},'new','New')", error='42501')
check('cross-tenant variant insert denied', f"insert into public.variants(store_id,product_id,sku,price_minor) values ({B},{Q},'NEW',1)", error='42501')
for table, assignment in [('products',"title='Edit'"),('variants','price_minor=1')]:
    check(f'cross-tenant {table} update sees zero rows', f'with changed as (update public.{table} set {assignment} where store_id={B} returning 1) select count(*) from changed', '0')
for table, assignments in [('products',[f'store_id={B}',f'id={Q}',"created_at=now()"]),('variants',[f'store_id={B}',f'id={W}',f'product_id={Q}',"created_at=now()"])]:
    for assignment in assignments:
        check(f'protected {table}.{assignment.split("=")[0]} update', f'update public.{table} set {assignment} where store_id={A}', error='42501')
for table, values in [('products',f"store_id,id,slug,title) values ({A},{Q},'new','New'"),('variants',f"store_id,id,product_id,sku,price_minor) values ({A},{W},{P},'NEW',1")]:
    check(f'caller-supplied {table} id denied', f'insert into public.{table}({values})', error='42501')
for table, assignment in [('memberships',"role='owner'"),('stores',"status='active'"),('domains','verified_at=now()'),('inventory','on_hand=100'),('orders',"status='fulfilled'"),('order_items','unit_price_minor=0')]:
    check(f'merchant cannot update {table}', f'update public.{table} set {assignment}', error='42501')
check('cannot self-enroll', f"insert into public.memberships values ({B},{lit(11)},'owner',now())", error='42501')
check('cannot verify own domain by insert', f"insert into public.domains(store_id,hostname,verified_at) values ({A},'evil.example.com',now())", error='42501')
check('cannot create own store', "insert into public.stores(name,currency) values ('Evil','USD')", error='42501')
check('merchant cannot assume service role', 'set local role service_role', error='42501')
check('merchant cannot create role', 'create role malicious_role', error='42501')
check('merchant cannot disable RLS', 'alter table public.products disable row level security', error='42501')
check('merchant cannot replace helper', "create or replace function app_private.has_store_role(uuid,text[]) returns boolean language sql as 'select true'", error='42501')
check('anon cannot execute helper', f"select app_private.has_store_role({A},array['owner'])", error='42501', role='anon')
check('helper cannot assert another tenant ownership', f"select app_private.has_store_role({B},array['owner'])", 'f')
check('forged metadata does not promote viewer', f"set local request.jwt.claims = '{{\"user_metadata\":{{\"role\":\"owner\"}}}}'; select app_private.has_store_role({A},array['owner'])", 'f', user=14)
check('service sees all tenant products without subject', 'select count(*) from public.products', '3', role='service_role', user=None)
check('service can change membership despite RLS', f"with changed as (update public.memberships set role='owner' where user_id={lit(14)} returning 1) select count(*) from changed", '1', role='service_role', user=None)
# All FK tests use the bypass role, proving the constraints enforce tenant linkage independently of RLS.
for name, statement in [
 ('variant product',f"insert into public.variants(store_id,product_id,sku,price_minor) values ({A},{Q},'BAD',1)"),
 ('inventory variant',f"insert into public.inventory values ({A},{W},0,0)"),
 ('order currency',f"insert into public.orders(store_id,currency,idempotency_key,customer_name,customer_phone) values ({A},'EUR',gen_random_uuid(),'X','000')"),
 ('item order',f"insert into public.order_items(store_id,order_id,variant_id,product_title,variant_label,sku,quantity,unit_price_minor) values ({A},{T},{V},'X','','X',1,1)"),
 ('item variant',f"insert into public.order_items(store_id,order_id,variant_id,product_title,variant_label,sku,quantity,unit_price_minor) values ({A},{O},{W},'X','','X',1,1)")]:
    check(f'cross-tenant FK rejects {name}', statement, error='23503', role='service_role')
check('merchant own variant cannot reference foreign product', f"insert into public.variants(store_id,product_id,sku,price_minor) values ({A},{Q},'BAD',1)", error='23503')
for name, statement in [
 ('negative inventory',f'update public.inventory set on_hand=-1 where store_id={A}'),
 ('over-reserved inventory',f'update public.inventory set reserved=11 where store_id={A}'),
 ('negative price',f'update public.variants set price_minor=-1 where store_id={A}'),
 ('price cap',f'update public.variants set price_minor=1000000000001 where store_id={A}'),
 ('zero quantity',f'update public.order_items set quantity=0 where store_id={A}'),
 ('quantity cap',f'update public.order_items set quantity=10001 where store_id={A}')]:
    check(name,statement,error='23514',role='service_role')
check('generated line total', f'select line_total_minor from public.order_items where store_id={A}', '2500')
check('maximum line total fits bigint', f'update public.order_items set quantity=10000,unit_price_minor=1000000000000 where store_id={A}; select line_total_minor from public.order_items where store_id={A}', '10000000000000000', role='service_role')
check('duplicate tenant slug', f"insert into public.products(store_id,slug,title) values ({A},'shirt','Duplicate')", error='23505')
check('duplicate tenant SKU', f"insert into public.variants(store_id,product_id,sku,size,price_minor) values ({A},{P},'SHIRT','L',1)", error='23505')
check('duplicate idempotency key', f"insert into public.orders(store_id,currency,idempotency_key,customer_name,customer_phone) values ({A},'USD',{O},'X','000')", error='23505', role='service_role')
# Commit a fixture revocation through the admin session; reconnect as actual restricted user.
r = run(f"delete from public.memberships where store_id={A} and user_id={lit(13)}")
if r.returncode: sys.exit('Revocation setup failed: '+r.stderr)
check('committed revocation removes access in fresh session', 'select count(*) from public.products', '0', user=13)
r = run(f"insert into public.memberships(store_id,user_id,role) values ({A},{lit(13)},'viewer')")
if r.returncode: sys.exit('Demotion setup failed: '+r.stderr)
check('committed demotion removes write authority', f"select app_private.has_store_role({A},array['owner','admin','staff'])", 'f', user=13)
r = run(f"update public.memberships set role='staff' where store_id={A} and user_id={lit(13)}")
if r.returncode: sys.exit('Fixture restoration failed: '+r.stderr)
report = {'passed': sum(r['passed'] for r in results), 'failed': sum(not r['passed'] for r in results), 'tests': results}
(root / 'security-results.json').write_text(json.dumps(report, indent=2)+'\n')
print(json.dumps({k: report[k] for k in ['passed','failed']}))
sys.exit(bool(report['failed']))
