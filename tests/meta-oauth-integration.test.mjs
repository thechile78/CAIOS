import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Meta OAuth requests read/linking scopes and rejects publishing scopes", async () => {
  const oauth = await read("lib/meta-oauth.ts");
  const platforms = JSON.parse(await read("apps/social-hub/config/platforms.json"));
  assert.match(oauth, /pages_show_list/);
  assert.match(oauth, /pages_read_engagement/);
  assert.match(oauth, /instagram_basic/);
  assert.match(oauth, /requireVariable\("META_LOGIN_CONFIG_ID"\)/);
  assert.match(oauth, /url\.searchParams\.set\("config_id", environment\.loginConfigId\)/);
  assert.match(oauth, /FORBIDDEN_META_SCOPES/);
  assert.doesNotMatch(oauth.match(/REQUIRED_META_SCOPES[\s\S]*?as const;/)?.[0] ?? "", /pages_manage_posts|instagram_content_publish/);
  const metaPlatforms = platforms.platforms.filter((platform) => ["facebook_pages", "instagram_business"].includes(platform.id));
  assert.ok(metaPlatforms.every((platform) => platform.publishingEnabled === false));
  assert.ok(metaPlatforms.every((platform) => !platform.minimumScopes.includes("pages_manage_posts")));
  assert.ok(metaPlatforms.every((platform) => !platform.minimumScopes.includes("instagram_content_publish")));
});

test("OAuth state is signed, administrator-bound, redirect-bound, expiring, and one-time", async () => {
  const oauth = await read("lib/meta-oauth.ts");
  const connect = await read("app/api/integrations/meta/connect/route.ts");
  const callback = await read("app/api/integrations/meta/callback/route.ts");
  assert.match(oauth, /createHmac\("sha256"/);
  assert.match(oauth, /timingSafeEqual/);
  assert.match(oauth, /payload\.userId !== userId/);
  assert.match(oauth, /payload\.redirectUri !== META_REDIRECT_URI/);
  assert.match(oauth, /const META_REDIRECT_URI = "https:\/\/caios\.vercel\.app\/api\/integrations\/meta\/callback"/);
  assert.doesNotMatch(oauth, /process\.env\.META_OAUTH_REDIRECT_URI/);
  assert.match(oauth, /payload\.expiresAt < Date\.now\(\)/);
  assert.match(connect, /roleCanAdminister/);
  assert.match(connect, /httpOnly: true/);
  assert.match(connect, /secure: true/);
  assert.match(connect, /sameSite: "lax"/);
  assert.match(callback, /state !== expectedState/);
  assert.match(callback, /cookies\.delete/);
  assert.match(callback, /verifyMetaOAuthState\(state, profile\.id\)/);
});

test("Meta identity verification is hard-bound to Chilemaniacs and its Business account", async () => {
  const oauth = await read("lib/meta-oauth.ts");
  assert.match(oauth, /1214069685123391/);
  assert.match(oauth, /Chilemaniacs/);
  assert.match(oauth, /17841403279084160/);
  assert.match(oauth, /thechilepromotions/);
  assert.match(oauth, /\|\| "BUSINESS"/);
  assert.match(oauth, /targetPage\.name !== environment\.expectedPageName/);
  assert.match(oauth, /selectedPageUrl/);
  assert.match(oauth, /const readAccessToken = targetPage\.access_token \|\| tokens\.access_token/);
  assert.match(oauth, /instagram_business_account\{id,username\}/);
  assert.doesNotMatch(oauth, /instagram_business_account\{id,username,account_type\}/);
  assert.match(oauth, /const accountType = "BUSINESS"/);
  assert.match(oauth, /verifiedInstagram\.id !== environment\.expectedInstagramId/);
  assert.match(oauth, /environment\.expectedInstagramAccountType !== accountType/);
});

test("Meta routes do not expose publishing, scheduling, or automatic approval actions", async () => {
  const callback = await read("app/api/integrations/meta/callback/route.ts");
  const connect = await read("app/api/integrations/meta/connect/route.ts");
  const proxy = await read("proxy.ts");
  const routeSource = `${connect}\n${callback}`;
  assert.doesNotMatch(routeSource, /\/feed|media_publish|scheduled_publish_time|publish_video/);
  assert.doesNotMatch(proxy, /\/integrations\/meta|\/api\/integrations\/meta/);
  assert.match(callback, /storeMetaConnections/);
});

test("a configured Meta system-user token is verified and stored without browser exposure", async () => {
  const oauth = await read("lib/meta-oauth.ts");
  const connect = await read("app/api/integrations/meta/connect/route.ts");
  assert.match(oauth, /process\.env\.META_SYSTEM_USER_TOKEN\?\.trim\(\) \|\| null/);
  assert.match(connect, /const systemUserToken = getMetaSystemUserToken\(\)/);
  assert.match(connect, /verifyMetaAccounts\(\{ access_token: systemUserToken \}\)/);
  assert.match(connect, /storeMetaConnections\(\{ actorId: profile\.id, \.\.\.verified \}\)/);
  assert.doesNotMatch(connect, /searchParams\.set\([^\n]*systemUserToken/);
  assert.doesNotMatch(connect, /cookies\.set\([^\n]*systemUserToken/);
});

test("token summaries never select ciphertext and Meta writes force every safeguard", async () => {
  const vault = await read("lib/social-token-vault.ts");
  const summaryFunction = vault.slice(vault.indexOf("export async function getMetaConnectionSummary"));
  assert.doesNotMatch(summaryFunction, /access_token_ciphertext|refresh_token_ciphertext/);
  assert.match(vault, /publishing_enabled: false/);
  assert.match(vault, /scheduling_enabled: false/);
  assert.match(vault, /auto_post_enabled: false/);
  assert.match(vault, /auto_approval_enabled: false/);
  assert.match(vault, /approval_required: true/);
  assert.match(vault, /getServerDatabaseEnvironment/);
});

test("database locks read-only Meta connections and browser roles out of the vault", async () => {
  const migration = await read("supabase/migrations/20260719043232_meta_read_only_connections.sql");
  assert.match(migration, /provider in \('youtube', 'facebook', 'instagram'\)/);
  assert.match(migration, /publishing_enabled = false/);
  assert.match(migration, /scheduling_enabled = false/);
  assert.match(migration, /auto_post_enabled = false/);
  assert.match(migration, /auto_approval_enabled = false/);
  assert.match(migration, /approval_required = true/);
  assert.match(migration, /pages_manage_posts/);
  assert.match(migration, /instagram_content_publish/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on table public\.social_oauth_connections from anon, authenticated/);
});
