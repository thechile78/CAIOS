-- CAIOS Social Hub: private Meta drafts and explicit human approval.
-- This migration intentionally creates no scheduling or publishing tables, jobs, or functions.

create table public.social_content_drafts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 160),
  facebook_caption text check (facebook_caption is null or char_length(facebook_caption) <= 5000),
  instagram_caption text check (instagram_caption is null or char_length(instagram_caption) <= 2200),
  facebook_page_id text not null default '1214069685123391'
    check (facebook_page_id = '1214069685123391'),
  instagram_account_id text not null default '17841403279084160'
    check (instagram_account_id = '17841403279084160'),
  status text not null default 'draft'
    check (status in ('draft', 'ready_for_review', 'changes_requested', 'approved', 'rejected')),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  publishing_enabled boolean not null default false check (publishing_enabled = false),
  scheduling_enabled boolean not null default false check (scheduling_enabled = false),
  auto_post_enabled boolean not null default false check (auto_post_enabled = false),
  auto_approval_enabled boolean not null default false check (auto_approval_enabled = false),
  approval_required boolean not null default true check (approval_required = true),
  constraint social_draft_has_caption check (
    nullif(btrim(coalesce(facebook_caption, '')), '') is not null
    or nullif(btrim(coalesce(instagram_caption, '')), '') is not null
  ),
  constraint social_approval_state_is_consistent check (
    (status = 'approved' and approved_by is not null and approved_at is not null)
    or (status <> 'approved' and approved_by is null and approved_at is null)
  )
);

create table public.social_content_approvals (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.social_content_drafts(id) on delete restrict,
  approver_id uuid not null references public.profiles(id),
  decision text not null check (decision in ('approved', 'changes_requested', 'rejected')),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  note text check (note is null or char_length(note) <= 4000),
  created_at timestamptz not null default now()
);

create index social_content_drafts_status_updated_idx
  on public.social_content_drafts (status, updated_at desc);
create index social_content_drafts_created_by_idx
  on public.social_content_drafts (created_by);
create index social_content_approvals_content_created_idx
  on public.social_content_approvals (content_item_id, created_at desc);
create index social_content_approvals_approver_idx
  on public.social_content_approvals (approver_id);

alter table public.social_content_drafts enable row level security;
alter table public.social_content_approvals enable row level security;

revoke all on table public.social_content_drafts from anon, authenticated;
revoke all on table public.social_content_approvals from anon, authenticated;
grant select on table public.social_content_drafts to authenticated;
grant select on table public.social_content_approvals to authenticated;

create policy "authenticated newsroom reads social drafts"
on public.social_content_drafts for select to authenticated
using ((select auth.uid()) is not null and public.current_app_role() is not null);

create policy "authenticated newsroom reads social approvals"
on public.social_content_approvals for select to authenticated
using ((select auth.uid()) is not null and public.current_app_role() is not null);

