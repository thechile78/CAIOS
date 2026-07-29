import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const formatter = await readFile(new URL("../lib/date-time.ts", import.meta.url), "utf8");
const queue = await readFile(new URL("../components/authenticated-editorial-queue.tsx", import.meta.url), "utf8");

test("story timestamps are rendered explicitly in Houston time", () => {
  assert.match(formatter, /America\/Chicago/);
  assert.match(formatter, /timeZoneName: "short"/);
  assert.match(queue, /formatHoustonDateTime\(story\.updatedAt\)/);
  assert.doesNotMatch(queue, /story\.updatedAt\)\.toLocaleString/);
});
