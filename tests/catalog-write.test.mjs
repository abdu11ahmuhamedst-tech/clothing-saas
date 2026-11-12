import assert from "node:assert/strict";
import { test } from "node:test";
import { priceCents,decimalPrice,validateProduct,validateVariant,validateVariants } from "../src/lib/catalog/validate.mjs";
import { createDraft,saveProduct,saveVariant } from "../src/lib/catalog/write.mjs";
import { loadEditor } from "../src/lib/catalog/editor-read.mjs";
const id=(n) => `00000000-0000-0000-0000-${String(n).padStart(12,"0")}`;
const S=id(1), P=id(2), V=id(3), C=id(4), OTHER=id(9);
const product={name:"Shirt",slug:"shirt",description:"Cotton",category_id:C,is_published:true};
const variant={size:"M",color:"Blue",sku:"SHIRT-M",price:"12.29",stock_quantity:"3",is_published:true};
function fixture(respond, {noUser=false,noMembership=false,role="owner",revoke=false}={}) {
  const queries=[];let authCalls=0;
  const client={auth:{getUser:async () => {authCalls++;return {data:{user:noUser||(revoke&&authCalls>1)?null:{id:"user-a"}},error:null};}},
    from(table) {
      const q={table,op:"read",filters:[],payload:null,columns:null};
      const run=async () => {
        queries.push(structuredClone(q));
        const result=respond?.(q,queries);
        if (result!==undefined) return result;
        if(table==="store_members") return {data:noMembership?[]:[{store_id:S,user_id:"user-a",role}],error:null};
        if(table==="stores") return {data:[{id:S,name:"Demo",slug:"demo-clothing",status:"draft",currency:"USD"}],error:null};
        if(q.op!=="read") return {data:q.single?{id:q.payload?.id ?? P}:[{id:table==="products"?P:V}],error:null};
        if(table==="categories") return {data:q.single?{id:C,store_id:S}:[{id:C,store_id:S,name:"Tops"}],count:1,error:null};
        if(table==="products") return {data:{...product,id:P,store_id:S,is_published:false},error:null};
        if(table==="product_variants") return {data:q.single?{id:V,store_id:S,product_id:P,stock_quantity:3}:[{...variant,id:V,store_id:S,product_id:P,price_cents:1229,stock_quantity:3}],count:1,error:null};
        throw new Error("Unexpected table");
      };
      const b={
        select(columns){q.columns=columns;return b;},
        insert(payload){q.op="insert";q.payload=payload;return b;},
        update(payload){q.op="update";q.payload=payload;return b;},
        eq(column,value){q.filters.push([column,value]);return b;},
        in(column,value){q.filters.push([column,value]);return b;},
        order(){return b;},range(){return b;},
        single(){q.single=true;return run();},maybeSingle(){q.single=true;return run();},
        then(resolve,reject){return run().then(resolve,reject);},
      };return b;
    }};
  return {client,queries,authCalls:()=>authCalls};
}
const writes=(queries) => queries.filter((q)=>q.op!=="read");

test("prices use exact decimal-to-integer conversion, never float multiplication",()=>{
  assert.equal(priceCents("0.29"),29);assert.equal(priceCents("1.1"),110);assert.equal(priceCents("0"),0);
  assert.equal(priceCents("90071992547409.91"),Number.MAX_SAFE_INTEGER);
  assert.equal(decimalPrice(29),"0.29");assert.equal(decimalPrice(Number.MAX_SAFE_INTEGER),"90071992547409.91");
});
for(const price of ["-1","1.001","1e2","NaN","Infinity","90071992547409.92","+1","01","1."]) {
  test(`invalid price is rejected (${price})`,()=>assert.throws(()=>priceCents(price)));
}

test("stock respects nonnegative PostgreSQL integer boundaries",()=>{
  assert.equal(validateVariant({...variant,stock_quantity:"2147483647"}).stock_quantity,2147483647);
  for(const stock of ["-1","1.2","2147483648","1e2","","01"]) assert.throws(()=>validateVariant({...variant,stock_quantity:stock}));
});

test("product validation bounds text, slug, categories and status",()=>{
  assert.equal(validateProduct({...product,category_id:""}).category_id,null);
  for(const extra of [{name:""},{name:"x".repeat(201)},{slug:"Upper"},{slug:"bad--slug"},{slug:"x".repeat(161)},{description:"x".repeat(10001)},{category_id:"other"},{is_published:"true"}]) assert.throws(()=>validateProduct({...product,...extra}));
});