create or replace function public.create_social_content_draft(
  p_title text,
  p_facebook_caption text,
  p_instagram_caption text
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor uuid := auth.uid();
  v_title text := btrim(coalesce(p_title, ''));
  v_facebook text := nullif(btrim(coalesce(p_facebook_caption, '')), '');
  v_instagram text := nullif(btrim(coalesce(p_instagram_caption, '')), '');
  v_hash text;
  v_id uuid;
begin
  if v_actor is null or public.current_app_role() not in ('administrator', 'editor', 'producer', 'researcher') then
    raise exception 'Not authorized to create social drafts';
  end if;
  if char_length(v_title) not between 1 and 160 then
    raise exception 'Title must be between 1 and 160 characters';
  end if;
  if v_facebook is null and v_instagram is null then
    raise exception 'At least one caption is required';
  end if;
  if char_length(coalesce(v_facebook, '')) > 5000 or char_length(coalesce(v_instagram, '')) > 2200 then
    raise exception 'Caption exceeds the platform limit';
  end if;

  v_hash := encode(extensions.digest(
    v_title || E'\n' || coalesce(v_facebook, '') || E'\n' || coalesce(v_instagram, ''),
    'sha256'
  ), 'hex');

  insert into public.social_content_drafts (
    title, facebook_caption, instagram_caption, content_hash, created_by, updated_by
  ) values (
    v_title, v_facebook, v_instagram, v_hash, v_actor, v_actor
  ) returning id into v_id;

  insert into public.audit_events (actor_id, event_type, event_data)
  values (v_actor, 'social_draft_created', jsonb_build_object(
    'content_item_id', v_id,
    'facebook_page_id', '1214069685123391',
    'instagram_account_id', '17841403279084160',
    'status', 'draft',
    'publishing_enabled', false,
    'scheduling_enabled', false,
    'approval_required', true
  ));

  return v_id;
end;
$$;

create or replace function public.submit_social_content_for_review(
  p_content_item_id uuid,
  p_expected_updated_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_updated_at timestamptz := clock_timestamp();
begin
  if v_actor is null or public.current_app_role() not in ('administrator', 'editor', 'producer', 'researcher') then
    raise exception 'Not authorized to submit social drafts';
  end if;

  update public.social_content_drafts
  set status = 'ready_for_review', updated_by = v_actor, updated_at = v_updated_at
  where id = p_content_item_id
    and updated_at = p_expected_updated_at
    and status in ('draft', 'changes_requested');

  if not found then
    raise exception 'Draft changed or is not eligible for review';
  end if;

  insert into public.audit_events (actor_id, event_type, event_data)
  values (v_actor, 'social_draft_submitted_for_review', jsonb_build_object(
    'content_item_id', p_content_item_id,
    'status', 'ready_for_review',
    'publishing_enabled', false,
    'scheduling_enabled', false
  ));
end;
$$;

create or replace function public.record_social_content_decision(
  p_content_item_id uuid,
  p_expected_updated_at timestamptz,
  p_decision text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_hash text;
  v_updated_at timestamptz := clock_timestamp();
begin
  if v_actor is null or public.current_app_role() not in ('administrator', 'editor', 'reviewer') then
    raise exception 'Not authorized to decide social drafts';
  end if;
  if p_decision not in ('approved', 'changes_requested', 'rejected') then
    raise exception 'Invalid social draft decision';
  end if;
  if char_length(coalesce(p_note, '')) > 4000 then
    raise exception 'Review note is too long';
  end if;

  select content_hash into v_hash
  from public.social_content_drafts
  where id = p_content_item_id
    and updated_at = p_expected_updated_at
    and status = 'ready_for_review'
  for update;

  if v_hash is null then
    raise exception 'Draft changed or is not awaiting review';
  end if;

  insert into public.social_content_approvals (
    content_item_id, approver_id, decision, content_hash, note
  ) values (
    p_content_item_id, v_actor, p_decision, v_hash, nullif(btrim(coalesce(p_note, '')), '')
  );

  update public.social_content_drafts
  set status = p_decision,
      approved_by = case when p_decision = 'approved' then v_actor else null end,
      approved_at = case when p_decision = 'approved' then v_updated_at else null end,
      updated_by = v_actor,
      updated_at = v_updated_at
  where id = p_content_item_id;

  insert into public.audit_events (actor_id, event_type, event_data)
  values (v_actor, 'social_draft_human_decision_recorded', jsonb_build_object(
    'content_item_id', p_content_item_id,
    'decision', p_decision,
    'content_hash', v_hash,
    'publishing_enabled', false,
    'scheduling_enabled', false,
    'approval_required', true
  ));
end;
$$;

revoke all on function public.create_social_content_draft(text, text, text) from public, anon;
revoke all on function public.submit_social_content_for_review(uuid, timestamptz) from public, anon;
revoke all on function public.record_social_content_decision(uuid, timestamptz, text, text) from public, anon;
grant execute on function public.create_social_content_draft(text, text, text) to authenticated;
grant execute on function public.submit_social_content_for_review(uuid, timestamptz) to authenticated;
grant execute on function public.record_social_content_decision(uuid, timestamptz, text, text) to authenticated;

comment on table public.social_content_drafts is
  'Private approval workflow only. No publishing or scheduling capability is present.';
