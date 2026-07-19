-- Clean up the redundant index found by the database advisor on the existing
-- vault and cover the administrator foreign key used by connection audits.
drop index if exists public.social_oauth_connections_provider_account_key;

create index if not exists social_oauth_connections_connected_by_idx
  on public.social_oauth_connections(connected_by);
