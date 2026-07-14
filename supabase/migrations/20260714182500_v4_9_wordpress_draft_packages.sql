-- CAIOS v4.9 internal WordPress draft-package preparation
-- This migration does not connect to WordPress or publish content.

create type public.draft_package_state as enum ('prepared', 'exported', 'cancelled');

create table public.wordpress_draft_packages (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete restrict,
  handoff_id uuid not null references public.editorial_handoffs(id) on delete restrict,
  state public.draft_package_state not null default 'prepared',
  title_snapshot text not null check (char_length(title_snapshot) between 1 and 300),
  excerpt_snapshot text,
  content_snapshot text,
  prepared_by uuid not null references public.profiles(id),
  prepared_at timestamptz not null default now(),
  exported_at timestamptz,
  cancelled_at timestamptz,
  note text check (note is null or char_length(note) <= 2000)
);

create unique index one_active_wordpress_package_per_story
on public.wordpress_draft_packages (story_id)
where state in ('prepared', 'exported');

alter table public.wordpress_draft_packages enable row level security;

create policy "authenticated users read WordPress draft packages"
on public.wordpress_draft_packages for select to authenticated
using (true);

create or replace function public.prepare_wordpress_draft_package(
  p_handoff_id uuid,
  p_expected_story_updated_at timestamptz,
  p_note text default null
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
  v_package_id uuid;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if v_actor is null then raise exception 'authentication required'; end if;
  if public.current_app_role() not in ('administrator', 'editor', 'producer') then
    raise exception 'insufficient role';
  end if;
  if v_note is not null and char_length(v_note) > 2000 then
    raise exception 'package note is too long';
  end if;

  select * into v_handoff from public.editorial_handoffs
  where id = p_handoff_id for update;
  if not found then raise exception 'handoff not found'; end if;
  if v_handoff.state not in ('ready_for_packaging', 'packaging') then
    raise exception 'handoff is not available for packaging';
  end if;

  select * into v_story from public.stories
  where id = v_handoff.story_id for update;
  if not found then raise exception 'story not found'; end if;
  if v_story.updated_at is distinct from p_expected_story_updated_at then
    raise exception 'stale story version';
  end if;
  if v_story.status <> 'approved' or v_story.approved_by is null or v_story.approved_at is null then
    raise exception 'story is not approved';
  end if;

  select * into v_checklist from public.editorial_checklists
  where story_id = v_story.id;
  if not found or not (
    v_checklist.sources_verified and v_checklist.facts_verified and
    v_checklist.rights_reviewed and v_checklist.seo_reviewed and
    v_checklist.human_approved
  ) then raise exception 'approved checklist is incomplete'; end if;

  if not exists (
    select 1 from public.approvals
    where story_id = v_story.id and decision = 'approved'
      and approved_by = v_story.approved_by
  ) then raise exception 'matching approval record is missing'; end if;

  insert into public.wordpress_draft_packages (
    story_id, handoff_id, title_snapshot, excerpt_snapshot,
    content_snapshot, prepared_by, note
  ) values (
    v_story.id, v_handoff.id, v_story.title, v_story.summary,
    v_story.body, v_actor, v_note
  ) returning id into v_package_id;

  update public.editorial_handoffs
  set state = 'packaged', updated_by = v_actor, updated_at = clock_timestamp()
  where id = v_handoff.id;

  insert into public.audit_events (story_id, actor_id, event_type, event_data)
  values (
    v_story.id, v_actor, 'wordpress_draft_package_prepared',
    jsonb_build_object('package_id', v_package_id, 'handoff_id', v_handoff.id)
  );

  return v_package_id;
end;
$$;

grant execute on function public.prepare_wordpress_draft_package(uuid, timestamptz, text) to authenticated;
