import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("WordPress authorization requests posts and media with a fixed callback", async () => {
  const oauth = await read("lib/wordpress-oauth.ts");
  assert.match(oauth, /WORDPRESS_REQUIRED_SCOPES = \["posts", "media"\]/);
  assert.match(
    oauth,
    /WORDPRESS_REDIRECT_URI =\s*"https:\/\/caios\.vercel\.app\/api\/integrations\/wordpress\/callback"/,
  );
  assert.match(oauth, /scope", WORDPRESS_REQUIRED_SCOPES\.join\(" "\)/);
  assert.match(oauth, /public-api\.wordpress\.com\/oauth2\/authorize/);
  assert.match(oauth, /public-api\.wordpress\.com\/oauth2\/token-info/);
  assert.match(oauth, /assertWordPressScopes\(scopes\)/);
});

test("WordPress token exchange reports only a sanitized provider error code", async () => {
  const oauth = await read("lib/wordpress-oauth.ts");
  assert.match(oauth, /safeWordPressOAuthErrorCode\(await response\.text\(\)\)/);
  assert.match(oauth, /\^\[a-z0-9_-\]\{1,64\}\$/i);
  assert.match(oauth, /providerCode,/);
  assert.doesNotMatch(oauth, /console\.error\([^)]*(clientSecret|accessToken|code,)/s);
});

test("WordPress OAuth state is signed, administrator-bound, expiring, and consumed", async () => {
  const oauth = await read("lib/wordpress-oauth.ts");
  const connect = await read("app/api/integrations/wordpress/connect/route.ts");
  const callback = await read("app/api/integrations/wordpress/callback/route.ts");
  assert.match(oauth, /createHmac\("sha256"/);
  assert.match(oauth, /timingSafeEqual/);
  assert.match(oauth, /payload\.userId !== userId/);
  assert.match(oauth, /payload\.redirectUri !== WORDPRESS_REDIRECT_URI/);
  assert.match(oauth, /payload\.expiresAt < Date\.now\(\)/);
  assert.match(connect, /roleCanAdminister/);
  assert.match(connect, /httpOnly: true/);
  assert.match(connect, /secure: true/);
  assert.match(connect, /sameSite: "lax"/);
  assert.match(callback, /state !== expectedState/);
  assert.match(callback, /cookies\.delete/);
  assert.match(callback, /verifyWordPressOAuthState\(state, profile\.id\)/);
});

test("WordPress tokens are encrypted server-side and summaries never read ciphertext", async () => {
  const vault = await read("lib/social-token-vault.ts");
  const summary = vault.slice(
    vault.indexOf("export async function getWordPressConnectionSummary"),
    vault.indexOf("interface StoreYoutubeConnectionInput"),
  );
  assert.match(vault, /access_token_ciphertext: encryptSecret\(input\.accessToken\)/);
  assert.match(vault, /decryptSecret\(row\.access_token_ciphertext\)/);
  assert.match(vault, /provider: "wordpress"/);
  assert.match(vault, /publishing_enabled: true/);
  assert.match(vault, /approval_required: true/);
  assert.doesNotMatch(summary, /access_token_ciphertext|decryptSecret/);
});

test("publication preflights the encrypted WordPress connection before media upload", async () => {
  const client = await read("lib/wordpress-client.ts");
  assert.match(client, /getWordPressConnection/);
  assert.match(client, /assertWordPressScopes\(connection\.scopes\)/);
  assert.match(client, /inspectWordPressToken\(connection\.accessToken\)/);
  assert.match(client, /await getValidWordPressAccessToken\(\)/);
  assert.ok(
    client.indexOf("await getValidWordPressAccessToken()") <
      client.indexOf("await uploadWordPressFeaturedImage"),
  );
});

test("database requires posts plus media and allows only an audited human retry", async () => {
  const migration = await read(
    "supabase/migrations/20260729223000_wordpress_oauth_media_and_retry.sql",
  );
  assert.match(migration, /scopes @> array\['posts', 'media'\]::text\[\]/);
  assert.match(migration, /begin_wordpress_publication_retry/);
  assert.match(migration, /current_app_role\(\) not in \('administrator', 'editor', 'reviewer'\)/);
  assert.match(migration, /recorded human approval is required/);
  assert.match(migration, /approved editorial checklist is incomplete/);
  assert.match(migration, /approved image rights are required/);
  assert.match(migration, /human_retry_click/);
  assert.match(migration, /revoke all[\s\S]*from public, anon/);
  assert.match(migration, /grant execute[\s\S]*to authenticated/);
});

test("approved publication failures expose a separate human retry action", async () => {
  const actions = await read("app/stories/[id]/approval-actions.ts");
  const page = await read("app/stories/[id]/page.tsx");
  assert.match(actions, /retryWordPressPublicationAction/);
  assert.match(actions, /begin_wordpress_publication_retry/);
  assert.match(actions, /await publishApprovedStory\(storyId, publicationRecordId\)/);
  assert.match(page, /Retry WordPress publication/);
  assert.match(page, /Check WordPress connection/);
  assert.match(page, /it never repeats or bypasses editorial approval/);
});
