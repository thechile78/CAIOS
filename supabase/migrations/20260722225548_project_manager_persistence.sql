-- CAIOS Milestone 2.1: persisted, approval-aware Project Manager.
-- Project approval is intentionally limited to internal work. It never grants
-- publishing, scheduling, deployment, or other external-action authority.

create table public.project_work_items (
  id uuid primary key default gen_random_uuid(),
  work_key text not null unique check (work_key ~ '^PM-[0-9]{3,}$'),
  title text not null check (char_length(title) between 1 and 160),
  work_type text not null check (work_type in ('Editorial', 'Product', 'Revenue', 'Operations', 'Risk')),
  status text not null default 'Backlog'
    check (status in ('Backlog', 'Ready', 'In Progress', 'Founder Review', 'Approved', 'Blocked')),
  priority text not null default 'Medium'
    check (priority in ('Critical', 'High', 'Medium', 'Low')),
  owner_label text not null check (char_length(owner_label) between 1 and 120),
  due_label text not null check (char_length(due_label) between 1 and 120),
  impact text not null check (char_length(impact) between 1 and 1000),
  approval_required boolean not null default true check (approval_required = true),
  approver_label text not null default 'Founder'
    check (approver_label in ('The Chile', 'Founder', 'Editorial Lead')),
  approval_note text not null check (char_length(approval_note) between 1 and 1000),
  approval_scope text not null default 'internal_work' check (approval_scope = 'internal_work'),
  external_action_authorized boolean not null default false check (external_action_authorized = false),
  github_issue_url text check (github_issue_url is null or char_length(github_issue_url) <= 500),
  github_branch_name text check (github_branch_name is null or char_length(github_branch_name) <= 255),
  github_pull_request_url text check (github_pull_request_url is null or char_length(github_pull_request_url) <= 500),
  blockers text[] not null default '{}',
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_work_item_approval_state_consistent check (
    (status = 'Approved' and approved_by is not null and approved_at is not null)
    or (status <> 'Approved' and approved_by is null and approved_at is null)
  )
);

create table public.project_work_item_approvals (
  id uuid primary key default gen_random_uuid(),
  work_item_id uuid not null references public.project_work_items(id) on delete restrict,
  approver_id uuid not null references public.profiles(id),
  decision text not null check (decision in ('approved', 'changes_requested', 'rejected')),
  note text check (note is null or char_length(note) <= 4000),
  work_item_updated_at timestamptz not null,
  approval_scope text not null default 'internal_work' check (approval_scope = 'internal_work'),
  external_action_authorized boolean not null default false check (external_action_authorized = false),
  created_at timestamptz not null default now()
);

create index project_work_items_status_priority_idx
  on public.project_work_items (status, priority, updated_at desc);
create index project_work_items_created_by_idx on public.project_work_items (created_by);
create index project_work_items_updated_by_idx on public.project_work_items (updated_by);
create index project_work_items_approved_by_idx on public.project_work_items (approved_by);
create index project_work_item_approvals_item_created_idx
  on public.project_work_item_approvals (work_item_id, created_at desc);
create index project_work_item_approvals_approver_idx
  on public.project_work_item_approvals (approver_id);

alter table public.project_work_items enable row level security;
alter table public.project_work_item_approvals enable row level security;

revoke all on table public.project_work_items from anon, authenticated;
revoke all on table public.project_work_item_approvals from anon, authenticated;
grant select, insert, update on table public.project_work_items to authenticated;
grant select, insert on table public.project_work_item_approvals to authenticated;

create policy "authenticated newsroom reads project work items"
on public.project_work_items for select to authenticated
using ((select auth.uid()) is not null and public.current_app_role() is not null);

create policy "administrators create project work items"
on public.project_work_items for insert to authenticated
with check (
  public.current_app_role() = 'administrator'
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);

create policy "administrators update project work items"
on public.project_work_items for update to authenticated
using (public.current_app_role() = 'administrator')
with check (
  public.current_app_role() = 'administrator'
  and updated_by = (select auth.uid())
);

create policy "authenticated newsroom reads project approvals"
on public.project_work_item_approvals for select to authenticated
using ((select auth.uid()) is not null and public.current_app_role() is not null);

