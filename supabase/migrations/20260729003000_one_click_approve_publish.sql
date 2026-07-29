-- One human approval click records the decision and publishes the reviewed story.

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
    jsonb_build_object('publication_record_id', v_record_id, 'approval_click', true)
  );

  return v_record_id;
end;
$$;

create or replace function public.finish_approved_wordpress_publication(
  p_publication_record_id uuid,
  p_success boolean,
  p_external_id text default null,
  p_external_url text default null,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_record public.publication_records%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if v_actor is null then raise exception 'authentication required'; end if;
  if public.current_app_role() not in ('administrator', 'editor', 'reviewer') then
    raise exception 'reviewer role required';
  end if;

  select * into v_record
  from public.publication_records
  where id = p_publication_record_id
  for update;

  if not found or v_record.state <> 'requested' then
    raise exception 'publication record is not pending';
  end if;
  if v_record.requested_by <> v_actor or v_record.approved_by <> v_actor then
    raise exception 'publication actor mismatch';
  end if;

  if p_success then
    if nullif(btrim(coalesce(p_external_id, '')), '') is null then
      raise exception 'external id required';
    end if;

    update public.publication_records
    set state = 'published', external_id = p_external_id,
        external_url = p_external_url, updated_at = v_now
    where id = p_publication_record_id;

    update public.stories
    set status = 'published', updated_by = v_actor, updated_at = v_now
    where id = v_record.story_id
      and status = 'approved'
      and approved_by = v_actor;

    if not found then raise exception 'approved story state changed'; end if;
  else
    update public.publication_records
    set state = 'failed', updated_at = v_now
    where id = p_publication_record_id;
  end if;

  insert into public.audit_events (story_id, actor_id, event_type, event_data)
  values (
    v_record.story_id,
    v_actor,
    case when p_success then 'wordpress_publication_succeeded' else 'wordpress_publication_failed' end,
    jsonb_build_object(
      'publication_record_id', p_publication_record_id,
      'external_id', p_external_id,
      'external_url', p_external_url,
      'error', left(coalesce(p_error, ''), 2000)
    )
  );
end;
$$;

revoke all on function public.begin_approved_wordpress_publication(uuid,timestamptz,text) from public, anon;
revoke all on function public.finish_approved_wordpress_publication(uuid,boolean,text,text,text) from public, anon;
grant execute on function public.begin_approved_wordpress_publication(uuid,timestamptz,text) to authenticated;
grant execute on function public.finish_approved_wordpress_publication(uuid,boolean,text,text,text) to authenticated;