test("variant validation bounds fields and rejects invalid objects/status",()=>{
  for(const extra of [{size:""},{size:"x".repeat(61)},{color:"x".repeat(61)},{sku:"x".repeat(101)},{is_published:"true"}]) assert.throws(()=>validateVariant({...variant,...extra}));
  assert.throws(()=>validateVariant(null));assert.throws(()=>validateVariants([]));assert.throws(()=>validateVariants(Array(21).fill(variant)));
});

test("batch duplicate SKU and size/color combinations are rejected before writes",async()=>{
  for(const variants of [[variant,{...variant,sku:"OTHER"}],[variant,{...variant,size:"L",sku:"shirt-m"}]]) {
    const f=fixture();const result=await createDraft(f.client,S,P,product,variants);
    assert.equal(result.outcome,"error");assert.deepEqual(f.queries,[]);
  }
});

for(const auth of [{noUser:true},{noMembership:true},{role:"viewer"}]) {
  test(`creation requires current owner/staff membership (${Object.keys(auth)[0]})`,async()=>{
    const f=fixture(undefined,auth);const result=await createDraft(f.client,S,P,product,[variant]);
    assert.equal(result.outcome,"error");assert.deepEqual(writes(f.queries),[]);
  });
}

test("foreign store never receives a write",async()=>{
  const f=fixture();assert.equal((await createDraft(f.client,OTHER,P,product,[variant])).outcome,"error");assert.deepEqual(writes(f.queries),[]);
});

test("foreign category is rejected before product creation",async()=>{
  const f=fixture((q)=>q.table==="categories"?{data:{id:C,store_id:OTHER},error:null}:undefined);
  assert.equal((await createDraft(f.client,S,P,product,[variant])).outcome,"error");assert.deepEqual(writes(f.queries),[]);
});

test("creation forces drafts, uses fixed tenant links and reauthenticates before variants",async()=>{
  const f=fixture();const result=await createDraft(f.client,S,P,{...product,store_id:OTHER},[{...variant,product_id:OTHER}]);
  assert.equal(result.outcome,"saved");assert.equal(f.authCalls(),2);
  const [p,v]=writes(f.queries);assert.equal(p.payload.store_id,S);assert.equal(p.payload.is_published,false);assert.equal(p.payload.id,P);
  assert.equal(v.payload[0].store_id,S);assert.equal(v.payload[0].product_id,P);assert.equal(v.payload[0].is_published,false);assert.equal(v.payload[0].price_cents,1229);assert.match(v.payload[0].id,/^[0-9a-f-]{36}$/);
});

test("staff may create under the same membership and draft rules",async()=>{
  const f=fixture(undefined,{role:"staff"});assert.equal((await createDraft(f.client,S,P,product,[variant])).outcome,"saved");
});

test("slug uniqueness failure stops before variants and exposes no raw database detail",async()=>{
  const f=fixture((q)=>q.table==="products"&&q.op==="insert"?{error:{code:"23505",message:"secret constraint"}}:undefined);
  const result=await createDraft(f.client,S,P,product,[variant]);assert.equal(result.outcome,"error");assert.equal(writes(f.queries).length,1);assert.doesNotMatch(result.message,/secret constraint/);
});

test("variant duplicate failure preserves the draft with explicit partial result and no cleanup",async()=>{
  const f=fixture((q)=>q.table==="product_variants"&&q.op==="insert"?{error:{code:"23505",message:"secret"}}:undefined);
  const result=await createDraft(f.client,S,P,product,[variant]);assert.equal(result.outcome,"partial");assert.equal(result.productId,P);
  assert.match(result.message,/draft was saved/);assert.equal(writes(f.queries).length,2);assert.ok(writes(f.queries).every((q)=>q.op==="insert"));
});

test("membership revocation between creation requests leaves recoverable draft",async()=>{
  const f=fixture(undefined,{revoke:true});const result=await createDraft(f.client,S,P,product,[variant]);
  assert.equal(result.outcome,"partial");assert.equal(writes(f.queries).length,1);
});

test("unknown product-insert result reports uncertainty with stable recovery ID",async()=>{
  const f=fixture((q)=>{if(q.table==="products"&&q.op==="insert") throw new Error("network credential");});
  const result=await createDraft(f.client,S,P,product,[variant]);assert.equal(result.outcome,"uncertain");assert.equal(result.productId,P);assert.equal(writes(f.queries).length,1);assert.doesNotMatch(result.message,/credential/);
});

