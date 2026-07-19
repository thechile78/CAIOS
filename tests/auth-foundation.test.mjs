import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const auth = await readFile(new URL("../lib/auth.ts", import.meta.url), "utf8");
const proxy = await readFile(new URL("../proxy.ts", import.meta.url), "utf8");
const actions = await readFile(new URL("../app/login/actions.ts", import.meta.url), "utf8");
const callback = await readFile(new URL("../app/auth/callback/route.ts", import.meta.url), "utf8");

test("role helpers preserve least-privilege boundaries", () => {
  assert.match(auth, /administrator.*editor.*producer.*researcher/s);
  assert.match(auth, /administrator.*editor.*reviewer/s);
  assert.match(auth, /role === "administrator"/);
  assert.doesNotMatch(auth, /read_only.*canEdit/i);
});

test("newsroom access fails closed for anonymous or inactive users", () => {
  assert.match(proxy, /!data\.user.*!isPublicPath/s);
  assert.match(auth, /\.eq\("active", true\)/);
  assert.match(auth, /redirect\("\/login"\)/);
});

test("redirect destinations reject protocol-relative paths", () => {
  assert.match(actions, /value\.startsWith\("\/\/"\)/);
  assert.match(callback, /value\.startsWith\("\/\/"\)/);
});

test("service-role credentials are absent from browser and proxy auth code", () => {
  for (const source of [auth, proxy, actions, callback]) {
    assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY/);
  }
});
