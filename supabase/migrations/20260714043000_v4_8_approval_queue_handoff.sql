-- CAIOS v4.8 approval queue and internal handoff
-- Apply to a non-production Supabase project first.

create type public.handoff_state as enum (
  'ready_for_packaging',
  'packaging',
  'packaged',
  'cancelled'
);

create table public.editorial_handoffs (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete restrict,
  state public.handoff_state not null default 'ready_for_packaging',
  requested_by uuid not null references public.profiles(id),
  requested_at timestamptz not null default now(),
  updated_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now(),
  note text check (note is null or char_length(note) <= 2000)
);

create unique index one_active_handoff_per_story
on public.editorial_handoffs (story_id)
where state in ('ready_for_packaging', 'packaging', 'packaged');

alter table public.editorial_handoffs enable row level security;

create policy "authenticated users read editorial handoffs"
on public.editorial_handoffs for select to authenticated
using (true);

create policy "authorized newsroom roles insert editorial handoffs"
on public.editorial_handoffs for insert to authenticated
with check (
  public.current_app_role() in ('administrator', 'editor', 'producer')
  and requested_by = auth.uid()
  and updated_by = auth.uid()
);

create or replace function public.request_approved_story_handoff(
  p_story_id uuid,
  p_expected_updated_at timestamptz,
  p_note text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_story public.stories%rowtype;
  v_checklist public.editorial_checklists%rowtype;
  v_handoff_id uuid;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if v_actor is null then
    raise exception 'authentication required';
  end if;

  if public.current_app_role() not in ('administrator', 'editor', 'producer') then
    raise exception 'insufficient role';
  end if;

  if v_note is not null and char_length(v_note) > 2000 then
    raise exception 'handoff note is too long';
  end if;

  select * into v_story
  from public.stories
  where id = p_story_id
  for update;

  if not found then
    raise exception 'story not found';
  end if;

  if v_story.updated_at is distinct from p_expected_updated_at then
    raise exception 'stale story version';
  end if;

  if v_story.status <> 'approved' then
    raise exception 'story is not approved';
  end if;

  if v_story.approved_by is null or v_story.approved_at is null then
    raise exception 'story approval metadata is incomplete';
  end if;

  select * into v_checklist
  from public.editorial_checklists
  where story_id = p_story_id;

  if not found or not (
    v_checklist.sources_verified and
    v_checklist.facts_verified and
    v_checklist.rights_reviewed and
    v_checklist.seo_reviewed and
    v_checklist.human_approved
  ) then
    raise exception 'approved checklist is incomplete';
  end if;

  if not exists (
    select 1 from public.approvals
    where story_id = p_story_id
      and decision = 'approved'
      and approved_by = v_story.approved_by
      and created_at <= v_story.updated_at
  ) then
    raise exception 'matching approval record is missing';
  end if;

  insert into public.editorial_handoffs (
    story_id, requested_by, updated_by, note
  ) values (
    p_story_id, v_actor, v_actor, v_note
  ) returning id into v_handoff_id;

  insert into public.audit_events (story_id, actor_id, event_type, event_data)
  values (
    p_story_id,
    v_actor,
    'approved_story_handoff_requested',
    jsonb_build_object('handoff_id', v_handoff_id, 'note', v_note)
  );

  return v_handoff_id;
end;
$$;

grant execute on function public.request_approved_story_handoff(uuid, timestamptz, text) to authenticated;