test("unknown variant-insert result never deletes or automatically retries",async()=>{
  const f=fixture((q)=>{if(q.table==="product_variants"&&q.op==="insert") throw new Error("network");});
  const result=await createDraft(f.client,S,P,product,[variant]);assert.equal(result.outcome,"uncertain");assert.match(result.message,/draft was saved/);assert.equal(writes(f.queries).length,2);
});

test("product update whitelists editable fields and scopes to tenant plus product",async()=>{
  const f=fixture();const result=await saveProduct(f.client,S,P,{...product,id:OTHER,store_id:OTHER});
  assert.equal(result.outcome,"saved");const q=writes(f.queries)[0];
  assert.deepEqual(Object.keys(q.payload).sort(),["category_id","description","is_published","name","slug"]);
  assert.deepEqual(q.filters,[["store_id",S],["id",P]]);
});

test("foreign product cannot be updated even if a crafted ID is submitted",async()=>{
  const f=fixture((q)=>q.table==="products"&&q.op==="read"?{data:{id:P,store_id:OTHER},error:null}:undefined);
  assert.equal((await saveProduct(f.client,S,P,product)).outcome,"error");assert.deepEqual(writes(f.queries),[]);
});

test("variant update excludes identifiers, links and compares rendered stock",async()=>{
  const f=fixture();const result=await saveVariant(f.client,S,P,V,{...variant,id:OTHER,store_id:OTHER,product_id:OTHER},false,3);
  assert.equal(result.outcome,"saved");const q=writes(f.queries)[0];
  assert.deepEqual(Object.keys(q.payload).sort(),["color","is_published","price_cents","size","sku","stock_quantity"]);
  assert.deepEqual(q.filters,[["store_id",S],["product_id",P],["id",V],["stock_quantity",3]]);
});

test("variant belonging to another product or tenant cannot be updated",async()=>{
  for(const wrong of [{store_id:OTHER},{product_id:OTHER}]) {
    const f=fixture((q)=>q.table==="product_variants"&&q.op==="read"?{data:{id:V,store_id:S,product_id:P,...wrong},error:null}:undefined);
    assert.equal((await saveVariant(f.client,S,P,V,variant,false,3)).outcome,"error");assert.deepEqual(writes(f.queries),[]);
  }
});

test("zero affected rows/concurrent stock change is not reported as success",async()=>{
  const f=fixture((q)=>q.op==="update"?{data:[],error:null}:undefined);
  const result=await saveVariant(f.client,S,P,V,variant,false,3);assert.equal(result.outcome,"uncertain");assert.match(result.message,/Stock or access may have changed/);
});

test("new variant uses server-controlled IDs and links only after product access checks",async()=>{
  const f=fixture();const result=await saveVariant(f.client,S,P,V,variant,true);
  assert.equal(result.outcome,"saved");const q=writes(f.queries)[0];assert.equal(q.op,"insert");assert.equal(q.payload.id,V);assert.equal(q.payload.product_id,P);assert.equal(q.payload.store_id,S);
});

for(const code of ["42501","23503","23514","22003","23505"]) {
  test(`product mutation handles database error ${code} without details`,async()=>{
    const f=fixture((q)=>q.op==="update"?{error:{code,message:"sensitive SQL details"}}:undefined);
    const result=await saveProduct(f.client,S,P,product);assert.equal(result.outcome,"error");assert.doesNotMatch(result.message,/sensitive SQL details/);assert.equal(writes(f.queries).length,1);
  });
}

test("editor refuses an unassigned store before reading categories/products",async()=>{
  const f=fixture();assert.equal((await loadEditor(f.client,OTHER,P)).status,"not-found");assert.equal(f.queries.some((q)=>["categories","products","product_variants"].includes(q.table)),false);
});

test("editor loads only verified store relationships and exact decimal prices",async()=>{
  const f=fixture();const result=await loadEditor(f.client,S,P);assert.equal(result.status,"ready");assert.equal(result.variants[0].price,"12.29");
  for(const q of f.queries.filter((q)=>["categories","products","product_variants"].includes(q.table))) assert.ok(q.filters.some(([k,v])=>k==="store_id"&&v===S));
});

test("editor rejects foreign product rows and incomplete variant lists",async()=>{
  const foreign=fixture((q)=>q.table==="products"?{data:{id:P,store_id:OTHER},error:null}:undefined);
  assert.equal((await loadEditor(foreign.client,S,P)).status,"not-found");
  const truncated=fixture((q)=>q.table==="product_variants"?{data:[],count:1001,error:null}:undefined);
  assert.equal((await loadEditor(truncated.client,S,P)).status,"unavailable");
});
