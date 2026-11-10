import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server.js";
import { getPublicSupabaseConfig } from "../src/lib/supabase/config.mjs";
import { updateSession } from "../src/lib/supabase/session.mjs";

const projectRef = "abcdefghijklmnopqrst";
const configuration = { url: `https://${projectRef}.supabase.co`, key: "sb_publishable_test_only", projectRef };
const request = (path = "/dashboard") => new NextRequest(`https://app.example.com${path}`);
const config = () => getPublicSupabaseConfig(configuration);
const assertPrivate = (response) => assert.equal(response.headers.get("cache-control"), "private, no-store");

test("public configuration binds HTTPS URL to the selected project", () => {
  assert.deepEqual(config(), { url: configuration.url, key: configuration.key });
  for (const override of [{url:"https://wrong.supabase.co"}, {url:`http://${projectRef}.supabase.co`}, {projectRef:""}, {key:""}, {url:`${configuration.url}/?token=hidden`}]) {
    assert.throws(() => getPublicSupabaseConfig({...configuration, ...override}));
  }
});

test("privileged and legacy JWT keys are rejected without echoing values", () => {
  for (const key of ["sb_secret_sensitive_test", "eyJfake_service_role_test", "postgres://private-test"]) {
    assert.throws(() => getPublicSupabaseConfig({...configuration, key}), (error) => !error.message.includes(key));
  }
});

test("missing config fails closed without constructing a client", async () => {
  const response = await updateSession(request(), {
    configuration: () => { throw new Error("hidden-configuration"); },
    clientFactory: () => { assert.fail("client must not be constructed"); },
  });
  assert.equal(response.status, 503);
  assertPrivate(response);
  assert.doesNotMatch(await response.text(), /hidden-configuration/);
});

test("verified claims permit dashboard and refresh cookies reach downstream and browser", async () => {
  const req = request();
  let calls = 0;
  const response = await updateSession(req, {
    configuration: config,
    clientFactory: (url, key, options) => {
      assert.equal(url, configuration.url);
      assert.equal(key, configuration.key);
      return { auth: { getClaims: async () => {
        calls++;
        options.cookies.setAll([{name:"sb-session", value:"test-session", options:{httpOnly:true, secure:true, sameSite:"lax", path:"/"}}], {"X-Test-Refresh":"applied"});
        assert.equal(options.cookies.getAll().find((cookie) => cookie.name === "sb-session").value, "test-session");
        return {data:{claims:{sub:"test-user"}}, error:null};
      } } };
    },
  });
  assert.equal(calls, 1);
  assert.equal(response.status, 200);
  assert.equal(response.cookies.get("sb-session").value, "test-session");
  assert.match(response.headers.get("set-cookie"), /HttpOnly/);
  assert.equal(response.headers.get("x-middleware-request-cookie"), "sb-session=test-session");
  assert.equal(response.headers.get("x-test-refresh"), "applied");
  assertPrivate(response);
});

for (const path of ["/dashboard", "/dashboard/products"]) {
  test(`missing or invalid claims deny ${path}, preserving cookie cleanup`, async () => {
    const response = await updateSession(request(path), {
      configuration: config,
      clientFactory: (_url, _key, options) => ({auth:{getClaims:async () => {
        options.cookies.setAll([{name:"sb-session", value:"", options:{maxAge:0, path:"/"}}]);
        return {data:null, error:{message:"not a verified session"}};
      }}}),
    });
    assert.equal(response.status, 401);
    assert.match(response.headers.get("set-cookie"), /Max-Age=0/);
    assert.equal(response.headers.get("x-middleware-next"), null);
    assertPrivate(response);
  });
}

test("anonymous Auth requests can proceed; no tenant authority is inferred", async () => {
  const response = await updateSession(request("/auth/callback"), {
    configuration: config,
    clientFactory: () => ({auth:{getClaims:async () => ({data:null,error:null})}}),
  });
  assert.equal(response.status, 200);
  assertPrivate(response);
});

test("Auth outage fails closed without leaking SDK messages", async () => {
  const response = await updateSession(request(), {
    configuration: config,
    clientFactory: () => ({auth:{getClaims:async () => {throw new Error("hidden-token");}}}),
  });
  assert.equal(response.status, 503);
  assertPrivate(response);
  assert.doesNotMatch(await response.text(), /hidden-token/);
});
