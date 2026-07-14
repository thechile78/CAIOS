-- CAIOS v4.2 database and authentication foundation
-- Apply only to a non-production Supabase project first.

create extension if not exists pgcrypto;

create type public.app_role as enum (
  'administrator',
  'editor',
  'producer',
  'researcher',
  'reviewer',
  'read_only'
);

create type public.story_priority as enum ('breaking', 'high', 'normal', 'low');
create type public.story_status as enum (
  'discovered',
  'researching',
  'fact_check',
  'drafting',
  'seo_review',
  'asset_review',
  'awaiting_approval',
  'approved',
  'wordpress_draft',
  'published',
  'archived'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role public.app_role not null default 'read_only',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 300),
  slug text unique,
  desk text not null,
  priority public.story_priority not null default 'normal',
  status public.story_status not null default 'discovered',
  summary text,
  body text,
  owner_id uuid references public.profiles(id),
  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references public.profiles(id),
  constraint approved_state_requires_human
    check (
      status not in ('approved', 'wordpress_draft', 'published')
      or (approved_at is not null and approved_by is not null)
    )
);

create table public.story_sources (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  url text not null,
  publisher text,
  title text,
  reliability text not null default 'unrated',
  verified boolean not null default false,
  verified_by uuid references public.profiles(id),
  verified_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (story_id, url)
);

create table public.editorial_checklists (
  story_id uuid primary key references public.stories(id) on delete cascade,
  sources_verified boolean not null default false,
  facts_verified boolean not null default false,
  rights_reviewed boolean not null default false,
  seo_reviewed boolean not null default false,
  human_approved boolean not null default false,
  updated_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now()
);

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete restrict,
  approved_by uuid not null references public.profiles(id),
  decision text not null check (decision in ('approved', 'rejected', 'changes_requested')),
  note text,
  created_at timestamptz not null default now()
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  story_id uuid references public.stories(id) on delete restrict,
  actor_id uuid references public.profiles(id),
  event_type text not null,
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.publication_records (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete restrict,
  platform text not null check (platform in ('wordpress')),
  external_id text,
  external_url text,
  state text not null check (state in ('requested', 'draft_created', 'published', 'failed')),
  requested_by uuid not null references public.profiles(id),
  approved_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, external_id)
);

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and active = true;
$$;

create or replace function public.can_edit_newsroom()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() in ('administrator', 'editor', 'producer', 'researcher'), false);
$$;

create or replace function public.can_review_newsroom()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() in ('administrator', 'editor', 'reviewer'), false);
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.stories enable row level security;
alter table public.story_sources enable row level security;
alter table public.editorial_checklists enable row level security;
alter table public.approvals enable row level security;
alter table public.audit_events enable row level security;
alter table public.publication_records enable row level security;

create policy "authenticated users read active profiles"
on public.profiles for select to authenticated
using (active = true);

create policy "administrators manage profiles"
on public.profiles for all to authenticated
using (public.current_app_role() = 'administrator')
with check (public.current_app_role() = 'administrator');

create policy "authenticated users read stories"
on public.stories for select to authenticated
using (true);

create policy "newsroom editors create stories"
on public.stories for insert to authenticated
with check (public.can_edit_newsroom() and created_by = auth.uid() and updated_by = auth.uid());

create policy "newsroom editors update stories"
on public.stories for update to authenticated
using (public.can_edit_newsroom())
with check (public.can_edit_newsroom() and updated_by = auth.uid());

create policy "administrators delete stories"
on public.stories for delete to authenticated
using (public.current_app_role() = 'administrator');

create policy "authenticated users read sources"
on public.story_sources for select to authenticated using (true);
create policy "newsroom editors manage sources"
on public.story_sources for all to authenticated
using (public.can_edit_newsroom())
with check (public.can_edit_newsroom() and created_by = auth.uid());

create policy "authenticated users read checklists"
on public.editorial_checklists for select to authenticated using (true);
create policy "newsroom staff update checklists"
on public.editorial_checklists for all to authenticated
using (public.can_edit_newsroom() or public.can_review_newsroom())
with check ((public.can_edit_newsroom() or public.can_review_newsroom()) and updated_by = auth.uid());

create policy "authenticated users read approvals"
on public.approvals for select to authenticated using (true);
create policy "reviewers append approvals"
on public.approvals for insert to authenticated
with check (public.can_review_newsroom() and approved_by = auth.uid());

create policy "authenticated users read audit events"
on public.audit_events for select to authenticated using (true);
create policy "authenticated users append own audit events"
on public.audit_events for insert to authenticated
with check (actor_id = auth.uid());

create policy "authenticated users read publication records"
on public.publication_records for select to authenticated using (true);
create policy "approved editors request publication records"
on public.publication_records for insert to authenticated
with check (
  public.current_app_role() in ('administrator', 'editor')
  and requested_by = auth.uid()
  and approved_by is not null
  and exists (
    select 1 from public.stories s
    join public.editorial_checklists c on c.story_id = s.id
    where s.id = story_id
      and s.status in ('approved', 'wordpress_draft', 'published')
      and c.sources_verified
      and c.facts_verified
      and c.rights_reviewed
      and c.seo_reviewed
      and c.human_approved
  )
);

-- No update/delete policies are intentionally defined for approvals or audit_events.
-- Publication updates must be performed by a trusted server-side integration after
-- revalidating authorization and approval state. Service-role keys must never reach browsers.
