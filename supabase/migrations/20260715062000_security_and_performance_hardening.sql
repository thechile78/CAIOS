-- CAIOS staging security and performance hardening
-- Keeps privileged helpers out of the exposed API schema, removes anonymous
-- execution paths, optimizes RLS evaluation, and adds covering FK indexes.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and active = true;
$$;
revoke all on function private.current_app_role() from public, anon;
grant execute on function private.current_app_role() to authenticated;

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security invoker
set search_path = public, private
as $$ select private.current_app_role(); $$;

create or replace function public.can_edit_newsroom()
returns boolean
language sql
stable
security invoker
set search_path = public, private
as $$
  select coalesce(private.current_app_role() in ('administrator','editor','producer','researcher'), false);
$$;

create or replace function public.can_review_newsroom()
returns boolean
language sql
stable
security invoker
set search_path = public, private
as $$
  select coalesce(private.current_app_role() in ('administrator','editor','reviewer'), false);
$$;

revoke all on function public.current_app_role() from public, anon;
revoke all on function public.can_edit_newsroom() from public, anon;
revoke all on function public.can_review_newsroom() from public, anon;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.can_edit_newsroom() to authenticated;
grant execute on function public.can_review_newsroom() to authenticated;

alter function public.save_editorial_checklist(uuid,timestamptz,boolean,boolean,boolean,boolean) security invoker;
alter function public.record_editorial_decision(uuid,timestamptz,text,text) security invoker;
revoke all on function public.save_editorial_checklist(uuid,timestamptz,boolean,boolean,boolean,boolean) from public, anon;
revoke all on function public.record_editorial_decision(uuid,timestamptz,text,text) from public, anon;
grant execute on function public.save_editorial_checklist(uuid,timestamptz,boolean,boolean,boolean,boolean) to authenticated;
grant execute on function public.record_editorial_decision(uuid,timestamptz,text,text) to authenticated;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', new.email));
  return new;
end;
$$;
revoke all on function private.handle_new_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();
drop function if exists public.handle_new_user();

-- Split overlapping permissive policies.
drop policy if exists "administrators manage profiles" on public.profiles;
create policy "administrators insert profiles"
on public.profiles for insert to authenticated
with check (public.current_app_role() = 'administrator');
create policy "administrators update profiles"
on public.profiles for update to authenticated
using (public.current_app_role() = 'administrator')
with check (public.current_app_role() = 'administrator');
create policy "administrators delete profiles"
on public.profiles for delete to authenticated
using (public.current_app_role() = 'administrator');

drop policy if exists "newsroom editors manage sources" on public.story_sources;
create policy "newsroom editors insert sources"
on public.story_sources for insert to authenticated
with check (public.can_edit_newsroom() and created_by = (select auth.uid()));
create policy "newsroom editors update sources"
on public.story_sources for update to authenticated
using (public.can_edit_newsroom())
with check (public.can_edit_newsroom() and created_by = (select auth.uid()));
create policy "newsroom editors delete sources"
on public.story_sources for delete to authenticated
using (public.can_edit_newsroom());

-- Cache auth.uid() once per statement in RLS policies.
drop policy if exists "newsroom editors create stories" on public.stories;
create policy "newsroom editors create stories"
on public.stories for insert to authenticated
with check (public.can_edit_newsroom() and created_by = (select auth.uid()) and updated_by = (select auth.uid()));

drop policy if exists "newsroom editors update stories" on public.stories;
create policy "newsroom editors update stories"
on public.stories for update to authenticated
using (public.can_edit_newsroom())
with check (public.can_edit_newsroom() and updated_by = (select auth.uid()));

drop policy if exists "reviewers append approvals" on public.approvals;
create policy "reviewers append approvals"
on public.approvals for insert to authenticated
with check (public.can_review_newsroom() and approved_by = (select auth.uid()));

drop policy if exists "authenticated users append own audit events" on public.audit_events;
create policy "authenticated users append own audit events"
on public.audit_events for insert to authenticated
with check (actor_id = (select auth.uid()));

drop policy if exists "newsroom staff create checklists" on public.editorial_checklists;
create policy "newsroom staff create checklists"
on public.editorial_checklists for insert to authenticated
with check ((public.can_edit_newsroom() or public.can_review_newsroom()) and updated_by = (select auth.uid()));

drop policy if exists "newsroom staff update checklists" on public.editorial_checklists;
create policy "newsroom staff update checklists"
on public.editorial_checklists for update to authenticated
using (public.can_edit_newsroom() or public.can_review_newsroom())
with check ((public.can_edit_newsroom() or public.can_review_newsroom()) and updated_by = (select auth.uid()));

drop policy if exists "authorized newsroom roles insert editorial handoffs" on public.editorial_handoffs;
create policy "authorized newsroom roles insert editorial handoffs"
on public.editorial_handoffs for insert to authenticated
with check (public.current_app_role() in ('administrator','editor','producer') and requested_by = (select auth.uid()) and updated_by = (select auth.uid()));

drop policy if exists "approved editors request publication records" on public.publication_records;
create policy "approved editors request publication records"
on public.publication_records for insert to authenticated
with check (
  public.current_app_role() in ('administrator','editor')
  and requested_by = (select auth.uid())
  and approved_by is not null
  and exists (
    select 1 from public.stories s
    join public.editorial_checklists c on c.story_id = s.id
    where s.id = story_id
      and s.status in ('approved','wordpress_draft','published')
      and c.sources_verified and c.facts_verified and c.rights_reviewed and c.seo_reviewed and c.human_approved
  )
);

-- Cover foreign keys used by joins, deletes, and audit lookups.
create index if not exists approvals_approved_by_idx on public.approvals(approved_by);
create index if not exists approvals_story_id_idx on public.approvals(story_id);
create index if not exists audit_events_actor_id_idx on public.audit_events(actor_id);
create index if not exists audit_events_story_id_idx on public.audit_events(story_id);
create index if not exists editorial_checklists_updated_by_idx on public.editorial_checklists(updated_by);
create index if not exists editorial_handoffs_requested_by_idx on public.editorial_handoffs(requested_by);
create index if not exists editorial_handoffs_updated_by_idx on public.editorial_handoffs(updated_by);
create index if not exists editorial_packages_created_by_idx on public.editorial_packages(created_by);
create index if not exists editorial_packages_story_id_idx on public.editorial_packages(story_id);
create index if not exists publication_records_approved_by_idx on public.publication_records(approved_by);
create index if not exists publication_records_requested_by_idx on public.publication_records(requested_by);
create index if not exists publication_records_story_id_idx on public.publication_records(story_id);
create index if not exists stories_approved_by_idx on public.stories(approved_by);
create index if not exists stories_created_by_idx on public.stories(created_by);
create index if not exists stories_owner_id_idx on public.stories(owner_id);
create index if not exists stories_updated_by_idx on public.stories(updated_by);
create index if not exists story_sources_created_by_idx on public.story_sources(created_by);
create index if not exists story_sources_verified_by_idx on public.story_sources(verified_by);
create index if not exists wordpress_draft_outbox_requested_by_idx on public.wordpress_draft_outbox(requested_by);
create index if not exists wordpress_draft_outbox_story_id_idx on public.wordpress_draft_outbox(story_id);
