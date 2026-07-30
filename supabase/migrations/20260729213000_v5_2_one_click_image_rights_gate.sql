-- Enforce the v5.2 image-rights gate on the one-click approval and publication path.

create or replace function public.begin_approved_wordpress_publication(
  p_story_id uuid,
  p_expected_updated_at timestamptz,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_story public.stories%rowtype;
  v_checklist public.editorial_checklists%rowtype;
  v_record_id uuid;
  v_now timestamptz := clock_timestamp();
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if v_actor is null then raise exception 'authentication required'; end if;
  if public.current_app_role() not in ('administrator', 'editor', 'reviewer') then
    raise exception 'reviewer role required';
  end if;
  if v_note is not null and char_length(v_note) > 4000 then
    raise exception 'approval note is too long';
  end if;

  select * into v_story from public.stories where id = p_story_id for update;
  if not found then raise exception 'story not found'; end if;
  if v_story.updated_at is distinct from p_expected_updated_at then
    raise exception 'stale story version';
  end if;
  if v_story.status <> 'awaiting_approval' then
    raise exception 'story is not awaiting approval';
  end if;

  select * into v_checklist from public.editorial_checklists where story_id = p_story_id for update;
  if not found or not (
    v_checklist.sources_verified and v_checklist.facts_verified and
    v_checklist.rights_reviewed and v_checklist.seo_reviewed
  ) then
    raise exception 'editorial checklist is incomplete';
  end if;

  if not exists (
    select 1
    from public.story_image_rights
    where story_id = p_story_id
      and active
      and commercial_use_allowed
  ) then
    raise exception 'approval requires an approved image or branded fallback';
  end if;

  insert into public.approvals (story_id, approved_by, decision, note)
  values (p_story_id, v_actor, 'approved', v_note);

  update public.editorial_checklists
  set human_approved = true, updated_by = v_actor, updated_at = v_now
  where story_id = p_story_id;

  update public.stories
  set status = 'approved', approved_by = v_actor, approved_at = v_now,
      updated_by = v_actor, updated_at = v_now
  where id = p_story_id;

  insert into public.publication_records (
    story_id, platform, state, requested_by, approved_by, created_at, updated_at
  ) values (
    p_story_id, 'wordpress', 'requested', v_actor, v_actor, v_now, v_now
  ) returning id into v_record_id;

  insert into public.audit_events (story_id, actor_id, event_type, event_data)
  values (
    p_story_id, v_actor, 'wordpress_publication_authorized',
    jsonb_build_object(
      'publication_record_id', v_record_id,
      'approval_click', true,
      'image_rights_gate', 'passed'
    )
  );

  return v_record_id;
end;
$$;

revoke all on function public.begin_approved_wordpress_publication(uuid,timestamptz,text)
from public, anon;

grant execute on function public.begin_approved_wordpress_publication(uuid,timestamptz,text)
to authenticated;
