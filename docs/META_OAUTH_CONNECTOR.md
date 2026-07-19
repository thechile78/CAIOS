# Meta OAuth connector

CAIOS links one approved Facebook Page and its linked Instagram Business account. The connector only requests `pages_show_list`, `pages_read_engagement`, and `instagram_basic`. It never requests `pages_manage_posts` or `instagram_content_publish`, and it contains no publishing or scheduling endpoint.

## Approved identities

- Facebook Page: `Chilemaniacs` (`1214069685123391`)
- Instagram Business: `@thechilepromotions` (`27490136290650142`)

The callback verifies those values from Meta's server response. It also requires the Instagram `account_type` to be `BUSINESS`; a Creator account fails closed until it is converted or an administrator deliberately changes the expected account type.

## Meta app configuration

1. Create or select the CAIOS Meta app and configure Facebook Login for Business.
2. Add the exact valid OAuth redirect URI `https://caios.vercel.app/api/integrations/meta/callback`.
3. Configure the server-only environment variables listed in `.env.example`.
4. Generate independent, high-entropy values for `META_OAUTH_STATE_SECRET` and the base64-encoded 32-byte `SOCIAL_TOKEN_ENCRYPTION_KEY`.
5. Apply the Supabase migration before connecting.

OAuth state is signed, expires after ten minutes, is bound to the current administrator and exact redirect URI, and is consumed after the callback. Access tokens are encrypted with AES-256-GCM before server-only storage.

## Safeguards

Database constraints force publishing, scheduling, automatic posting, and automatic approval off. They force explicit approval on and reject Meta rows containing publishing scopes. Browser roles have no access to the credential table. Connecting creates no content or delivery job.
