import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const css = await readFile("app/globals.css", "utf8");

test("editorial checklist checkboxes stay beside their labels", () => {
  assert.match(css, /\.approval-checklist-form input\[type="checkbox"\]/);
  assert.match(css, /flex:\s*0 0 auto/);
  assert.match(css, /width:\s*18px/);
  assert.match(css, /height:\s*18px/);
});
