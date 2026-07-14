-- CAIOS v4.5 validated story creation with atomic audit logging.
-- Apply to a non-production Supabase project first.

create or replace function public.create_story_with_audit(
  p_title text,
  p_desk text,
  p_priority public.story_priority default 'normal',
  p_summary text default null,
  p_body text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  story_id uuid;
begin
  if actor is null or not public.can_edit_newsroom() then
    raise exception 'not authorized to create stories';
  end if;

  p_title := btrim(p_title);
  p_desk := btrim(p_desk);
  p_summary := nullif(btrim(coalesce(p_summary, '')), '');
  p_body := nullif(btrim(coalesce(p_body, '')), '');

  if char_length(p_title) < 1 or char_length(p_title) > 300 then
    raise exception 'title must be between 1 and 300 characters';
  end if;

  if char_length(p_desk) < 1 or char_length(p_desk) > 80 then
    raise exception 'desk must be between 1 and 80 characters';
  end if;

  if p_summary is not null and char_length(p_summary) > 2000 then
    raise exception 'summary must not exceed 2000 characters';
  end if;

  if p_body is not null and char_length(p_body) > 100000 then
    raise exception 'body must not exceed 100000 characters';
  end if;

  insert into public.stories (
    title, desk, priority, status, summary, body,
    owner_id, created_by, updated_by
  ) values (
    p_title, p_desk, p_priority, 'discovered', p_summary, p_body,
    actor, actor, actor
  ) returning id into story_id;

  insert into public.audit_events (story_id, actor_id, event_type, event_data)
  values (
    story_id,
    actor,
    'story.created',
    jsonb_build_object(
      'title', p_title,
      'desk', p_desk,
      'priority', p_priority,
      'initial_status', 'discovered'
    )
  );

  return story_id;
end;
$$;

revoke all on function public.create_story_with_audit(text, text, public.story_priority, text, text) from public;
grant execute on function public.create_story_with_audit(text, text, public.story_priority, text, text) to authenticated;
