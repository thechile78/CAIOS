-- CAIOS v5.0 WordPress draft outbox foundation
-- This migration creates internal intent records only. It performs no network requests.
-- Apply to a non-production Supabase project first.

create type public.wordpress_draft_outbox_state as enum (
  'queued',
  'cancelled'
);

create table public.wordpress_draft_outbox (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null unique references public.editorial_packages(id) on delete restrict,
  story_id uuid not null references public.stories(id) on delete restrict,
  state public.wordpress_draft_outbox_state not null default 'queued',
  payload jsonb not null,
  requested_by uuid not null references public.profiles(id),
  requested_at timestamptz not null default now(),
  constraint payload_is_object check (jsonb_typeof(payload) = 'object'),
  constraint draft_status_only check (payload ->> 'status' = 'draft'),
  constraint no_schedule_date check (not (payload ? 'date') and not (payload ? 'date_gmt'))
);

alter table public.wordpress_draft_outbox enable row level security;

create policy "authenticated users read WordPress draft outbox"
on public.wordpress_draft_outbox for select to authenticated
using (true);

create or replace function public.queue_wordpress_draft_intent(
  p_package_id uuid,
  p_expected_created_at timestamptz,
  p_payload jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_package public.editorial_packages%rowtype;
  v_outbox_id uuid;
begin
  if v_actor is null then
    raise exception 'authentication required';
  end if;

  if public.current_app_role() not in ('administrator', 'editor') then
    raise exception 'administrator or editor role required';
  end if;

  if jsonb_typeof(p_payload) <> 'object' then
    raise exception 'draft payload must be an object';
  end if;

  if p_payload ->> 'status' <> 'draft' then
    raise exception 'only WordPress draft intent is allowed';
  end if;

  if p_payload ? 'date' or p_payload ? 'date_gmt' then
    raise exception 'scheduling fields are prohibited';
  end if;

  if p_payload ? 'password' or p_payload ? 'author' then
    raise exception 'credential and author override fields are prohibited';
  end if;

  if pg_column_size(p_payload) > 1048576 then
    raise exception 'draft payload is too large';
  end if;

  select * into v_package
  from public.editorial_packages
  where id = p_package_id
  for share;

  if not found then
    raise exception 'editorial package not found';
  end if;

  if v_package.created_at is distinct from p_expected_created_at then
    raise exception 'stale package version';
  end if;

  if v_package.story_snapshot ->> 'status' <> 'approved' then
    raise exception 'package story snapshot is not approved';
  end if;

  if coalesce((v_package.checklist_snapshot ->> 'human_approved')::boolean, false) is not true then
    raise exception 'package checklist snapshot lacks human approval';
  end if;

  if exists (
    select 1 from public.wordpress_draft_outbox
    where package_id = p_package_id and state = 'queued'
  ) then
    raise exception 'package already has a queued WordPress draft intent';
  end if;

  insert into public.wordpress_draft_outbox (
    package_id, story_id, payload, requested_by
  ) values (
    v_package.id, v_package.story_id, p_payload, v_actor
  ) returning id into v_outbox_id;

  insert into public.audit_events (story_id, actor_id, event_type, event_data)
  values (
    v_package.story_id,
    v_actor,
    'wordpress_draft_intent_queued',
    jsonb_build_object(
      'outbox_id', v_outbox_id,
      'package_id', v_package.id,
      'status', 'draft',
      'external_request_made', false
    )
  );

  return v_outbox_id;
end;
$$;

grant execute on function public.queue_wordpress_draft_intent(uuid, timestamptz, jsonb) to authenticated;