create policy "administrators append project approvals"
on public.project_work_item_approvals for insert to authenticated
with check (
  public.current_app_role() = 'administrator'
  and approver_id = (select auth.uid())
  and approval_scope = 'internal_work'
  and external_action_authorized = false
);

create or replace function public.set_project_work_item_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create trigger set_project_work_item_updated_at_trigger
before update on public.project_work_items
for each row execute function public.set_project_work_item_updated_at();

create or replace function public.enforce_project_work_item_approval_record()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.project_work_items item
    where item.id = new.work_item_id
      and item.status = 'Founder Review'
      and item.updated_at = new.work_item_updated_at
  ) then
    raise exception 'Project item changed or is not awaiting founder review';
  end if;
  return new;
end;
$$;

create trigger enforce_project_work_item_approval_record_trigger
before insert on public.project_work_item_approvals
for each row execute function public.enforce_project_work_item_approval_record();

create or replace function public.enforce_project_work_item_approved_state()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.status = 'Approved' and old.status is distinct from 'Approved' then
    if new.approved_by is null or new.approved_at is null then
      raise exception 'Approved project work requires a named human approval';
    end if;
    if not exists (
      select 1
      from public.project_work_item_approvals approval
      where approval.work_item_id = new.id
        and approval.approver_id = new.approved_by
        and approval.decision = 'approved'
        and approval.work_item_updated_at = old.updated_at
        and approval.approval_scope = 'internal_work'
        and approval.external_action_authorized = false
    ) then
      raise exception 'Matching append-only internal approval is required';
    end if;
  end if;
  return new;
end;
$$;

create trigger enforce_project_work_item_approved_state_trigger
before update of status, approved_by, approved_at on public.project_work_items
for each row execute function public.enforce_project_work_item_approved_state();

