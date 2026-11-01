/* eslint-disable @typescript-eslint/no-require-imports */
// Run: node --test components/auth/auth.test.cjs
// Real NextAuth/OpenID/JWT code; only outgoing HTTP is mocked. No live OAuth calls.
const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const { EventEmitter } = require("node:events");
const { Readable } = require("node:stream");
const http = require("node:http");
const https = require("node:https");
const ts = require("typescript");
const { generateKeyPair, exportJWK, SignJWT } = require("jose");
const { NextRequest } = require("next/server");
const { AuthHandler } = require(path.join(path.dirname(require.resolve("next-auth")), "core/index.js"));

const root = path.resolve(__dirname, "../..");
const modules = new Map();
function loadTs(filename) {
  filename = path.resolve(filename);
  if (modules.has(filename)) return modules.get(filename).exports;
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = mod.require.bind(mod);
  mod.require = (id) => {
    const candidate = id.startsWith("@/") ? path.join(root, id.slice(2)) : id.startsWith(".") ? path.resolve(path.dirname(filename), id) : null;
    return candidate && fs.existsSync(`${candidate}.ts`) ? loadTs(`${candidate}.ts`) : originalRequire(id);
  };
  modules.set(filename, mod);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, filename);
  return mod.exports;
}
const { safeLocalCallbackUrl } = loadTs(path.join(root, "lib/authRedirect.ts"));
const { createAuthOptions, getAuthConfiguration, providerUserId } = loadTs(path.join(root, "lib/authConfig.ts"));
const fixture = {
  NEXTAUTH_URL: "https://worship.example", NEXTAUTH_SECRET: "test-fixture-only-never-use-in-production",
  GOOGLE_CLIENT_ID: "test-google-client", GOOGLE_CLIENT_SECRET: "test-google-secret",
  NAVER_CLIENT_ID: "test-naver-client", NAVER_CLIENT_SECRET: "test-naver-secret",
};
const previousEnv = Object.fromEntries(Object.keys(fixture).map((key) => [key, process.env[key]]));
Object.assign(process.env, fixture);
const options = createAuthOptions(fixture);
const requests = [];
let keys;
let googleAudience = fixture.GOOGLE_CLIENT_ID;
let naverId = "naver-account-123";
let invalidNaverProfile = false;
const originalHttp = http.request;
const originalHttps = https.request;
// Only the transport is substituted. State, PKCE, CSRF, token signature and session
// validation continue through the installed libraries unchanged.
https.request = (address, init) => {
  const req = new EventEmitter();
  req.body = "";
  req.headers = { ...init.headers };
  req.setHeader = (key, value) => { req.headers[key] = value; };
  req.removeHeader = (key) => { delete req.headers[key]; };
  req.write = (chunk) => { req.body += chunk; };
  req.destroy = () => {};
  req.end = () => queueMicrotask(async () => {
    try {
      const url = new URL(address);
      requests.push({ url: address, body: req.body, headers: req.headers });
      let body;
      if (address === "https://accounts.google.com/.well-known/openid-configuration") {
        body = { issuer: "https://accounts.google.com", authorization_endpoint: "https://accounts.google.com/o/oauth2/v2/auth", token_endpoint: "https://oauth2.googleapis.com/token", jwks_uri: "https://www.googleapis.com/oauth2/v3/certs", response_types_supported: ["code"], subject_types_supported: ["public"], id_token_signing_alg_values_supported: ["RS256"] };
      } else if (address === "https://www.googleapis.com/oauth2/v3/certs") {
        body = { keys: [{ ...await exportJWK(keys.publicKey), kid: "test-key", use: "sig", alg: "RS256" }] };
      } else if (address === "https://oauth2.googleapis.com/token") {
        const claims = { sub: "google-account-123", name: "찬양팀원", email: "same@example.test", email_verified: true };
        body = { access_token: "mock-google-token", token_type: "Bearer", expires_in: 3600, id_token: await new SignJWT(claims).setProtectedHeader({ alg: "RS256", kid: "test-key" }).setIssuer("https://accounts.google.com").setAudience(googleAudience).setIssuedAt().setExpirationTime("5m").sign(keys.privateKey) };
      } else if (url.origin + url.pathname === "https://nid.naver.com/oauth2.0/token") {
        body = { access_token: "mock-naver-token", token_type: "Bearer", expires_in: 3600 };
      } else if (address === "https://openapi.naver.com/v1/nid/me") {
        body = { resultcode: "00", message: "success", response: { ...(invalidNaverProfile ? {} : { id: naverId }), nickname: "찬양팀원", email: "same@example.test" } };
      } else throw new Error(`Unexpected external request blocked: ${url.origin}${url.pathname}`);
      const response = Readable.from([Buffer.from(JSON.stringify(body))]);
      response.statusCode = 200;
      response.headers = { "content-type": "application/json" };
      req.emit("response", response);
    } catch (error) { req.emit("error", error); }
  });
  return req;
};
http.request = () => { throw new Error("Unexpected HTTP request blocked"); };
after(() => {
  http.request = originalHttp;
  https.request = originalHttps;
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});

