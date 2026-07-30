import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL("../supabase/migrations/20260729190000_v5_2_image_rights_gate.sql", import.meta.url),
  "utf8",
);
const page = await readFile(new URL("../app/stories/[id]/page.tsx", import.meta.url), "utf8");
const bridge = await readFile(new URL("../lib/wordpress-draft-bridge.ts", import.meta.url), "utf8");
const client = await readFile(new URL("../lib/wordpress-client.ts", import.meta.url), "utf8");
const publication = await readFile(new URL("../lib/wordpress-publication.ts", import.meta.url), "utf8");
const oneClickGate = await readFile(
  new URL("../supabase/migrations/20260729213000_v5_2_one_click_image_rights_gate.sql", import.meta.url),
  "utf8",
);

test("image rights evidence is reviewer-approved and audited", () => {
  assert.match(migration, /create table public\.story_image_rights/);
  assert.match(migration, /record_story_image_approval/);
  assert.match(migration, /commercial_use_allowed/);
  assert.match(migration, /story_image_rights_approved/);
  assert.match(migration, /administrator.*editor.*reviewer/);
  assert.match(migration, /revoke all on table public\.story_image_rights/);
});

test("story approval is blocked without a cleared active image", () => {
  assert.match(migration, /image rights checklist requires an approved image or branded fallback/);
  assert.match(migration, /approval requires an approved image or branded fallback/);
  assert.match(page, /Image Rights Gate/);
  assert.match(page, /disabled=\{!approvedImage\}/);
  assert.match(oneClickGate, /begin_approved_wordpress_publication/);
  assert.match(oneClickGate, /approval requires an approved image or branded fallback/);
});

test("immutable WordPress package carries rights evidence", () => {
  assert.match(bridge, /getApprovedStoryImage/);
  assert.match(bridge, /approved_image_missing/);
  assert.match(bridge, /featured_image:/);
  assert.match(bridge, /rights_record_id/);
  assert.match(bridge, /commercial_use_allowed/);
  assert.match(publication, /getApprovedStoryImage/);
  assert.match(publication, /approved_image_missing/);
  assert.match(publication, /featured_image:/);
});

test("WordPress dispatch uploads media and assigns it as the featured image", () => {
  assert.match(client, /media\/new/);
  assert.match(client, /media_urls\[\]/);
  assert.match(client, /attrs\[0\]\[alt\]/);
  assert.match(client, /body\.set\("featured_image", featuredImageId\)/);
  assert.match(client, /featured image must allow commercial use/);
  assert.match(client, /responseBody\.media\?\.\[0\]\?\.ID/);
  assert.equal(
    client.match(/signal: AbortSignal\.timeout\(15_000\)/g)?.length,
    2,
    "media upload and draft creation must have independent request timeouts",
  );
});
