import assert from "node:assert/strict";
import { test } from "node:test";
import { loadCatalog, catalogPage, PAGE_SIZE } from "../src/lib/catalog/read.mjs";
import { formatPrice } from "../src/lib/catalog/format.mjs";

const store = {id:"store-a",name:"Demo",slug:"demo-clothing",status:"draft",currency:"USD"};
const product = {id:"product-a",store_id:"store-a",category_id:"category-a",name:"Shirt",slug:"shirt",description:"Cotton",is_published:false};
const category = {id:"category-a",store_id:"store-a",name:"Tops",slug:"tops",is_published:true};
const variant = {id:"variant-a",store_id:"store-a",product_id:"product-a",size:"M",color:"Blue",sku:"SHIRT-M",price_cents:1250,stock_quantity:3,is_published:true};
function fixture(overrides = {}, auth = {data:{user:{id:"user-a"}},error:null}) {
  const calls = [];
  const responses = {
    store_members:{data:[{user_id:"user-a",store_id:"store-a",role:"owner"}],error:null},
    stores:{data:[store],error:null},
    products:{data:[product],count:1,error:null},
    categories:{data:[category],error:null},
    product_variants:{data:[variant],count:1,error:null},
    ...overrides,
  };
  const client = {
    auth:{getUser:async () => {calls.push(["getUser"]);return auth;}},
    from(table) {
      calls.push([table,"from"]);
      const query = {};
      for (const method of ["select","eq","in","order","range"]) {
        query[method] = (...args) => {calls.push([table,method,...args]);return query;};
      }
      query.then = (resolve,reject) => Promise.resolve(responses[table]).then(resolve,reject);
      return query;
    },
  };
  return {client,calls};
}
const catalogTables = new Set(["products","categories","product_variants"]);
const catalogCalls = (calls) => calls.filter(([table]) => catalogTables.has(table));

test("catalog rejects missing/expired users before any database access", async () => {
  for (const auth of [{data:{user:null},error:null},{data:null,error:{status:401}}]) {
    const {client,calls}=fixture({},auth);
    assert.equal((await loadCatalog(client,"store-a")).status,"unauthorized");
    assert.deepEqual(calls,[["getUser"]]);
  }
});

test("foreign store ID never authorizes catalog reads", async () => {
  const {client,calls}=fixture();
  const result=await loadCatalog(client,"store-b");
  assert.equal(result.status,"not-found");
  assert.deepEqual(result.products,[]);
  assert.deepEqual(catalogCalls(calls),[]);
});

test("revoked/zero membership cannot query a requested store", async () => {
  const {client,calls}=fixture({store_members:{data:[],error:null}});
  assert.equal((await loadCatalog(client,"store-a")).status,"not-found");
  assert.deepEqual(catalogCalls(calls),[]);
});

test("zero memberships without selected store returns an empty assignment state", async () => {
  const {client,calls}=fixture({store_members:{data:[],error:null}});
  const result=await loadCatalog(client);
  assert.equal(result.status,"ready");assert.equal(result.store,null);assert.deepEqual(result.products,[]);
  assert.deepEqual(catalogCalls(calls),[]);
});

test("catalog requires a recognized owner/staff membership", async () => {
  const {client,calls}=fixture({store_members:{data:[{user_id:"user-a",store_id:"store-a",role:"admin"}],error:null}});
  assert.equal((await loadCatalog(client,"store-a")).status,"not-found");
  assert.deepEqual(catalogCalls(calls),[]);
});

test("default selection uses only membership-validated stores and scopes every catalog query", async () => {
  const {client,calls}=fixture();
  const result=await loadCatalog(client);
  assert.equal(result.status,"ready");assert.equal(result.store.id,"store-a");
  assert.equal(result.products[0].category,"Tops");assert.equal(result.products[0].published,false);
  assert.deepEqual(result.products[0].variants,[{id:"variant-a",size:"M",color:"Blue",sku:"SHIRT-M",priceCents:1250,stockQuantity:3,published:true}]);
  for (const table of catalogTables) {
    assert.ok(calls.some((call) => JSON.stringify(call)===JSON.stringify([table,"eq","store_id","store-a"])));
  }
  assert.ok(calls.some((call) => JSON.stringify(call)===JSON.stringify(["product_variants","in","product_id",["product-a"]])));
  assert.ok(calls.some((call) => JSON.stringify(call)===JSON.stringify(["categories","in","id",["category-a"]])));
  assert.equal(calls[0][0],"getUser");
});

test("staff membership may read catalog", async () => {
  const {client}=fixture({store_members:{data:[{user_id:"user-a",store_id:"store-a",role:"staff"}],error:null}});
  assert.equal((await loadCatalog(client,"store-a")).products.length,1);
});