function absorb(jar, response) {
  for (const cookie of response.cookies ?? []) {
    if (cookie.options?.maxAge === 0) delete jar[cookie.name];
    else jar[cookie.name] = cookie.value;
  }
}
async function request(action, jar = {}, extra = {}) {
  const response = await AuthHandler({ options, req: { action, method: "GET", cookies: { ...jar }, headers: {}, query: {}, ...extra } });
  absorb(jar, response);
  return response;
}
async function start(provider, callbackUrl = "/invite/token-safe?from=team") {
  const jar = {};
  const csrf = await request("csrf", jar);
  const response = await request("signin", jar, { method: "POST", providerId: provider, body: { csrfToken: csrf.body.csrfToken, callbackUrl } });
  return { jar, response, url: new URL(response.redirect) };
}
function hasSession(response) {
  return response.cookies?.some((cookie) => cookie.name.includes("session-token") && cookie.value && cookie.options?.maxAge !== 0);
}

test("authentication contract and real OAuth flow with mocked network", async (t) => {
  keys = await generateKeyPair("RS256");
  await t.test("missing config disables providers; invalid origins fail closed", () => {
    assert.equal(getAuthConfiguration({}).ready, false);
    assert.deepEqual(createAuthOptions({}).providers, []);
    for (const url of ["https://u:p@site.test", "javascript:alert(1)", "https://site.test/path", "http://site.test", "https://site.test/?x=1"]) {
      assert.equal(getAuthConfiguration({ ...fixture, NEXTAUTH_URL: url }).ready, false, url);
    }
    assert.equal(getAuthConfiguration({ ...fixture, GOOGLE_CLIENT_SECRET: "" }).providers[0].enabled, false);
    assert.equal(getAuthConfiguration({ ...fixture, GOOGLE_CLIENT_SECRET: "" }).providers[1].enabled, true);
  });
  await t.test("development name login never turns on in production or without opt-in", () => {
    assert.equal(getAuthConfiguration({ ...fixture, DEV_LOGIN: "1", NODE_ENV: "development" }).devLogin, true);
    assert.equal(getAuthConfiguration({ ...fixture, DEV_LOGIN: "1", NODE_ENV: "production" }).devLogin, false);
    assert.equal(getAuthConfiguration({ ...fixture, NODE_ENV: "development" }).devLogin, false);
    assert.equal(getAuthConfiguration({ DEV_LOGIN: "1", NODE_ENV: "development" }).devLogin, false);
    assert.equal(createAuthOptions({ ...fixture, DEV_LOGIN: "1", NODE_ENV: "production" }).providers.some((provider) => (provider.options?.id ?? provider.id) === "dev"), false);
    assert.equal(createAuthOptions({ ...fixture, DEV_LOGIN: "1", NODE_ENV: "development" }).providers.some((provider) => (provider.options?.id ?? provider.id) === "dev"), true);
  });
  await t.test("callback redirects preserve invites and reject foreign/encoded destinations", async () => {
    for (const value of ["//evil.test", "/\\evil.test", "/%5cevil.test", "/%2fevil.test", "/%252fevil.test", "/%00evil", "https://worship.example.evil.test", "https://user@worship.example", "javascript:alert(1)", "/api/auth/callback/google", "/api%2fauth/signin", " /invite/x", "/invite/%"]) {
      assert.equal(safeLocalCallbackUrl(value, fixture.NEXTAUTH_URL), "/dashboard", value);
    }
    const invite = "/invite/abc_123-xyz?source=kakao#join";
    assert.equal(safeLocalCallbackUrl(invite), invite);
    assert.equal(safeLocalCallbackUrl(fixture.NEXTAUTH_URL + invite, fixture.NEXTAUTH_URL), invite);
    assert.equal(await options.callbacks.redirect({ url: "https://evil.test", baseUrl: "https://evil-base.test" }), `${fixture.NEXTAUTH_URL}/dashboard`);
  });
  await t.test("provider identity is stable, separated by provider, never by email", () => {
    assert.equal(providerUserId("naver", "123"), providerUserId("naver", "123"));
    assert.notEqual(providerUserId("naver", "123"), providerUserId("google", "123"));
    assert.match(providerUserId("google", "123"), /^[a-f0-9]{64}$/);
    assert.throws(() => providerUserId("credentials", "123"));
    assert.throws(() => providerUserId("naver", ""));
  });
  await t.test("unconfigured route returns null session, empty providers and safe failures", async () => {
    const route = loadTs(path.join(root, "app/api/auth/[...nextauth]/route.ts"));
    const secret = process.env.NEXTAUTH_SECRET;
    delete process.env.NEXTAUTH_SECRET;
    try {
      for (const [action, expected] of [["session", null], ["providers", {}]]) {
        const response = await route.GET(new NextRequest(`${fixture.NEXTAUTH_URL}/api/auth/${action}`), { params: Promise.resolve({ nextauth: [action] }) });
        assert.deepEqual(await response.json(), expected);
        assert.equal(response.headers.get("cache-control"), "no-store");
        assert.equal(response.headers.has("set-cookie"), false);
      }
      const response = await route.POST(new NextRequest(`${fixture.NEXTAUTH_URL}/api/auth/signin/google`, { method: "POST" }), { params: Promise.resolve({ nextauth: ["signin", "google"] }) });
      assert.equal(response.status, 503);
      assert.equal((await response.json()).error, "Configuration");
      const redirect = await route.GET(new NextRequest(`${fixture.NEXTAUTH_URL}/api/auth/signin/google?callbackUrl=https://evil.test`), { params: Promise.resolve({ nextauth: ["signin", "google"] }) });
      assert.equal(new URL(redirect.headers.get("location")).origin, fixture.NEXTAUTH_URL);
    } finally { process.env.NEXTAUTH_SECRET = secret; }
  });
  await t.test("Google authorization has state + S256 PKCE; Naver uses official endpoint + state", async () => {
    for (const [provider, origin] of [["google", "https://accounts.google.com"], ["naver", "https://nid.naver.com"]]) {
      const { url, response, jar } = await start(provider);
      assert.equal(url.origin, origin);
      assert.equal(url.searchParams.get("redirect_uri"), `${fixture.NEXTAUTH_URL}/api/auth/callback/${provider}`);
      assert.equal(url.searchParams.get("client_id"), fixture[`${provider.toUpperCase()}_CLIENT_ID`]);
      assert.equal(url.searchParams.get("response_type"), "code");
      assert.ok(url.searchParams.get("state"));
      assert.ok(jar["__Secure-next-auth.state"]);
      for (const cookie of response.cookies.filter((item) => /state|pkce/.test(item.name))) {
        assert.equal(cookie.options.httpOnly, true);
        assert.equal(cookie.options.secure, true);
        assert.equal(cookie.options.sameSite, "lax");
      }
      if (provider === "google") {
        assert.equal(url.searchParams.get("code_challenge_method"), "S256");
        assert.ok(url.searchParams.get("code_challenge"));
        assert.ok(jar["__Secure-next-auth.pkce.code_verifier"]);
      }
    }
  });
  await t.test("signin without valid CSRF cannot begin OAuth", async () => {
    const before = requests.length;
    const result = await request("signin", {}, { method: "POST", providerId: "naver", body: { csrfToken: "forged" } });
    assert.match(result.redirect, /csrf=true/);
    assert.equal(requests.length, before);
    assert.equal(hasSession(result), false);
  });
  await t.test("tampered, missing and cross-provider state never exchange a code", async () => {
    for (const variant of ["tampered", "missing", "wrong-provider"]) {
      const { jar, url } = await start(variant === "wrong-provider" ? "google" : "naver");
      if (variant === "missing") delete jar["__Secure-next-auth.state"];
      const before = requests.filter((item) => /\/token/.test(item.url)).length;
      const result = await request("callback", jar, { providerId: "naver", query: { code: "mock-code", state: variant === "tampered" ? "forged-state" : url.searchParams.get("state") } });
      assert.equal(hasSession(result), false);
      assert.match(result.redirect, /error=OAuthCallback/);
      assert.equal(requests.filter((item) => /\/token/.test(item.url)).length, before);
    }
  });
  await t.test("cancelled OAuth creates no session and preserves callback cookie", async () => {
    const { jar } = await start("naver");
    const result = await request("callback", jar, { providerId: "naver", query: { error: "access_denied" } });
    assert.equal(hasSession(result), false);
    assert.equal(jar["__Secure-next-auth.callback-url"], `${fixture.NEXTAUTH_URL}/invite/token-safe?from=team`);
  });
  await t.test("Naver callback creates stable JWT and a session; arbitrary session updates cannot alter identity", async () => {
    const { jar, url } = await start("naver");
    const callback = await request("callback", jar, { providerId: "naver", query: { code: "mock-code", state: url.searchParams.get("state") } });
    assert.equal(callback.redirect, `${fixture.NEXTAUTH_URL}/invite/token-safe?from=team`);
    assert.equal(hasSession(callback), true);
    assert.equal(jar["__Secure-next-auth.state"], undefined);
    const session = await request("session", jar);
    assert.equal(session.body.user.id, providerUserId("naver", naverId));
    assert.equal(JSON.stringify(session.body).includes("mock-naver-token"), false);
    const csrf = await request("csrf", jar);
    const update = await request("session", jar, { method: "POST", body: { csrfToken: csrf.body.csrfToken, data: { userId: "attacker", user: { id: "attacker", name: "attacker" }, email: "attacker@example.test" } } });
    assert.equal(update.body.user.id, session.body.user.id);
    assert.equal(update.body.user.name, session.body.user.name);
    assert.equal(update.body.user.email, session.body.user.email);
    const replay = await request("callback", jar, { providerId: "naver", query: { code: "mock-code", state: url.searchParams.get("state") } });
    assert.equal(hasSession(replay), false);
    const logout = await request("signout", jar, { method: "POST", body: { csrfToken: csrf.body.csrfToken, callbackUrl: "/login?signedOut=1" } });
    assert.equal(logout.redirect, `${fixture.NEXTAUTH_URL}/login?signedOut=1`);
    assert.deepEqual((await request("session", jar)).body, {});
  });
  await t.test("Google callback verifies signed ID token and exchanges PKCE verifier", async () => {
    const { jar, url } = await start("google");
    const result = await request("callback", jar, { providerId: "google", query: { code: "mock-google-code", state: url.searchParams.get("state") } });
    assert.equal(hasSession(result), true);
    const session = await request("session", jar);
    assert.equal(session.body.user.id, providerUserId("google", "google-account-123"));
    assert.notEqual(session.body.user.id, providerUserId("naver", naverId));
    const exchange = requests.findLast((item) => item.url === "https://oauth2.googleapis.com/token");
    assert.ok(new URLSearchParams(exchange.body).get("code_verifier"));
  });
  await t.test("incomplete Naver profile and missing Google PKCE cannot authenticate", async () => {
    invalidNaverProfile = true;
    const naver = await start("naver");
    const result = await request("callback", naver.jar, { providerId: "naver", query: { code: "mock-code", state: naver.url.searchParams.get("state") } });
    assert.equal(hasSession(result), false);
    invalidNaverProfile = false;
    const google = await start("google");
    delete google.jar["__Secure-next-auth.pkce.code_verifier"];
    const blocked = await request("callback", google.jar, { providerId: "google", query: { code: "mock-code", state: google.url.searchParams.get("state") } });
    assert.equal(hasSession(blocked), false);
  });
  await t.test("Google ID token issued for another client cannot authenticate", async () => {
    googleAudience = "another-application";
    try {
      const { jar, url } = await start("google");
      const result = await request("callback", jar, { providerId: "google", query: { code: "mock-code", state: url.searchParams.get("state") } });
      assert.equal(hasSession(result), false);
      assert.match(result.redirect, /error=OAuthCallback/);
    } finally { googleAudience = fixture.GOOGLE_CLIENT_ID; }
  });
  await t.test("tampered and expired session cookies cannot identify a user", async () => {
    const { encode } = require("next-auth/jwt");
    const expired = await encode({ secret: fixture.NEXTAUTH_SECRET, token: { userId: providerUserId("naver", naverId) }, maxAge: -3600 });
    for (const token of ["tampered.jwt.cookie", expired]) {
      const result = await request("session", { "__Secure-next-auth.session-token": token });
      assert.deepEqual(result.body, {});
    }
  });
});
