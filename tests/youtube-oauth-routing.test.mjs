import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const proxy = await readFile(new URL("../proxy.ts", import.meta.url), "utf8");
const page = await readFile(new URL("../app/integrations/youtube/page.tsx", import.meta.url), "utf8");
const connect = await readFile(new URL("../app/api/integrations/youtube/connect/route.ts", import.meta.url), "utf8");
const callback = await readFile(new URL("../app/api/integrations/youtube/callback/route.ts", import.meta.url), "utf8");

test("YouTube acceptance routes bypass newsroom login", () => {
  assert.match(proxy, /"\/integrations\/youtube"/);
  assert.match(proxy, /"\/api\/integrations\/youtube\/connect"/);
  assert.match(proxy, /"\/api\/integrations\/youtube\/callback"/);
  assert.doesNotMatch(page, /requireCurrentProfile/);
});

test("OAuth state remains server validated and short lived", () => {
  assert.match(connect, /randomBytes\(32\)/);
  assert.match(connect, /httpOnly: true/);
  assert.match(connect, /sameSite: "lax"/);
  assert.match(connect, /maxAge: 10 \* 60/);
  assert.match(callback, /state !== expectedState/);
});

test("acceptance test does not upload or persist tokens", () => {
  assert.doesNotMatch(callback, /videos\.insert|uploadType|resumable/i);
  assert.doesNotMatch(callback, /\.from\(|insert\(|upsert\(/);
  assert.match(page, /Tokens are not persisted/);
  assert.match(page, /explicit approval remains required/);
});
