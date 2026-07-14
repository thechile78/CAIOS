-- CAIOS v4.6 validated story edits and controlled workflow transitions
-- Apply to a non-production Supabase project first.

create or replace function public.update_story_with_audit(
  p_story_id uuid,
  p_expected_updated_at timestamptz,
  p_title text,
  p_desk text,
  p_priority public.story_priority,
  p_summary text,
  p_body text,
  p_target_status public.story_status
)
returns public.stories
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_existing public.stories;
  v_updated public.stories;
  v_allowed boolean := false;
begin
  if v_actor is null or not public.can_edit_newsroom() then
    raise exception 'not authorized';
  end if;

  if char_length(trim(p_title)) not between 1 and 300 then
    raise exception 'invalid title';
  end if;
  if char_length(trim(p_desk)) not between 1 and 80 then
    raise exception 'invalid desk';
  end if;
  if p_summary is not null and char_length(p_summary) > 2000 then
    raise exception 'invalid summary';
  end if;
  if p_body is not null and char_length(p_body) > 100000 then
    raise exception 'invalid body';
  end if;

  select * into v_existing
  from public.stories
  where id = p_story_id
  for update;

  if not found then
    raise exception 'story not found';
  end if;
  if v_existing.updated_at is distinct from p_expected_updated_at then
    raise exception 'story changed by another user';
  end if;
  if v_existing.status in ('approved', 'wordpress_draft', 'published', 'archived') then
    raise exception 'locked story status';
  end if;

  v_allowed := case v_existing.status
    when 'discovered' then p_target_status in ('discovered', 'researching')
    when 'researching' then p_target_status in ('researching', 'fact_check', 'drafting')
    when 'fact_check' then p_target_status in ('fact_check', 'researching', 'drafting')
    when 'drafting' then p_target_status in ('drafting', 'fact_check', 'seo_review')
    when 'seo_review' then p_target_status in ('seo_review', 'drafting', 'asset_review')
    when 'asset_review' then p_target_status in ('asset_review', 'seo_review', 'awaiting_approval')
    when 'awaiting_approval' then p_target_status in ('awaiting_approval', 'asset_review')
    else false
  end;

  if not v_allowed then
    raise exception 'invalid workflow transition';
  end if;

  update public.stories
  set title = trim(p_title),
      desk = trim(p_desk),
      priority = p_priority,
      summary = nullif(trim(coalesce(p_summary, '')), ''),
      body = nullif(p_body, ''),
      status = p_target_status,
      updated_by = v_actor,
      updated_at = clock_timestamp()
  where id = p_story_id
  returning * into v_updated;

  insert into public.audit_events (story_id, actor_id, event_type, event_data)
  values (
    p_story_id,
    v_actor,
    'story_updated',
    jsonb_build_object(
      'from_status', v_existing.status,
      'to_status', v_updated.status,
      'previous_updated_at', v_existing.updated_at,
      'updated_at', v_updated.updated_at
    )
  );

  return v_updated;
end;
$$;

revoke all on function public.update_story_with_audit(uuid,timestamptz,text,text,public.story_priority,text,text,public.story_status) from public;
grant execute on function public.update_story_with_audit(uuid,timestamptz,text,text,public.story_priority,text,text,public.story_status) to authenticated;