create or replace function public.create_project_work_item(
  p_work_key text,
  p_title text,
  p_work_type text,
  p_priority text,
  p_owner_label text,
  p_due_label text,
  p_impact text,
  p_approver_label text,
  p_approval_note text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_id uuid;
begin
  if v_actor is null or public.current_app_role() <> 'administrator' then
    raise exception 'Not authorized to create project work items';
  end if;

  insert into public.project_work_items (
    work_key, title, work_type, priority, owner_label, due_label, impact,
    approver_label, approval_note, created_by, updated_by
  ) values (
    upper(btrim(p_work_key)), btrim(p_title), p_work_type, p_priority,
    btrim(p_owner_label), btrim(p_due_label), btrim(p_impact),
    p_approver_label, btrim(p_approval_note), v_actor, v_actor
  ) returning id into v_id;

  insert into public.audit_events (actor_id, event_type, event_data)
  values (v_actor, 'project_work_item_created', jsonb_build_object(
    'work_item_id', v_id,
    'work_key', upper(btrim(p_work_key)),
    'status', 'Backlog',
    'approval_scope', 'internal_work',
    'external_action_authorized', false
  ));

  return v_id;
end;
$$;

create or replace function public.update_project_work_item_status(
  p_work_item_id uuid,
  p_expected_updated_at timestamptz,
  p_status text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null or public.current_app_role() <> 'administrator' then
    raise exception 'Not authorized to update project work items';
  end if;
  if p_status not in ('Backlog', 'Ready', 'In Progress', 'Founder Review', 'Blocked') then
    raise exception 'Approved status requires the explicit decision workflow';
  end if;

  update public.project_work_items
  set status = p_status, approved_by = null, approved_at = null, updated_by = v_actor
  where id = p_work_item_id and updated_at = p_expected_updated_at;

  if not found then
    raise exception 'Project work item changed before the update';
  end if;

  insert into public.audit_events (actor_id, event_type, event_data)
  values (v_actor, 'project_work_item_status_changed', jsonb_build_object(
    'work_item_id', p_work_item_id,
    'status', p_status,
    'approval_scope', 'internal_work',
    'external_action_authorized', false
  ));
end;
$$;

create or replace function public.record_project_work_item_decision(
  p_work_item_id uuid,
  p_expected_updated_at timestamptz,
  p_decision text,
  p_note text default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_now timestamptz := clock_timestamp();
begin
  if v_actor is null or public.current_app_role() <> 'administrator' then
    raise exception 'Not authorized to decide project work items';
  end if;
  if p_decision not in ('approved', 'changes_requested', 'rejected') then
    raise exception 'Invalid project work item decision';
  end if;
  if char_length(coalesce(p_note, '')) > 4000 then
    raise exception 'Decision note is too long';
  end if;

  perform 1 from public.project_work_items
  where id = p_work_item_id
    and updated_at = p_expected_updated_at
    and status = 'Founder Review'
  for update;

  if not found then
    raise exception 'Project work item changed or is not awaiting founder review';
  end if;

  insert into public.project_work_item_approvals (
    work_item_id, approver_id, decision, note, work_item_updated_at
  ) values (
    p_work_item_id, v_actor, p_decision,
    nullif(btrim(coalesce(p_note, '')), ''), p_expected_updated_at
  );

  update public.project_work_items
  set status = case p_decision
        when 'approved' then 'Approved'
        when 'changes_requested' then 'Ready'
        else 'Blocked'
      end,
      approved_by = case when p_decision = 'approved' then v_actor else null end,
      approved_at = case when p_decision = 'approved' then v_now else null end,
      updated_by = v_actor
  where id = p_work_item_id;

  insert into public.audit_events (actor_id, event_type, event_data)
  values (v_actor, 'project_work_item_human_decision_recorded', jsonb_build_object(
    'work_item_id', p_work_item_id,
    'decision', p_decision,
    'approval_scope', 'internal_work',
    'external_action_authorized', false
  ));
end;
$$;

revoke all on function public.set_project_work_item_updated_at() from public, anon;
revoke all on function public.enforce_project_work_item_approval_record() from public, anon;
revoke all on function public.enforce_project_work_item_approved_state() from public, anon;
revoke all on function public.create_project_work_item(text, text, text, text, text, text, text, text, text) from public, anon;
revoke all on function public.update_project_work_item_status(uuid, timestamptz, text) from public, anon;
revoke all on function public.record_project_work_item_decision(uuid, timestamptz, text, text) from public, anon;
grant execute on function public.create_project_work_item(text, text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.update_project_work_item_status(uuid, timestamptz, text) to authenticated;
grant execute on function public.record_project_work_item_decision(uuid, timestamptz, text, text) to authenticated;

-- Preserve the Milestone 2 board as persisted starter work. No seeded item is
-- treated as approved; a real administrator must record the human decision.
insert into public.project_work_items (
  work_key, title, work_type, status, priority, owner_label, due_label, impact,
  approver_label, approval_note, github_branch_name, blockers
) values
  ('PM-101', 'Approval Queue hardening', 'Risk', 'In Progress', 'Critical',
   'Newsroom Engineering', 'This sprint',
   'Protects the human approval boundary before any WordPress or social handoff.',
   'The Chile', 'Cannot ship to public channels until The Chile signs off.',
   'placeholder/approval-queue-hardening', array['Founder review pending']),
  ('PM-112', 'GA4 and Search Console readiness', 'Operations', 'Ready', 'High',
   'Founder', 'Next setup block',
   'Prepares audience signal reporting without changing publishing permissions.',
   'Founder', 'Credentials stay server-side and must be reviewed before connection.',
   null, '{}'),
  ('PM-124', 'Sponsorship package tracker', 'Revenue', 'Backlog', 'Medium',
   'Founder', 'Post-launch prep',
   'Tracks revenue operations before external commitments are made.',
   'Founder', 'Founder approval required before sponsor-facing language is used.',
   null, array['Awaiting offer list']),
  ('PM-137', 'WordPress draft QA checklist', 'Editorial', 'Founder Review', 'Critical',
   'The Chile', 'Before dispatch expansion',
   'Keeps drafts review-only and documents source, fact, SEO, accessibility, and image-rights checks.',
   'The Chile', 'Approval gate remains closed until every checklist item is verified.',
   'placeholder/wp-draft-qa-checklist', array['The Chile approval required']),
  ('PM-143', 'Mobile command-center polish', 'Product', 'Ready', 'Low',
   'Design Ops', 'Queued',
   'Improves founder dashboard accessibility and small-screen review comfort.',
   'Founder', 'Requires a recorded administrator approval for internal UI work only.',
   'placeholder/mobile-command-center-polish', '{}')
on conflict (work_key) do nothing;

comment on table public.project_work_items is
  'Internal Project Manager records. Approval never authorizes publishing or external actions.';
