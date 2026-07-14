-- CAIOS v4.2 approval-boundary hardening
-- Apply after the foundation migration.

create or replace function public.enforce_story_approval_boundary()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status in ('approved', 'wordpress_draft', 'published') then
    if new.approved_by is null or new.approved_at is null then
      raise exception 'Approved states require named approval';
    end if;

    if not exists (
      select 1
      from public.editorial_checklists c
      where c.story_id = new.id
        and c.sources_verified
        and c.facts_verified
        and c.rights_reviewed
        and c.seo_reviewed
        and c.human_approved
    ) then
      raise exception 'Editorial checklist is incomplete';
    end if;

    if not exists (
      select 1
      from public.approvals a
      join public.profiles p on p.id = a.approved_by
      where a.story_id = new.id
        and a.decision = 'approved'
        and a.approved_by = new.approved_by
        and a.created_at <= new.approved_at
        and p.active = true
        and p.role in ('administrator', 'editor', 'reviewer')
    ) then
      raise exception 'Authorized append-only approval is required';
    end if;
  end if;

  return new;
end;
$$;

create trigger enforce_story_approval_boundary_trigger
before insert or update of status, approved_by, approved_at
on public.stories
for each row execute function public.enforce_story_approval_boundary();

create or replace function public.enforce_publication_request_boundary()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.stories s
    join public.editorial_checklists c on c.story_id = s.id
    join public.approvals a
      on a.story_id = s.id
     and a.approved_by = s.approved_by
     and a.decision = 'approved'
    join public.profiles p
      on p.id = a.approved_by
     and p.active = true
     and p.role in ('administrator', 'editor', 'reviewer')
    where s.id = new.story_id
      and s.status in ('approved', 'wordpress_draft', 'published')
      and s.approved_by = new.approved_by
      and c.sources_verified
      and c.facts_verified
      and c.rights_reviewed
      and c.seo_reviewed
      and c.human_approved
  ) then
    raise exception 'Publication approval boundary failed';
  end if;

  return new;
end;
$$;

create trigger enforce_publication_request_boundary_trigger
before insert on public.publication_records
for each row execute function public.enforce_publication_request_boundary();

drop policy if exists "newsroom staff update checklists" on public.editorial_checklists;

create policy "newsroom staff create checklists"
on public.editorial_checklists for insert to authenticated
with check (
  (public.can_edit_newsroom() or public.can_review_newsroom())
  and updated_by = auth.uid()
);

create policy "newsroom staff update checklists"
on public.editorial_checklists for update to authenticated
using (public.can_edit_newsroom() or public.can_review_newsroom())
with check (
  (public.can_edit_newsroom() or public.can_review_newsroom())
  and updated_by = auth.uid()
);

-- No delete policy is defined for editorial_checklists, approvals, or audit_events.
