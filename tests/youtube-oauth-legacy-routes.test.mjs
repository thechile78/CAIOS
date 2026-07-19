import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const proxy = await readFile(new URL("../proxy.ts", import.meta.url), "utf8");
const authRoute = await readFile(new URL("../app/api/youtube/auth/route.ts", import.meta.url), "utf8");
const callbackRoute = await readFile(new URL("../app/api/youtube/callback/route.ts", import.meta.url), "utf8");

test("legacy YouTube URLs redirect to canonical integration routes", () => {
  assert.match(authRoute, /\/api\/integrations\/youtube\/connect/);
  assert.match(callbackRoute, /\/api\/integrations\/youtube\/callback/);
  assert.match(callbackRoute, /destination\.search = source\.search/);
});

test("legacy compatibility URLs bypass newsroom authentication", () => {
  assert.match(proxy, /"\/api\/youtube\/auth"/);
  assert.match(proxy, /"\/api\/youtube\/callback"/);
});