test("explicit selection of another member store is allowed but never another user's store", async () => {
  const {client,calls}=fixture({store_members:{data:[{user_id:"user-a",store_id:"store-a",role:"owner"},{user_id:"user-a",store_id:"store-b",role:"staff"},{user_id:"user-b",store_id:"store-c",role:"owner"}],error:null},stores:{data:[store,{...store,id:"store-b"},{...store,id:"store-c"}],error:null},products:{data:[],count:0,error:null}});
  const result=await loadCatalog(client,"store-b");assert.equal(result.store.id,"store-b");
  assert.ok(calls.some((call) => JSON.stringify(call)===JSON.stringify(["products","eq","store_id","store-b"])));
});

test("foreign product/category/variant rows cannot reach rendered DTOs", async () => {
  const {client}=fixture({products:{data:[product,{...product,id:"foreign-product",store_id:"store-b"}],count:2,error:null},categories:{data:[{...category,store_id:"store-b",name:"Secret category"}],error:null},product_variants:{data:[variant,{...variant,id:"bad-tenant",store_id:"store-b"},{...variant,id:"bad-product",product_id:"foreign-product"}],count:3,error:null}});
  const result=await loadCatalog(client,"store-a");
  assert.equal(result.products.length,1);assert.equal(result.products[0].category,"Category unavailable");
  assert.equal(result.products[0].variants.length,1);
  assert.doesNotMatch(JSON.stringify(result.products),/Secret category|foreign-product|bad-tenant|bad-product/);
});

test("empty products do not query categories or variants", async () => {
  const {client,calls}=fixture({products:{data:[],count:0,error:null}});
  const result=await loadCatalog(client);
  assert.equal(result.status,"ready");assert.deepEqual(result.products,[]);
  assert.equal(calls.some(([table]) => ["categories","product_variants"].includes(table)),false);
});

test("uncategorized products and products without variants are supported", async () => {
  const {client,calls}=fixture({products:{data:[{...product,category_id:null}],count:1,error:null},product_variants:{data:[],count:0,error:null}});
  const result=await loadCatalog(client);
  assert.equal(result.products[0].category,"Uncategorized");assert.deepEqual(result.products[0].variants,[]);
  assert.equal(calls.some(([table]) => table==="categories"),false);
});

for (const table of ["store_members","stores","products","categories","product_variants"]) {
  test(`${table} query failure returns no partial products or raw errors`, async () => {
    const {client,calls}=fixture({[table]:{data:null,error:{message:"sensitive database detail"}}});
    const result=await loadCatalog(client,"store-a");
    assert.equal(result.status,"unavailable");assert.deepEqual(result.products,[]);
    assert.doesNotMatch(JSON.stringify(result),/sensitive database detail/);
    if (["store_members","stores"].includes(table)) assert.deepEqual(catalogCalls(calls),[]);
  });
}

test("truncated variant results fail instead of silently omitting prices/stock", async () => {
  const {client}=fixture({product_variants:{data:[variant],count:1001,error:null}});
  const result=await loadCatalog(client);
  assert.equal(result.status,"unavailable");assert.deepEqual(result.products,[]);
});

test("unavailable product counts do not create a misleading paginated listing", async () => {
  const {client}=fixture({products:{data:[product],count:null,error:null}});
  assert.equal((await loadCatalog(client)).status,"unavailable");
});

test("network exceptions fail closed", async () => {
  const {client}=fixture();client.from=() => {throw new Error("secret");};
  const result=await loadCatalog(client);assert.equal(result.status,"unavailable");assert.deepEqual(result.products,[]);
});

test("pagination bounds and ranges are deterministic", async () => {
  for (const value of [undefined,"0","-1","2 OR 1=1",["2"],"10001"]) assert.equal(catalogPage(value),1);
  assert.equal(catalogPage("2"),2);
  const {client,calls}=fixture({products:{data:[product],count:45,error:null}});
  const result=await loadCatalog(client,"store-a",2);
  assert.equal(result.page,2);assert.equal(result.hasNext,true);
  assert.ok(calls.some((call) => JSON.stringify(call)===JSON.stringify(["products","range",PAGE_SIZE,PAGE_SIZE*2-1])));
});

test("invalid numeric data is displayed as unavailable, not invented zero stock/price", async () => {
  const {client}=fixture({product_variants:{data:[{...variant,price_cents:"1250",stock_quantity:-1}],count:1,error:null}});
  const result=await loadCatalog(client);
  assert.equal(result.products[0].variants[0].priceCents,null);
  assert.equal(result.products[0].variants[0].stockQuantity,null);
});

test("price formatting preserves cents and handles zero/missing values", () => {
  assert.equal(formatPrice(1250,"USD"),"$12.50");assert.equal(formatPrice(0,"USD"),"$0.00");
  assert.equal(formatPrice(null,"USD"),"Price unavailable");
  assert.equal(formatPrice(1250,"Unknown"),"12.50 (currency unavailable)");
});
