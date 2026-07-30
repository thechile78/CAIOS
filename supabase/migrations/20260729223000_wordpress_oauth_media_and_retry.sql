-- Store the WordPress posts+media authorization in the existing encrypted,
-- server-only vault and provide an audited human-triggered retry path.

alter table public.social_oauth_connections
  drop constraint if exists social_oauth_connections_provider_check,
  drop constraint if exists social_oauth_connections_safeguards_check,
  drop constraint if exists social_oauth_connections_wordpress_scopes_check;

alter table public.social_oauth_connections
  add constraint social_oauth_connections_provider_check
    check (provider in ('youtube', 'facebook', 'instagram', 'wordpress')),
  add constraint social_oauth_connections_safeguards_check
    check (
      approval_required = true
      and scheduling_enabled = false
      and auto_post_enabled = false
      and auto_approval_enabled = false
      and (
        (provider = 'wordpress' and publishing_enabled = true)
        or (provider <> 'wordpress' and publishing_enabled = false)
      )
    ),
  add constraint social_oauth_connections_wordpress_scopes_check
    check (
      provider <> 'wordpress'
      or scopes @> array['posts', 'media']::text[]
    );

revoke all on table public.social_oauth_connections from anon, authenticated;
grant select, insert, update on table public.social_oauth_connections to service_role;

create or replace function public.begin_wordpress_publication_retry(
  p_story_id uuid
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
begin
  if v_actor is null then raise exception 'authentication required'; end if;
  if public.current_app_role() not in ('administrator', 'editor', 'reviewer') then
    raise exception 'reviewer role required';
  end if;

  select * into v_story from public.stories where id = p_story_id for update;
  if not found then raise exception 'story not found'; end if;
  if v_story.status <> 'approved' then
    raise exception 'only an approved story can be retried';
  end if;
  if v_story.approved_by is null or not exists (
    select 1 from public.approvals
    where story_id = p_story_id and decision = 'approved'
  ) then
    raise exception 'recorded human approval is required';
  end if;

  select * into v_checklist
  from public.editorial_checklists
  where story_id = p_story_id;
  if not found or not (
    v_checklist.sources_verified and v_checklist.facts_verified and
    v_checklist.rights_reviewed and v_checklist.seo_reviewed and
    v_checklist.human_approved
  ) then
    raise exception 'approved editorial checklist is incomplete';
  end if;
  if not exists (
    select 1 from public.story_image_rights
    where story_id = p_story_id and active and commercial_use_allowed
  ) then
    raise exception 'approved image rights are required';
  end if;
  if exists (
    select 1 from public.publication_records
    where story_id = p_story_id and platform = 'wordpress'
      and state in ('requested', 'published')
  ) then
    raise exception 'WordPress publication is already pending or complete';
  end if;
  if not exists (
    select 1 from public.publication_records
    where story_id = p_story_id and platform = 'wordpress' and state = 'failed'
  ) then
    raise exception 'no failed WordPress publication exists';
  end if;

  insert into public.publication_records (
    story_id, platform, state, requested_by, approved_by, created_at, updated_at
  ) values (
    p_story_id, 'wordpress', 'requested', v_actor, v_actor, v_now, v_now
  ) returning id into v_record_id;

  insert into public.audit_events (story_id, actor_id, event_type, event_data)
  values (
    p_story_id, v_actor, 'wordpress_publication_retry_authorized',
    jsonb_build_object(
      'publication_record_id', v_record_id,
      'human_retry_click', true
    )
  );
  return v_record_id;
end;
$$;

revoke all on function public.begin_wordpress_publication_retry(uuid)
from public, anon;
grant execute on function public.begin_wordpress_publication_retry(uuid)
to authenticated;
