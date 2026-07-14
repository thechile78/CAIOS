-- CAIOS v4.9 immutable internal package snapshots
-- Apply to a non-production Supabase project first.

create table public.editorial_packages (
  id uuid primary key default gen_random_uuid(),
  handoff_id uuid not null unique references public.editorial_handoffs(id) on delete restrict,
  story_id uuid not null references public.stories(id) on delete restrict,
  package_version integer not null default 1 check (package_version > 0),
  story_snapshot jsonb not null,
  checklist_snapshot jsonb not null,
  approval_snapshot jsonb not null,
  source_snapshot jsonb not null default '[]'::jsonb,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint source_snapshot_is_array check (jsonb_typeof(source_snapshot) = 'array')
);

alter table public.editorial_packages enable row level security;

create policy "authenticated users read editorial packages"
on public.editorial_packages for select to authenticated
using (true);

create or replace function public.package_approved_handoff(
  p_handoff_id uuid,
  p_expected_updated_at timestamptz,
  p_source_snapshot jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_handoff public.editorial_handoffs%rowtype;
  v_story public.stories%rowtype;
  v_checklist public.editorial_checklists%rowtype;
  v_approval public.approvals%rowtype;
  v_package_id uuid;
  v_now timestamptz := clock_timestamp();
begin
  if v_actor is null then
    raise exception 'authentication required';
  end if;

  if public.current_app_role() not in ('administrator', 'editor', 'producer') then
    raise exception 'insufficient role';
  end if;

  if jsonb_typeof(coalesce(p_source_snapshot, '[]'::jsonb)) <> 'array' then
    raise exception 'source snapshot must be an array';
  end if;

  if pg_column_size(coalesce(p_source_snapshot, '[]'::jsonb)) > 1048576 then
    raise exception 'source snapshot is too large';
  end if;

  select * into v_handoff
  from public.editorial_handoffs
  where id = p_handoff_id
  for update;

  if not found then
    raise exception 'handoff not found';
  end if;

  if v_handoff.updated_at is distinct from p_expected_updated_at then
    raise exception 'stale handoff version';
  end if;

  if v_handoff.state not in ('ready_for_packaging', 'packaging') then
    raise exception 'handoff cannot be packaged from its current state';
  end if;

  if exists (select 1 from public.editorial_packages where handoff_id = p_handoff_id) then
    raise exception 'handoff already has an immutable package';
  end if;

  select * into v_story
  from public.stories
  where id = v_handoff.story_id
  for share;

  if not found or v_story.status <> 'approved' then
    raise exception 'story is not approved';
  end if;

  select * into v_checklist
  from public.editorial_checklists
  where story_id = v_story.id;

  if not found or not (
    v_checklist.sources_verified and
    v_checklist.facts_verified and
    v_checklist.rights_reviewed and
    v_checklist.seo_reviewed and
    v_checklist.human_approved
  ) then
    raise exception 'approved checklist is incomplete';
  end if;

  select * into v_approval
  from public.approvals
  where story_id = v_story.id
    and decision = 'approved'
    and approved_by = v_story.approved_by
  order by created_at desc
  limit 1;

  if not found then
    raise exception 'matching approval record is missing';
  end if;

  insert into public.editorial_packages (
    handoff_id,
    story_id,
    story_snapshot,
    checklist_snapshot,
    approval_snapshot,
    source_snapshot,
    created_by
  ) values (
    v_handoff.id,
    v_story.id,
    to_jsonb(v_story),
    to_jsonb(v_checklist),
    to_jsonb(v_approval),
    coalesce(p_source_snapshot, '[]'::jsonb),
    v_actor
  ) returning id into v_package_id;

  update public.editorial_handoffs
  set state = 'packaged', updated_by = v_actor, updated_at = v_now
  where id = v_handoff.id;

  insert into public.audit_events (story_id, actor_id, event_type, event_data)
  values (
    v_story.id,
    v_actor,
    'editorial_package_created',
    jsonb_build_object(
      'handoff_id', v_handoff.id,
      'package_id', v_package_id,
      'package_version', 1
    )
  );

  return v_package_id;
end;
$$;

grant execute on function public.package_approved_handoff(uuid, timestamptz, jsonb) to authenticated;

-- No update or delete policies are intentionally defined for editorial_packages.
