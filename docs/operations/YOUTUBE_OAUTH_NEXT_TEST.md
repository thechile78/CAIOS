# Runtime test

After this hotfix reaches production:

1. Open `https://caios.vercel.app/integrations/youtube`.
2. Select **Connect YouTube securely**.
3. Choose the Google test user that manages The Chile channel.
4. Confirm only identity, YouTube read-only, and video-upload permissions are requested.
5. Confirm CAIOS returns the intended channel title and channel ID.
6. Confirm no video was uploaded and no OAuth token was persisted.
