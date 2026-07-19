-- OAuth credentials are server-only. This table is intentionally inaccessible
-- to browser roles and hard-locks Meta connections to approval-first behavior.
create table if not exists public.social_oauth_connections (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_account_id text not null,
  account_name text not null,
  access_token_ciphertext text not null,
  refresh_token_ciphertext text,
  access_token_expires_at timestamptz,
  scopes text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.social_oauth_connections
  add column if not exists connected_by uuid references public.profiles(id) on delete restrict,
  add column if not exists verified_at timestamptz,
  add column if not exists publishing_enabled boolean not null default false,
  add column if not exists scheduling_enabled boolean not null default false,
  add column if not exists auto_post_enabled boolean not null default false,
  add column if not exists auto_approval_enabled boolean not null default false,
  add column if not exists approval_required boolean not null default true;

alter table public.social_oauth_connections
  drop constraint if exists social_oauth_connections_provider_check,
  drop constraint if exists social_oauth_connections_safeguards_check,
  drop constraint if exists social_oauth_connections_meta_scopes_check;

alter table public.social_oauth_connections
  add constraint social_oauth_connections_provider_check
    check (provider in ('youtube', 'facebook', 'instagram')),
  add constraint social_oauth_connections_safeguards_check
    check (
      publishing_enabled = false
      and scheduling_enabled = false
      and auto_post_enabled = false
      and auto_approval_enabled = false
      and approval_required = true
    ),
  add constraint social_oauth_connections_meta_scopes_check
    check (
      provider not in ('facebook', 'instagram')
      or not (scopes && array['pages_manage_posts', 'instagram_content_publish']::text[])
    );

create index if not exists social_oauth_connections_connected_by_idx
  on public.social_oauth_connections(connected_by);

alter table public.social_oauth_connections enable row level security;
revoke all on table public.social_oauth_connections from anon, authenticated;
grant select, insert, update on table public.social_oauth_connections to service_role;

comment on table public.social_oauth_connections is
  'Server-only encrypted OAuth vault. Meta publishing and automation are structurally disabled.';
