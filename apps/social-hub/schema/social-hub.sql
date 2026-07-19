-- CAIOS Social Hub v1 schema for Supabase/PostgreSQL

create type content_status as enum (
  'draft','qa_failed','ready_for_review','changes_requested','approved',
  'scheduled','publishing','published','publish_failed','rejected'
);

create table if not exists brand_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists social_connections (
  id uuid primary key default gen_random_uuid(),
  brand_profile_id uuid not null references brand_profiles(id) on delete cascade,
  platform text not null,
  external_account_id text not null,
  display_name text,
  encrypted_token_ref text not null,
  scopes text[] not null default '{}',
  status text not null default 'connected',
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (brand_profile_id, platform, external_account_id)
);

create table if not exists content_items (
  id uuid primary key default gen_random_uuid(),
  brand_profile_id uuid not null references brand_profiles(id),
  title text,
  caption text,
  media_manifest jsonb not null default '{}'::jsonb,
  platform_payloads jsonb not null default '{}'::jsonb,
  status content_status not null default 'draft',
  content_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists qa_results (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references content_items(id) on delete cascade,
  check_name text not null,
  passed boolean not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists approvals (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references content_items(id) on delete cascade,
  approver text not null,
  decision text not null check (decision in ('approved','changes_requested','rejected')),
  approved_platforms text[] not null default '{}',
  content_hash text not null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists publish_jobs (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references content_items(id) on delete cascade,
  social_connection_id uuid not null references social_connections(id),
  scheduled_for timestamptz,
  status text not null default 'queued',
  external_post_id text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists audit_log (
  id bigint generated always as identity primary key,
  actor text not null,
  action text not null,
  resource_type text not null,
  resource_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Publishing gate: a publish job may only be created for approved content.
create or replace function enforce_approved_publish_job()
returns trigger language plpgsql as $$
begin
  if not exists (
    select 1 from content_items c
    where c.id = new.content_item_id and c.status = 'approved'
  ) then
    raise exception 'Content must be approved before publishing';
  end if;
  return new;
end;
$$;

drop trigger if exists publish_job_requires_approval on publish_jobs;
create trigger publish_job_requires_approval
before insert or update of content_item_id on publish_jobs
for each row execute function enforce_approved_publish_job();
-- NON-DEPLOYABLE PROTOTYPE. DO NOT APPLY TO SUPABASE OR ANY OTHER DATABASE.
-- Only reviewed files under /supabase/migrations are deployable. This design
-- artifact contains future-state publish-job concepts that are intentionally
-- absent from the live CAIOS approval-only workflow.
