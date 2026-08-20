create table if not exists public.search_console_connections (
  id uuid primary key default gen_random_uuid(),
  property_uri text not null unique,
  permission_level text not null,
  account_name text not null default 'Chilemaniacs',
  access_token_ciphertext text not null,
  refresh_token_ciphertext text,
  access_token_expires_at timestamptz,
  scopes text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  connected_by uuid references public.profiles(id),
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.search_console_connections is
  'Server-only encrypted Google Search Console OAuth vault for read-only analytics access.';

alter table public.search_console_connections enable row level security;

revoke all on table public.search_console_connections from anon, authenticated;

grant select, insert, update, delete on table public.search_console_connections to service_role;
