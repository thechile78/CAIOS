# YouTube OAuth acceptance routing fix

The Google OAuth acceptance page and its connect/callback endpoints are intentionally reachable without a CAIOS newsroom session during the limited connection test.

## Public acceptance routes

- `/integrations/youtube`
- `/api/integrations/youtube/connect`
- `/api/integrations/youtube/callback`

## Safety boundary

- OAuth state is random, HTTP-only, same-site, secure, and expires after ten minutes.
- Only `youtube.readonly` and `youtube.upload` plus standard identity scopes are requested.
- OAuth tokens are not persisted by this acceptance slice.
- No video upload, scheduling, or public publishing action exists here.
- The Chile's explicit approval remains required before any future private upload test.

After authorization succeeds, the page displays only the connected channel title, channel ID, and whether Google returned an offline token. Persistent encrypted token storage requires a separate reviewed migration and key-management boundary.
