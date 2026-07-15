-- CAIOS v5.1 manual WordPress draft dispatch
-- Apply to a non-production Supabase project first.

alter type public.wordpress_draft_outbox_state add value if not exists 'processing';
alter type public.wordpress_draft_outbox_state add value if not exists 'sent';
alter type public.wordpress_draft_outbox_state add value if not exists 'failed';

alter table public.wordpress_draft_outbox
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists attempt_count integer not null default 0 check (attempt_count >= 0),
  add column if not exists lease_expires_at timestamptz,
  add column if not exists external_post_id text,
  add column if not exists external_post_url text,
  add column if not exists last_error text check (last_error is null or char_length(last_error) <= 2000),
  add column if not exists dispatched_at timestamptz;

create or replace function public.begin_wordpress_draft_dispatch(
  p_outbox_id uuid,
  p_expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_row public.wordpress_draft_outbox%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if v_actor is null then raise exception 'authentication required'; end if;
  if public.current_app_role() not in ('administrator', 'editor') then
    raise exception 'administrator or editor role required';
  end if;

  select * into v_row from public.wordpress_draft_outbox where id = p_outbox_id for update;
  if not found then raise exception 'outbox record not found'; end if;
  if v_row.updated_at is distinct from p_expected_updated_at then raise exception 'stale outbox version'; end if;
  if v_row.state not in ('queued', 'failed') then raise exception 'outbox record cannot be dispatched'; end if;
  if v_row.payload ->> 'status' <> 'draft' then raise exception 'draft status required'; end if;

  update public.wordpress_draft_outbox
  set state = 'processing', attempt_count = attempt_count + 1,
      lease_expires_at = v_now + interval '5 minutes', updated_at = v_now,
      last_error = null
  where id = p_outbox_id;

  insert into public.audit_events (story_id, actor_id, event_type, event_data)
  values (v_row.story_id, v_actor, 'wordpress_draft_dispatch_started',
    jsonb_build_object('outbox_id', v_row.id, 'attempt', v_row.attempt_count + 1));

  return jsonb_build_object('id', v_row.id, 'story_id', v_row.story_id, 'payload', v_row.payload, 'updated_at', v_now);
end;
$$;

grant execute on function public.begin_wordpress_draft_dispatch(uuid, timestamptz) to authenticated;

create or replace function public.finish_wordpress_draft_dispatch(
  p_outbox_id uuid,
  p_success boolean,
  p_external_post_id text default null,
  p_external_post_url text default null,
  p_error text default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_row public.wordpress_draft_outbox%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if v_actor is null then raise exception 'authentication required'; end if;
  if public.current_app_role() not in ('administrator', 'editor') then raise exception 'insufficient role'; end if;
  select * into v_row from public.wordpress_draft_outbox where id = p_outbox_id for update;
  if not found or v_row.state <> 'processing' then raise exception 'outbox record is not processing'; end if;

  if p_success then
    update public.wordpress_draft_outbox
    set state='sent', external_post_id=p_external_post_id, external_post_url=p_external_post_url,
        dispatched_at=v_now, lease_expires_at=null, updated_at=v_now, last_error=null
    where id=p_outbox_id;
  else
    update public.wordpress_draft_outbox
    set state='failed', last_error=left(coalesce(p_error, 'dispatch failed'), 2000),
        lease_expires_at=null, updated_at=v_now
    where id=p_outbox_id;
  end if;

  insert into public.audit_events (story_id, actor_id, event_type, event_data)
  values (v_row.story_id, v_actor,
    case when p_success then 'wordpress_draft_dispatch_succeeded' else 'wordpress_draft_dispatch_failed' end,
    jsonb_build_object('outbox_id', v_row.id, 'external_post_id', p_external_post_id, 'error', p_error));
end;
$$;

grant execute on function public.finish_wordpress_draft_dispatch(uuid, boolean, text, text, text) to authenticated;