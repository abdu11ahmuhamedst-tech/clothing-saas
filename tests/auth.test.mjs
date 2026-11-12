import assert from "node:assert/strict";
import { test } from "node:test";
import { passwordLogin, localLogout, loadMemberStores } from "../src/lib/auth/operations.mjs";

const member = {store_id:"store-a", user_id:"user-a", role:"owner"};
const store = {id:"store-a", name:"Demo", slug:"demo-clothing", status:"draft", currency:"USD"};
function fixture({ user = {id:"user-a"}, authError = null, memberships = [member], stores = [store], membershipError = null, storeError = null } = {}) {
  const calls = [];
  const client = {
    auth: {getUser:async () => {calls.push("getUser"); return {data:{user},error:authError};}},
    from(table) {
      calls.push(["from",table]);
      return {select(columns) {
        calls.push(["select",columns]);
        return {
          eq(column,value) { calls.push(["eq",column,value]); return Promise.resolve({data:memberships,error:membershipError}); },
          in(column,value) { calls.push(["in",column,value]); return Promise.resolve({data:stores,error:storeError}); },
        };
      }};
    },
  };
  return {client,calls};
}
const form = (email="owner@example.com", password="test-only password") => {
  const data = new FormData(); data.set("email",email); data.set("password",password); return data;
};

test("login validates inputs before constructing a client", async () => {
  for (const input of [form("bad", "password"), form("owner@example.com",""), new FormData()]) {
    assert.equal(await passwordLogin(input, () => assert.fail("must not call Auth")), "invalid");
  }
});

test("login uses password Auth, normalizes email and preserves password bytes", async () => {
  const result = await passwordLogin(form(" owner@example.com "," password "), async () => ({auth:{signInWithPassword:async (credentials) => {
    assert.deepEqual(credentials,{email:"owner@example.com",password:" password "});
    return {data:{session:{access_token:"test-only"}},error:null};
  }}}));
  assert.equal(result,"success");
});

test("bad credentials and absent sessions never report login success", async () => {
  for (const response of [{data:null,error:{message:"private details"}}, {data:{user:{id:"unconfirmed"}},error:null}]) {
    assert.equal(await passwordLogin(form(),async () => ({auth:{signInWithPassword:async () => response}})),"invalid");
  }
});

test("login SDK/configuration failures are generic", async () => {
  assert.equal(await passwordLogin(form(),async () => {throw new Error("private credential");}),"unavailable");
});

test("logout revokes only this session and awaits success", async () => {
  let called = false;
  const result = await localLogout(async () => ({auth:{signOut:async (options) => {
    assert.deepEqual(options,{scope:"local"});called=true;return {error:null};
  }}}));
  assert.equal(called,true);assert.equal(result,"success");
});

test("logout failure is not presented as successful", async () => {
  assert.equal(await localLogout(async () => ({auth:{signOut:async () => ({error:{message:"private error"}})}})),"unavailable");
  assert.equal(await localLogout(async () => {throw new Error("private error");}),"unavailable");
});

for (const authError of [null,{status:401,message:"expired"},{status:403,message:"banned"}]) {
  test(`unauthorized user cannot trigger tenant queries (${authError?.status ?? "no user"})`, async () => {
    const {client,calls}=fixture({user:null,authError});
    assert.deepEqual(await loadMemberStores(client),{status:"unauthorized",stores:[]});
    assert.deepEqual(calls,["getUser"]);
  });
}

test("Auth server outage does not expose tenant data", async () => {
  const {client,calls}=fixture({authError:{status:503,message:"private"}});
  assert.deepEqual(await loadMemberStores(client),{status:"unavailable",stores:[]});
  assert.deepEqual(calls,["getUser"]);
});

test("dashboard uses verified user membership and projects only verified cloud columns", async () => {
  const {client,calls}=fixture();
  const result=await loadMemberStores(client);
  assert.deepEqual(result,{status:"ready",stores:[{...store,role:"owner"}]});
  assert.deepEqual(calls,["getUser",["from","store_members"],["select","store_id,user_id,role"],["eq","user_id","user-a"],["from","stores"],["select","id,name,slug,status,currency"],["in","id",["store-a"]]]);
});

test("zero memberships skips the store query", async () => {
  const {client,calls}=fixture({memberships:[]});
  assert.deepEqual(await loadMemberStores(client),{status:"ready",stores:[]});
  assert.equal(calls.some((c) => Array.isArray(c)&&c[1]==="stores"),false);
});

test("foreign membership/store rows never appear in dashboard output", async () => {
  const {client,calls}=fixture({memberships:[member,{store_id:"store-b",user_id:"user-b",role:"owner"}],stores:[store,{...store,id:"store-b",name:"Foreign"}]});
  const result=await loadMemberStores(client);
  assert.deepEqual(result.stores,[{...store,role:"owner"}]);
  assert.deepEqual(calls.find((c) => Array.isArray(c)&&c[0]==="in"),["in","id",["store-a"]]);
});

test("unknown roles are not upgraded and cannot authorize a store query", async () => {
  const {client,calls}=fixture({memberships:[{...member,role:"platform_admin"}]});
  assert.deepEqual(await loadMemberStores(client),{status:"ready",stores:[]});
  assert.equal(calls.some((c) => Array.isArray(c)&&c[1]==="stores"),false);
});

test("multi-store members receive only their RLS-visible store intersection", async () => {
  const {client}=fixture({memberships:[member,{...member,store_id:"store-b",role:"staff"}],stores:[{...store,id:"store-b"}]});
  assert.deepEqual((await loadMemberStores(client)).stores,[{...store,id:"store-b",role:"staff"}]);
});

test("membership revocation is rechecked on each dashboard load", async () => {
  const {client}=fixture({memberships:[member]});
  assert.equal((await loadMemberStores(client)).stores.length,1);
  const revoked=fixture({memberships:[]});
  assert.deepEqual(await loadMemberStores(revoked.client),{status:"ready",stores:[]});
});

for (const failure of [{membershipError:{message:"sensitive policy"}},{storeError:{message:"sensitive policy"}},{memberships:null},{stores:null}]) {
  test(`query failure is generic and never returns partial tenant data (${Object.keys(failure)[0]})`, async () => {
    const {client}=fixture(failure);
    assert.deepEqual(await loadMemberStores(client),{status:"unavailable",stores:[]});
  });
}

test("thrown Auth/network errors fail closed", async () => {
  const {client}=fixture();client.auth.getUser=async () => {throw new Error("secret");};
  assert.deepEqual(await loadMemberStores(client),{status:"unavailable",stores:[]});
});
