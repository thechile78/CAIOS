-- CAIOS v4.7 editorial checklist and human approval workflow
-- Apply to a non-production Supabase project first.

create or replace function public.save_editorial_checklist(
  p_story_id uuid,
  p_expected_updated_at timestamptz,
  p_sources_verified boolean,
  p_facts_verified boolean,
  p_rights_reviewed boolean,
  p_seo_reviewed boolean
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_story public.stories%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if v_actor is null then raise exception 'authentication required'; end if;
  if not (public.can_edit_newsroom() or public.can_review_newsroom()) then raise exception 'insufficient role'; end if;

  select * into v_story from public.stories where id = p_story_id for update;
  if not found then raise exception 'story not found'; end if;
  if v_story.status in ('approved', 'wordpress_draft', 'published', 'archived') then raise exception 'checklist is locked for this story state'; end if;
  if v_story.updated_at is distinct from p_expected_updated_at then raise exception 'stale story version'; end if;

  insert into public.editorial_checklists (
    story_id, sources_verified, facts_verified, rights_reviewed,
    seo_reviewed, human_approved, updated_by, updated_at
  ) values (
    p_story_id, p_sources_verified, p_facts_verified, p_rights_reviewed,
    p_seo_reviewed, false, v_actor, v_now
  )
  on conflict (story_id) do update set
    sources_verified = excluded.sources_verified,
    facts_verified = excluded.facts_verified,
    rights_reviewed = excluded.rights_reviewed,
    seo_reviewed = excluded.seo_reviewed,
    human_approved = false,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at;

  update public.stories set updated_by = v_actor, updated_at = v_now where id = p_story_id;

  insert into public.audit_events (story_id, actor_id, event_type, event_data)
  values (p_story_id, v_actor, 'editorial_checklist_saved', jsonb_build_object(
    'sources_verified', p_sources_verified,
    'facts_verified', p_facts_verified,
    'rights_reviewed', p_rights_reviewed,
    'seo_reviewed', p_seo_reviewed
  ));

  return v_now;
end;
$$;

create or replace function public.record_editorial_decision(
  p_story_id uuid,
  p_expected_updated_at timestamptz,
  p_decision text,
  p_note text default null
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_story public.stories%rowtype;
  v_checklist public.editorial_checklists%rowtype;
  v_now timestamptz := clock_timestamp();
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if v_actor is null then raise exception 'authentication required'; end if;
  if not public.can_review_newsroom() then raise exception 'reviewer role required'; end if;
  if p_decision not in ('approved', 'rejected', 'changes_requested') then raise exception 'invalid approval decision'; end if;
  if v_note is not null and char_length(v_note) > 4000 then raise exception 'approval note is too long'; end if;

  select * into v_story from public.stories where id = p_story_id for update;
  if not found then raise exception 'story not found'; end if;
  if v_story.updated_at is distinct from p_expected_updated_at then raise exception 'stale story version'; end if;
  if v_story.status <> 'awaiting_approval' then raise exception 'story is not awaiting approval'; end if;

  select * into v_checklist from public.editorial_checklists where story_id = p_story_id for update;
  if not found then raise exception 'editorial checklist is missing'; end if;

  if p_decision = 'approved' and not (
    v_checklist.sources_verified and v_checklist.facts_verified and
    v_checklist.rights_reviewed and v_checklist.seo_reviewed
  ) then raise exception 'editorial checklist is incomplete'; end if;

  insert into public.approvals (story_id, approved_by, decision, note)
  values (p_story_id, v_actor, p_decision, v_note);

  if p_decision = 'approved' then
    update public.editorial_checklists
    set human_approved = true, updated_by = v_actor, updated_at = v_now
    where story_id = p_story_id;

    update public.stories
    set status = 'approved', approved_by = v_actor, approved_at = v_now,
        updated_by = v_actor, updated_at = v_now
    where id = p_story_id;
  else
    update public.editorial_checklists
    set human_approved = false, updated_by = v_actor, updated_at = v_now
    where story_id = p_story_id;

    update public.stories
    set status = case when p_decision = 'changes_requested'
        then 'drafting'::public.story_status else 'fact_check'::public.story_status end,
        approved_by = null, approved_at = null, updated_by = v_actor, updated_at = v_now
    where id = p_story_id;
  end if;

  insert into public.audit_events (story_id, actor_id, event_type, event_data)
  values (p_story_id, v_actor, 'editorial_decision_recorded',
    jsonb_build_object('decision', p_decision, 'note', v_note));

  return v_now;
end;
$$;

revoke all on function public.save_editorial_checklist(uuid, timestamptz, boolean, boolean, boolean, boolean) from public;
revoke all on function public.record_editorial_decision(uuid, timestamptz, text, text) from public;
grant execute on function public.save_editorial_checklist(uuid, timestamptz, boolean, boolean, boolean, boolean) to authenticated;
grant execute on function public.record_editorial_decision(uuid, timestamptz, text, text) to authenticated;
