# CAIOS YouTube OAuth Connector

## Approved Google Cloud values

Use the existing Google Cloud project `CAIOS Social Hub`.

### Authorized JavaScript origin

`https://caios.vercel.app`

### Authorized redirect URI

`https://caios.vercel.app/api/integrations/youtube/callback`

The URI must match exactly, including HTTPS and the full path.

## Required hosting secrets

Add these as encrypted Vercel environment variables for Production and Preview:

- `GOOGLE_YOUTUBE_CLIENT_ID`
- `GOOGLE_YOUTUBE_CLIENT_SECRET`
- `GOOGLE_YOUTUBE_REDIRECT_URI=https://caios.vercel.app/api/integrations/youtube/callback`

Never commit the client secret to GitHub, documentation, screenshots, chat messages, or browser-visible code.

## Requested permissions

- `openid`
- `email`
- `profile`
- `https://www.googleapis.com/auth/youtube.readonly`
- `https://www.googleapis.com/auth/youtube.upload`

No account deletion, comment moderation, partner, Content ID, or broad YouTube management scope is requested.

## Current acceptance test

Visit `/integrations/youtube`, select **Connect YouTube securely**, authorize the Google test user, and verify that CAIOS returns the expected channel title and channel ID.

The initial connector deliberately does not persist OAuth tokens. Persistent encrypted token storage is a separate acceptance gate and must be completed before automated private uploads are enabled.

## Publishing safety rule

OAuth authorization does not authorize public publishing. All video, metadata, visibility, destination, and scheduling changes remain subject to The Chile's final approval.
