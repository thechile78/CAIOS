import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const bridge = await readFile(new URL("../lib/wordpress-draft-bridge.ts", import.meta.url), "utf8");
const client = await readFile(new URL("../lib/wordpress-client.ts", import.meta.url), "utf8");
const storyPage = await readFile(new URL("../app/stories/[id]/page.tsx", import.meta.url), "utf8");
const migration = await readFile(new URL("../supabase/migrations/20260728190000_streamlined_wordpress_story_media.sql", import.meta.url), "utf8");

test("WordPress package contains linked source, inline social embed, and image", () => {
  assert.match(bridge, /Read More <a href=.*>HERE<\/a>/);
  assert.match(bridge, /wp:embed/);
  assert.match(bridge, /youtube|instagram|twitter/);
  assert.match(bridge, /media_urls/);
  assert.match(client, /media_urls\[\]/);
});

test("story review is a single audited submission before human approval", () => {
  assert.match(storyPage, /Save and submit for approval/);
  assert.match(storyPage, /Social post to embed/);
  assert.match(storyPage, /Story image URL/);
  assert.match(migration, /submit_story_for_approval/);
  assert.match(migration, /status = 'awaiting_approval'/);
  assert.doesNotMatch(migration, /status = 'approved'/);
});
