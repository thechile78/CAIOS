# Supabase staging activation

This deployment marker records that the CAIOS staging Supabase integration was connected in Vercel on 2026-07-15.

The application reads these public authentication variables at build and runtime:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

No secret values belong in this repository. WordPress dispatch and public publishing remain disabled until staging acceptance testing is complete.
