-- CAIOS v5.2 image rights gate
-- An approved image-rights record is required before story approval.

create table public.story_image_rights (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete restrict,
  image_url text not null check (image_url ~ '^https://'),
  source_page_url text not null check (source_page_url ~ '^https://'),
  source_type text not null check (source_type in (
    'openverse',
    'wordpress_photo_directory',
    'official_press',
    'owned',
    'branded_fallback'
  )),
  creator text not null check (char_length(creator) between 1 and 300),
  license_name text not null check (char_length(license_name) between 1 and 200),
  license_url text check (license_url is null or license_url ~ '^https://'),
  attribution_text text not null check (char_length(attribution_text) between 1 and 1000),
  alt_text text not null check (char_length(alt_text) between 1 and 500),
  commercial_use_allowed boolean not null,
  modifications_allowed boolean not null,
  retrieved_at timestamptz not null,
  approved_by uuid not null references public.profiles(id),
  approved_at timestamptz not null,
  active boolean not null default true,
  replaced_at timestamptz,
  created_at timestamptz not null default now(),
  constraint image_rights_active_approval check (
    (active and replaced_at is null)
    or (not active and replaced_at is not null)
  )
);

create unique index one_active_image_rights_record_per_story
on public.story_image_rights (story_id)
where active;

create index story_image_rights_approved_by_idx
on public.story_image_rights (approved_by);

alter table public.story_image_rights enable row level security;

create policy "authenticated users read image rights"
on public.story_image_rights for select to authenticated
using (true);

create or replace function public.record_story_image_approval(
  p_story_id uuid,
  p_image_url text,
  p_source_page_url text,
  p_source_type text,
  p_creator text,
  p_license_name text,
  p_license_url text,
  p_attribution_text text,
  p_alt_text text,
  p_commercial_use_allowed boolean,
  p_modifications_allowed boolean,
  p_retrieved_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_story public.stories%rowtype;
  v_image_id uuid;
  v_now timestamptz := clock_timestamp();
begin
  if v_actor is null then raise exception 'authentication required'; end if;
  if not public.can_review_newsroom() then raise exception 'reviewer role required'; end if;

  select * into v_story from public.stories where id = p_story_id for update;
  if not found then raise exception 'story not found'; end if;
  if v_story.status in ('approved', 'wordpress_draft', 'published', 'archived') then
    raise exception 'image rights are locked for an approved story';
  end if;

  if coalesce(p_image_url, '') !~ '^https://' or coalesce(p_source_page_url, '') !~ '^https://' then
    raise exception 'image and source page must use https';
  end if;
  if p_license_url is not null and p_license_url !~ '^https://' then
    raise exception 'license URL must use https';
  end if;
  if p_source_type not in ('openverse', 'wordpress_photo_directory', 'official_press', 'owned', 'branded_fallback') then
    raise exception 'image source type is not approved';
  end if;
  if not coalesce(p_commercial_use_allowed, false) then
    raise exception 'commercial website use must be explicitly allowed';
  end if;
  if nullif(btrim(coalesce(p_creator, '')), '') is null
    or nullif(btrim(coalesce(p_license_name, '')), '') is null
    or nullif(btrim(coalesce(p_attribution_text, '')), '') is null
    or nullif(btrim(coalesce(p_alt_text, '')), '') is null then
    raise exception 'complete image rights evidence is required';
  end if;
  if p_source_type in ('openverse', 'wordpress_photo_directory')
    and lower(btrim(p_license_name)) not in ('cc0', 'cc0 1.0', 'public domain') then
    raise exception 'automated image choices must use a CC0 or public-domain license';
  end if;

  update public.story_image_rights
  set active = false, replaced_at = v_now
  where story_id = p_story_id and active;

  insert into public.story_image_rights (
    story_id, image_url, source_page_url, source_type, creator,
    license_name, license_url, attribution_text, alt_text,
    commercial_use_allowed, modifications_allowed, retrieved_at,
    approved_by, approved_at
  ) values (
    p_story_id, btrim(p_image_url), btrim(p_source_page_url), p_source_type, btrim(p_creator),
    btrim(p_license_name), nullif(btrim(coalesce(p_license_url, '')), ''),
    btrim(p_attribution_text), btrim(p_alt_text),
    p_commercial_use_allowed, p_modifications_allowed, p_retrieved_at,
    v_actor, v_now
  ) returning id into v_image_id;

  insert into public.audit_events (story_id, actor_id, event_type, event_data)
  values (
    p_story_id,
    v_actor,
    'story_image_rights_approved',
    jsonb_build_object(
      'image_rights_id', v_image_id,
      'source_type', p_source_type,
      'source_page_url', p_source_page_url,
      'license_name', p_license_name,
      'commercial_use_allowed', p_commercial_use_allowed,
      'modifications_allowed', p_modifications_allowed,
      'retrieved_at', p_retrieved_at
    )
  );

  return v_image_id;
end;
$$;

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
  if public.current_app_role() not in ('administrator','editor','producer','researcher','reviewer') then
    raise exception 'insufficient role';
  end if;

  select * into v_story from public.stories where id = p_story_id for update;
  if not found then raise exception 'story not found'; end if;
  if v_story.updated_at is distinct from p_expected_updated_at then raise exception 'stale story version'; end if;
  if v_story.status in ('approved', 'wordpress_draft', 'published', 'archived') then
    raise exception 'checklist is locked for this story state';
  end if;
  if p_rights_reviewed and not exists (
    select 1 from public.story_image_rights
    where story_id = p_story_id and active and commercial_use_allowed
  ) then
    raise exception 'image rights checklist requires an approved image or branded fallback';
  end if;

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

  insert into public.audit_events (story_id, actor_id, event_type, event_data)
  values (p_story_id, v_actor, 'editorial_checklist_saved',
    jsonb_build_object(
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

  if p_decision = 'approved' and not exists (
    select 1 from public.story_image_rights
    where story_id = p_story_id and active and commercial_use_allowed
  ) then raise exception 'approval requires an approved image or branded fallback'; end if;

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

revoke all on table public.story_image_rights from public, anon;
revoke all on function public.record_story_image_approval(
  uuid,text,text,text,text,text,text,text,text,boolean,boolean,timestamptz
) from public, anon;
revoke all on function public.save_editorial_checklist(
  uuid,timestamptz,boolean,boolean,boolean,boolean
) from public, anon;
revoke all on function public.record_editorial_decision(
  uuid,timestamptz,text,text
) from public, anon;

grant select on table public.story_image_rights to authenticated;
grant execute on function public.record_story_image_approval(
  uuid,text,text,text,text,text,text,text,text,boolean,boolean,timestamptz
) to authenticated;
grant execute on function public.save_editorial_checklist(
  uuid,timestamptz,boolean,boolean,boolean,boolean
) to authenticated;
grant execute on function public.record_editorial_decision(
  uuid,timestamptz,text,text
) to authenticated;
