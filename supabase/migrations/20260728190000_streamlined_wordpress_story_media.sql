-- Streamlined CAIOS review submission with WordPress-ready media fields.

alter table public.stories
  add column if not exists social_embed_url text,
  add column if not exists image_url text;

alter table public.stories
  drop constraint if exists stories_social_embed_url_http,
  add constraint stories_social_embed_url_http
    check (social_embed_url is null or social_embed_url ~ '^https://'),
  drop constraint if exists stories_image_url_http,
  add constraint stories_image_url_http
    check (image_url is null or image_url ~ '^https://');

create or replace function public.submit_story_for_approval(
  p_story_id uuid,
  p_expected_updated_at timestamptz,
  p_title text,
  p_desk text,
  p_priority public.story_priority,
  p_summary text,
  p_body text,
  p_social_embed_url text,
  p_image_url text,
  p_sources_verified boolean,
  p_facts_verified boolean,
  p_rights_reviewed boolean,
  p_seo_reviewed boolean
)
returns timestamptz
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_story public.stories%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if v_actor is null or not public.can_edit_newsroom() then
    raise exception 'not authorized';
  end if;

  select * into v_story from public.stories where id = p_story_id for update;
  if not found then raise exception 'story not found'; end if;
  if v_story.updated_at is distinct from p_expected_updated_at then
    raise exception 'story changed by another user';
  end if;
  if v_story.status in ('approved', 'wordpress_draft', 'published', 'archived') then
    raise exception 'locked story status';
  end if;
  if char_length(trim(p_title)) not between 8 and 220 then raise exception 'invalid title'; end if;
  if char_length(trim(p_desk)) not between 1 and 80 then raise exception 'invalid desk'; end if;
  if p_social_embed_url is not null and p_social_embed_url !~ '^https://' then
    raise exception 'invalid social embed url';
  end if;
  if p_image_url is not null and p_image_url !~ '^https://' then
    raise exception 'invalid image url';
  end if;
  if not (p_sources_verified and p_facts_verified and p_rights_reviewed and p_seo_reviewed) then
    raise exception 'editorial checklist is incomplete';
  end if;

  update public.stories
  set title = trim(p_title),
      desk = trim(p_desk),
      priority = p_priority,
      summary = nullif(trim(coalesce(p_summary, '')), ''),
      body = nullif(p_body, ''),
      social_embed_url = nullif(trim(coalesce(p_social_embed_url, '')), ''),
      image_url = nullif(trim(coalesce(p_image_url, '')), ''),
      status = 'awaiting_approval',
      updated_by = v_actor,
      updated_at = v_now
  where id = p_story_id;

  insert into public.editorial_checklists (
    story_id, sources_verified, facts_verified, rights_reviewed,
    seo_reviewed, human_approved, updated_by, updated_at
  ) values (
    p_story_id, true, true, true, true, false, v_actor, v_now
  )
  on conflict (story_id) do update set
    sources_verified = true,
    facts_verified = true,
    rights_reviewed = true,
    seo_reviewed = true,
    human_approved = false,
    updated_by = v_actor,
    updated_at = v_now;

  insert into public.audit_events (story_id, actor_id, event_type, event_data)
  values (
    p_story_id,
    v_actor,
    'story_submitted_for_approval',
    jsonb_build_object(
      'from_status', v_story.status,
      'has_social_embed', nullif(trim(coalesce(p_social_embed_url, '')), '') is not null,
      'has_image', nullif(trim(coalesce(p_image_url, '')), '') is not null
    )
  );

  return v_now;
end;
$$;

revoke all on function public.submit_story_for_approval(
  uuid,timestamptz,text,text,public.story_priority,text,text,text,text,
  boolean,boolean,boolean,boolean
) from public, anon;
grant execute on function public.submit_story_for_approval(
  uuid,timestamptz,text,text,public.story_priority,text,text,text,text,
  boolean,boolean,boolean,boolean
) to authenticated;
