-- CAIOS Media Studio -> Social Hub bridge.
--
-- This migration adds private review-package ingestion only. It intentionally
-- adds no publishing, scheduling, delivery, webhook, or platform-posting
-- capability. Upload authorization and social approval remain separate events.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'caios-media-review',
  'caios-media-review',
  false,
  67108864,
  array['video/mp4']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table public.media_packages (
  id uuid primary key default gen_random_uuid(),
  schema_version text not null default 'media-package.v1'
    check (schema_version = 'media-package.v1'),
  local_job_id text not null unique
    check (local_job_id ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$'),
  title text not null check (char_length(title) between 1 and 160),
  producer_package_hash text not null
    check (producer_package_hash ~ '^[0-9a-f]{64}$'),
  caption_file_hash text
    check (caption_file_hash is null or caption_file_hash ~ '^[0-9a-f]{64}$'),
  music_license_hash text
    check (music_license_hash is null or music_license_hash ~ '^[0-9a-f]{64}$'),
  rights_evidence_hash text
    check (rights_evidence_hash is null or rights_evidence_hash ~ '^[0-9a-f]{64}$'),
  rights_attested boolean not null default false,
  rights_note text check (rights_note is null or char_length(rights_note) <= 2000),
  qa_status text not null check (qa_status in ('verified', 'needs_review', 'failed')),
  status text not null default 'imported'
    check (status in (
      'imported', 'private_upload_authorized', 'uploading',
      'ready_for_review', 'changes_requested', 'approved', 'rejected'
    )),
  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.media_artifacts (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.media_packages(id) on delete restrict,
  artifact_key text not null
    check (artifact_key ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  platform_profile text not null
    check (platform_profile ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  bucket_id text not null default 'caios-media-review'
    check (bucket_id = 'caios-media-review'),
  object_path text not null unique
    check (
      object_path !~ '(^/|\.\.|://|[[:cntrl:]])'
      and object_path ~ '^packages/[0-9a-f-]{36}/[0-9a-f]{64}/[a-z0-9][a-z0-9_-]{0,63}\.mp4$'
    ),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  byte_size bigint not null check (byte_size between 1 and 67108864),
  mime_type text not null default 'video/mp4' check (mime_type = 'video/mp4'),
  width integer not null check (width between 1 and 7680),
  height integer not null check (height between 1 and 7680),
  duration_ms bigint not null check (duration_ms between 1 and 3600000),
  audio_choice text not null check (audio_choice in ('keep', 'mute')),
  qa_status text not null check (qa_status in ('verified', 'needs_review', 'failed')),
  upload_status text not null default 'pending'
    check (upload_status in ('pending', 'uploaded', 'verified', 'rejected')),
  created_at timestamptz not null default now(),
  unique (package_id, artifact_key),
  unique (package_id, platform_profile)
);

create table public.media_ingest_authorizations (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.media_packages(id) on delete restrict,
  package_hash text not null check (package_hash ~ '^[0-9a-f]{64}$'),
  purpose text not null default 'private_review'
    check (purpose = 'private_review'),
  object_plan jsonb not null check (jsonb_typeof(object_plan) = 'array'),
  nonce uuid not null default gen_random_uuid() unique,
  authorized_by uuid not null references public.profiles(id),
  authorized_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  check (expires_at > authorized_at),
  check (used_at is null or used_at >= authorized_at)
);

create table public.social_final_approvers (
  singleton boolean primary key default true check (singleton = true),
  user_id uuid not null unique references public.profiles(id) on delete restrict,
  bound_by uuid not null references public.profiles(id) on delete restrict,
  bound_at timestamptz not null default now(),
  active boolean not null default true
);

alter table public.social_content_drafts
  add column media_package_id uuid references public.media_packages(id) on delete restrict;

alter table public.social_content_approvals
  add column approval_payload jsonb;

create table public.social_draft_artifacts (
  social_draft_id uuid not null references public.social_content_drafts(id) on delete restrict,
  platform text not null check (platform in ('facebook', 'instagram')),
  artifact_id uuid not null references public.media_artifacts(id) on delete restrict,
  usage text not null default 'primary' check (usage = 'primary'),
  primary key (social_draft_id, platform, usage),
  unique (social_draft_id, artifact_id)
);

create index media_packages_status_updated_idx
  on public.media_packages (status, updated_at desc);
create index media_packages_created_by_idx
  on public.media_packages (created_by);
create index media_packages_updated_by_idx
  on public.media_packages (updated_by);
create index media_artifacts_package_idx
  on public.media_artifacts (package_id);
create index media_ingest_authorizations_package_idx
  on public.media_ingest_authorizations (package_id, expires_at desc);
create index media_ingest_authorizations_authorized_by_idx
  on public.media_ingest_authorizations (authorized_by);
create index social_content_drafts_media_package_idx
  on public.social_content_drafts (media_package_id)
  where media_package_id is not null;
create index social_draft_artifacts_artifact_idx
  on public.social_draft_artifacts (artifact_id);
create unique index social_content_drafts_one_active_media_package_idx
  on public.social_content_drafts (media_package_id)
  where media_package_id is not null
    and status in ('draft', 'ready_for_review', 'changes_requested');

alter table public.media_packages enable row level security;
alter table public.media_packages force row level security;
alter table public.media_artifacts enable row level security;
alter table public.media_artifacts force row level security;
alter table public.media_ingest_authorizations enable row level security;
alter table public.media_ingest_authorizations force row level security;
alter table public.social_draft_artifacts enable row level security;
alter table public.social_draft_artifacts force row level security;
alter table public.social_final_approvers enable row level security;
alter table public.social_final_approvers force row level security;

revoke all on table public.media_packages from anon, authenticated;
revoke all on table public.media_artifacts from anon, authenticated;
revoke all on table public.media_ingest_authorizations from anon, authenticated;
revoke all on table public.social_draft_artifacts from anon, authenticated;
revoke all on table public.social_final_approvers from anon, authenticated;
grant select on table public.media_packages to authenticated;
grant select on table public.media_artifacts to authenticated;
grant select on table public.media_ingest_authorizations to authenticated;
grant select on table public.social_draft_artifacts to authenticated;

create policy "newsroom reads media packages"
on public.media_packages for select to authenticated
using ((select auth.uid()) is not null and public.current_app_role() is not null);

create policy "newsroom reads media artifacts"
on public.media_artifacts for select to authenticated
using ((select auth.uid()) is not null and public.current_app_role() is not null);

create policy "newsroom reads media ingest authorizations"
on public.media_ingest_authorizations for select to authenticated
using ((select auth.uid()) is not null and public.current_app_role() is not null);

create policy "newsroom reads social draft artifact mappings"
on public.social_draft_artifacts for select to authenticated
using ((select auth.uid()) is not null and public.current_app_role() is not null);

create or replace function public.is_current_social_final_approver()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.social_final_approvers approver
    join public.profiles profile on profile.id = approver.user_id
    where approver.user_id = auth.uid()
      and approver.active = true
      and profile.active = true
  );
$$;

create policy "newsroom reads exact private review objects"
on storage.objects for select to authenticated
using (
  bucket_id = 'caios-media-review'
  and public.is_current_social_final_approver()
  and exists (
    select 1
    from public.media_artifacts artifact
    where artifact.bucket_id = storage.objects.bucket_id
      and artifact.object_path = storage.objects.name
  )
);

create policy "authorized user uploads exact private review objects"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'caios-media-review'
  and exists (
    select 1
    from public.media_artifacts artifact
    join public.media_packages package on package.id = artifact.package_id
    join public.media_ingest_authorizations ingest_auth
      on ingest_auth.package_id = artifact.package_id
    where artifact.bucket_id = storage.objects.bucket_id
      and artifact.object_path = storage.objects.name
      and ingest_auth.authorized_by = (select auth.uid())
      and public.is_current_social_final_approver()
      and ingest_auth.package_hash = package.producer_package_hash
      and ingest_auth.purpose = 'private_review'
      and ingest_auth.used_at is null
      and ingest_auth.expires_at > now()
      and exists (
        select 1
        from jsonb_array_elements(ingest_auth.object_plan) planned
        where planned ->> 'artifact_id' = artifact.id::text
          and planned ->> 'object_path' = artifact.object_path
          and planned ->> 'sha256' = artifact.sha256
          and (planned ->> 'byte_size')::bigint = artifact.byte_size
          and planned ->> 'mime_type' = artifact.mime_type
      )
  )
);

create or replace function public.import_media_package(
  p_local_job_id text,
  p_title text,
  p_package_hash text,
  p_caption_file_hash text,
  p_music_license_hash text,
  p_rights_evidence_hash text,
  p_rights_attested boolean,
  p_rights_note text,
  p_qa_status text,
  p_artifacts jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor uuid := auth.uid();
  v_id uuid := gen_random_uuid();
  v_artifact jsonb;
  v_key text;
  v_sha text;
  v_mime text;
begin
  if v_actor is null or public.current_app_role() not in ('administrator', 'editor', 'producer', 'researcher') then
    raise exception 'Not authorized to import media packages';
  end if;
  if p_local_job_id !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$'
     or char_length(btrim(coalesce(p_title, ''))) not between 1 and 160
     or p_package_hash !~ '^[0-9a-f]{64}$'
     or p_qa_status not in ('verified', 'needs_review', 'failed') then
    raise exception 'Invalid media package metadata';
  end if;
  if p_caption_file_hash is not null and p_caption_file_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid caption hash';
  end if;
  if p_music_license_hash is not null and p_music_license_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid music license hash';
  end if;
  if p_rights_evidence_hash is not null and p_rights_evidence_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid rights evidence hash';
  end if;
  if jsonb_typeof(p_artifacts) <> 'array'
     or jsonb_array_length(p_artifacts) not between 1 and 10 then
    raise exception 'A media package must contain between 1 and 10 artifacts';
  end if;

  insert into public.media_packages (
    id, local_job_id, title, producer_package_hash, caption_file_hash,
    music_license_hash, rights_evidence_hash, rights_attested, rights_note,
    qa_status, created_by, updated_by
  ) values (
    v_id, p_local_job_id, btrim(p_title), p_package_hash, p_caption_file_hash,
    p_music_license_hash, p_rights_evidence_hash, coalesce(p_rights_attested, false),
    nullif(btrim(coalesce(p_rights_note, '')), ''), p_qa_status, v_actor, v_actor
  );

  for v_artifact in select value from jsonb_array_elements(p_artifacts)
  loop
    v_key := v_artifact ->> 'artifact_key';
    v_sha := v_artifact ->> 'sha256';
    v_mime := v_artifact ->> 'mime_type';
    if v_key !~ '^[a-z0-9][a-z0-9_-]{0,63}$'
       or (v_artifact ->> 'platform_profile') !~ '^[a-z0-9][a-z0-9_-]{0,63}$'
       or v_sha !~ '^[0-9a-f]{64}$'
       or v_mime <> 'video/mp4'
       or (v_artifact ->> 'audio_choice') not in ('keep', 'mute')
       or (v_artifact ->> 'qa_status') not in ('verified', 'needs_review', 'failed') then
      raise exception 'Invalid media artifact metadata';
    end if;

    insert into public.media_artifacts (
      package_id, artifact_key, platform_profile, object_path, sha256,
      byte_size, mime_type, width, height, duration_ms, audio_choice, qa_status
    ) values (
      v_id,
      v_key,
      v_artifact ->> 'platform_profile',
      'packages/' || v_id::text || '/' || v_sha || '/' || v_key || '.mp4',
      v_sha,
      (v_artifact ->> 'byte_size')::bigint,
      v_mime,
      (v_artifact ->> 'width')::integer,
      (v_artifact ->> 'height')::integer,
      (v_artifact ->> 'duration_ms')::bigint,
      v_artifact ->> 'audio_choice',
      v_artifact ->> 'qa_status'
    );
  end loop;

  if (select sum(byte_size) from public.media_artifacts where package_id = v_id) > 536870912 then
    raise exception 'A media package may contain at most 512 MiB of review artifacts';
  end if;

  insert into public.audit_events (actor_id, event_type, event_data)
  values (v_actor, 'media_package_imported', jsonb_build_object(
    'package_id', v_id,
    'local_job_id', p_local_job_id,
    'package_hash', p_package_hash,
    'artifact_count', jsonb_array_length(p_artifacts),
    'external_media_uploaded', false,
    'publishing_enabled', false
  ));

  return v_id;
end;
$$;

create or replace function public.authorize_media_package_private_upload(
  p_package_id uuid,
  p_expected_updated_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_package public.media_packages%rowtype;
  v_authorization_id uuid;
  v_object_plan jsonb;
begin
  if v_actor is null or not public.is_current_social_final_approver() then
    raise exception 'Not authorized to approve private media upload';
  end if;

  select * into v_package
  from public.media_packages
  where id = p_package_id and updated_at = p_expected_updated_at
  for update;

  if v_package.id is null or v_package.status not in ('imported', 'private_upload_authorized') then
    raise exception 'Media package changed or is not eligible for upload authorization';
  end if;
  if not v_package.rights_attested or v_package.qa_status <> 'verified' then
    raise exception 'Rights and QA must be confirmed before private upload';
  end if;
  if exists (
    select 1 from public.media_artifacts artifact
    where artifact.package_id = p_package_id and artifact.qa_status <> 'verified'
  ) then
    raise exception 'Every artifact must pass QA before private upload';
  end if;

  update public.media_ingest_authorizations
  set used_at = clock_timestamp()
  where package_id = p_package_id and used_at is null;

  select jsonb_agg(jsonb_build_object(
    'artifact_id', artifact.id,
    'object_path', artifact.object_path,
    'sha256', artifact.sha256,
    'byte_size', artifact.byte_size,
    'mime_type', artifact.mime_type
  ) order by artifact.artifact_key)
  into v_object_plan
  from public.media_artifacts artifact
  where artifact.package_id = p_package_id;

  insert into public.media_ingest_authorizations (
    package_id, package_hash, object_plan, authorized_by, expires_at
  ) values (
    p_package_id, v_package.producer_package_hash, v_object_plan, v_actor, now() + interval '24 hours'
  ) returning id into v_authorization_id;

  update public.media_packages
  set status = 'private_upload_authorized', updated_by = v_actor, updated_at = clock_timestamp()
  where id = p_package_id;

  insert into public.audit_events (actor_id, event_type, event_data)
  values (v_actor, 'media_private_upload_authorized', jsonb_build_object(
    'package_id', p_package_id,
    'authorization_id', v_authorization_id,
    'package_hash', v_package.producer_package_hash,
    'purpose', 'private_review',
    'publishing_authorized', false
  ));

  return v_authorization_id;
end;
$$;

create or replace function public.finalize_media_package_private_upload_verified(
  p_authorization_id uuid,
  p_actor uuid,
  p_remote_verification jsonb
)
returns void
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_authorization public.media_ingest_authorizations%rowtype;
  v_missing integer;
begin
  if p_actor is null or jsonb_typeof(p_remote_verification) <> 'array' then
    raise exception 'Invalid trusted verification payload';
  end if;

  select * into v_authorization
  from public.media_ingest_authorizations
  where id = p_authorization_id
  for update;

  if v_authorization.id is null
     or v_authorization.authorized_by <> p_actor
     or v_authorization.used_at is not null
     or v_authorization.expires_at <= now() then
    raise exception 'Private upload authorization is invalid, expired, or already used';
  end if;
  if not exists (
    select 1 from public.media_packages package
    where package.id = v_authorization.package_id
      and package.producer_package_hash = v_authorization.package_hash
  ) then
    raise exception 'The media package changed after upload authorization';
  end if;
  if not exists (
    select 1 from public.social_final_approvers approver
    join public.profiles profile on profile.id = approver.user_id
    where approver.user_id = p_actor and approver.active = true and profile.active = true
  ) then
    raise exception 'The authorized actor is not the active final approver';
  end if;

  select count(*) into v_missing
  from public.media_artifacts artifact
  where artifact.package_id = v_authorization.package_id
    and not exists (
      select 1
      from storage.objects object
      where object.bucket_id = artifact.bucket_id
        and object.name = artifact.object_path
        and coalesce((object.metadata ->> 'size')::bigint, -1) = artifact.byte_size
        and coalesce(object.metadata ->> 'mimetype', '') = artifact.mime_type
        and exists (
          select 1
          from jsonb_array_elements(v_authorization.object_plan) planned
          where planned ->> 'artifact_id' = artifact.id::text
            and planned ->> 'object_path' = artifact.object_path
            and planned ->> 'sha256' = artifact.sha256
            and (planned ->> 'byte_size')::bigint = artifact.byte_size
            and planned ->> 'mime_type' = artifact.mime_type
        )
        and exists (
          select 1
          from jsonb_array_elements(p_remote_verification) verified
          where verified ->> 'artifact_id' = artifact.id::text
            and verified ->> 'sha256' = artifact.sha256
            and (verified ->> 'byte_size')::bigint = artifact.byte_size
        )
    );

  if v_missing <> 0
     or jsonb_array_length(p_remote_verification) <> (
       select count(*) from public.media_artifacts artifact
       where artifact.package_id = v_authorization.package_id
     ) then
    raise exception 'One or more media objects failed trusted size, MIME, plan, or SHA-256 verification';
  end if;

  update public.media_artifacts
  set upload_status = 'verified'
  where package_id = v_authorization.package_id;

  update public.media_ingest_authorizations
  set used_at = clock_timestamp()
  where id = p_authorization_id;

  update public.media_packages
  set status = 'ready_for_review', updated_by = p_actor, updated_at = clock_timestamp()
  where id = v_authorization.package_id;

  insert into public.audit_events (actor_id, event_type, event_data)
  values (p_actor, 'media_private_upload_finalized', jsonb_build_object(
    'package_id', v_authorization.package_id,
    'authorization_id', p_authorization_id,
    'purpose', 'private_review',
    'remote_sha256_verified_by', 'trusted_server',
    'publishing_authorized', false
  ));
end;
$$;

create or replace function public.social_media_approval_payload(
  p_title text,
  p_facebook_caption text,
  p_instagram_caption text,
  p_media_package_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_package public.media_packages%rowtype;
  v_artifacts jsonb;
  v_expected integer :=
    case when nullif(btrim(coalesce(p_facebook_caption, '')), '') is null then 0 else 1 end
    + case when nullif(btrim(coalesce(p_instagram_caption, '')), '') is null then 0 else 1 end;
begin
  select * into v_package
  from public.media_packages
  where id = p_media_package_id and status = 'ready_for_review';

  if v_package.id is null then
    raise exception 'Media package is not ready for social review';
  end if;

  select jsonb_agg(jsonb_build_object(
    'platform', case when artifact.platform_profile = 'facebook_reel' then 'facebook' else 'instagram' end,
    'artifact_id', artifact.id,
    'platform_profile', artifact.platform_profile,
    'object_path', artifact.object_path,
    'sha256', artifact.sha256,
    'byte_size', artifact.byte_size,
    'mime_type', artifact.mime_type,
    'width', artifact.width,
    'height', artifact.height,
    'duration_ms', artifact.duration_ms,
    'audio_choice', artifact.audio_choice,
    'qa_status', artifact.qa_status
  ) order by artifact.platform_profile)
  into v_artifacts
  from public.media_artifacts artifact
  where artifact.package_id = p_media_package_id
    and artifact.upload_status = 'verified'
    and artifact.qa_status = 'verified'
    and (
      (artifact.platform_profile = 'facebook_reel' and nullif(btrim(coalesce(p_facebook_caption, '')), '') is not null)
      or (artifact.platform_profile = 'instagram_reel' and nullif(btrim(coalesce(p_instagram_caption, '')), '') is not null)
    );

  if coalesce(jsonb_array_length(v_artifacts), 0) <> v_expected then
    raise exception 'Each captioned platform requires exactly one verified primary artifact';
  end if;

  return jsonb_build_object(
    'schema', 'CAIOS_SOCIAL_APPROVAL_V2',
    'title', btrim(p_title),
    'captions', jsonb_build_object(
      'facebook', nullif(btrim(coalesce(p_facebook_caption, '')), ''),
      'instagram', nullif(btrim(coalesce(p_instagram_caption, '')), '')
    ),
    'destinations', jsonb_build_object(
      'facebook_page_id', '1214069685123391',
      'instagram_account_id', '17841403279084160'
    ),
    'media_package', jsonb_build_object(
      'id', v_package.id,
      'producer_package_hash', v_package.producer_package_hash,
      'caption_file_hash', v_package.caption_file_hash,
      'music_license_hash', v_package.music_license_hash,
      'rights_evidence_hash', v_package.rights_evidence_hash,
      'rights_attested', v_package.rights_attested,
      'rights_note', v_package.rights_note
    ),
    'artifacts', coalesce(v_artifacts, '[]'::jsonb)
  );
end;
$$;

create or replace function public.social_media_approval_hash(
  p_title text,
  p_facebook_caption text,
  p_instagram_caption text,
  p_media_package_id uuid
)
returns text
language sql
security definer
set search_path = public, extensions
as $$
  select encode(extensions.digest(
    public.social_media_approval_payload(
      p_title, p_facebook_caption, p_instagram_caption, p_media_package_id
    )::text,
    'sha256'
  ), 'hex');
$$;

create or replace function public.create_media_social_content_draft(
  p_media_package_id uuid,
  p_title text,
  p_facebook_caption text,
  p_instagram_caption text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_title text := btrim(coalesce(p_title, ''));
  v_facebook text := nullif(btrim(coalesce(p_facebook_caption, '')), '');
  v_instagram text := nullif(btrim(coalesce(p_instagram_caption, '')), '');
  v_hash text;
  v_id uuid;
  v_mapping_count integer;
begin
  if v_actor is null or public.current_app_role() not in ('administrator', 'editor', 'producer', 'researcher') then
    raise exception 'Not authorized to create media social drafts';
  end if;
  if char_length(v_title) not between 1 and 160
     or (v_facebook is null and v_instagram is null)
     or char_length(coalesce(v_facebook, '')) > 5000
     or char_length(coalesce(v_instagram, '')) > 2200 then
    raise exception 'Invalid social draft fields';
  end if;

  v_hash := public.social_media_approval_hash(
    v_title, v_facebook, v_instagram, p_media_package_id
  );

  insert into public.social_content_drafts (
    title, facebook_caption, instagram_caption, media_package_id,
    content_hash, created_by, updated_by
  ) values (
    v_title, v_facebook, v_instagram, p_media_package_id,
    v_hash, v_actor, v_actor
  ) returning id into v_id;

  insert into public.social_draft_artifacts (social_draft_id, platform, artifact_id)
  select v_id,
         case when artifact.platform_profile like 'facebook_%' then 'facebook' else 'instagram' end,
         artifact.id
  from public.media_artifacts artifact
  where artifact.package_id = p_media_package_id
    and artifact.upload_status = 'verified'
    and artifact.qa_status = 'verified'
    and (
      (artifact.platform_profile = 'facebook_reel' and v_facebook is not null)
      or (artifact.platform_profile = 'instagram_reel' and v_instagram is not null)
    );

  get diagnostics v_mapping_count = row_count;
  if v_mapping_count <>
     (case when v_facebook is null then 0 else 1 end + case when v_instagram is null then 0 else 1 end) then
    raise exception 'Social draft artifact mapping is incomplete';
  end if;

  insert into public.audit_events (actor_id, event_type, event_data)
  values (v_actor, 'media_social_draft_created', jsonb_build_object(
    'content_item_id', v_id,
    'media_package_id', p_media_package_id,
    'content_hash', v_hash,
    'publishing_enabled', false,
    'approval_required', true
  ));

  return v_id;
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
  v_payload jsonb;
  v_recomputed_hash text;
  v_title text;
  v_facebook text;
  v_instagram text;
  v_media_package_id uuid;
  v_facebook_page_id text;
  v_instagram_account_id text;
  v_updated_at timestamptz := clock_timestamp();
begin
  if v_actor is null or public.current_app_role() not in ('administrator', 'editor', 'reviewer') then
    raise exception 'Not authorized to decide social drafts';
  end if;
  if p_decision not in ('approved', 'changes_requested', 'rejected') then
    raise exception 'Invalid social draft decision';
  end if;
  if p_decision = 'approved' and not public.is_current_social_final_approver() then
    raise exception 'Only the bound CAIOS final approver may approve social drafts';
  end if;
  if char_length(coalesce(p_note, '')) > 4000 then
    raise exception 'Review note is too long';
  end if;

  select draft.content_hash, draft.title, draft.facebook_caption,
         draft.instagram_caption, draft.media_package_id,
         draft.facebook_page_id, draft.instagram_account_id
  into v_hash, v_title, v_facebook, v_instagram, v_media_package_id,
       v_facebook_page_id, v_instagram_account_id
  from public.social_content_drafts draft
  where draft.id = p_content_item_id
    and draft.updated_at = p_expected_updated_at
    and draft.status = 'ready_for_review'
  for update;

  if v_hash is null then
    raise exception 'Draft changed or is not awaiting review';
  end if;

  if v_media_package_id is not null then
    v_payload := public.social_media_approval_payload(
      v_title, v_facebook, v_instagram, v_media_package_id
    );
    v_recomputed_hash := encode(extensions.digest(v_payload::text, 'sha256'), 'hex');
    if v_recomputed_hash <> v_hash then
      raise exception 'Media approval payload no longer matches the draft hash';
    end if;
  else
    v_payload := jsonb_build_object(
      'schema', 'CAIOS_SOCIAL_APPROVAL_V1',
      'content_item_id', p_content_item_id,
      'title', v_title,
      'facebook_caption', v_facebook,
      'instagram_caption', v_instagram,
      'facebook_page_id', v_facebook_page_id,
      'instagram_account_id', v_instagram_account_id,
      'content_hash', v_hash,
      'artifacts', '[]'::jsonb
    );
  end if;

  insert into public.social_content_approvals (
    content_item_id, approver_id, decision, content_hash, approval_payload, note
  ) values (
    p_content_item_id, v_actor, p_decision, v_hash, v_payload,
    nullif(btrim(coalesce(p_note, '')), '')
  );

  update public.social_content_drafts
  set status = p_decision,
      approved_by = case when p_decision = 'approved' then v_actor else null end,
      approved_at = case when p_decision = 'approved' then v_updated_at else null end,
      updated_by = v_actor,
      updated_at = v_updated_at
  where id = p_content_item_id;

  update public.media_packages package
  set status = case when p_decision = 'changes_requested' then 'ready_for_review' else p_decision end,
      updated_by = v_actor,
      updated_at = v_updated_at
  from public.social_content_drafts draft
  where draft.id = p_content_item_id
    and package.id = draft.media_package_id;

  insert into public.audit_events (actor_id, event_type, event_data)
  values (v_actor, 'social_draft_human_decision_recorded', jsonb_build_object(
    'content_item_id', p_content_item_id,
    'decision', p_decision,
    'content_hash', v_hash,
    'media_bound', v_media_package_id is not null,
    'publishing_enabled', false,
    'scheduling_enabled', false,
    'approval_required', true
  ));
end;
$$;

revoke all on function public.import_media_package(text, text, text, text, text, text, boolean, text, text, jsonb) from public, anon;
revoke all on function public.authorize_media_package_private_upload(uuid, timestamptz) from public, anon;
revoke all on function public.finalize_media_package_private_upload_verified(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.social_media_approval_payload(text, text, text, uuid) from public, anon;
revoke all on function public.social_media_approval_hash(text, text, text, uuid) from public, anon;
revoke all on function public.create_media_social_content_draft(uuid, text, text, text) from public, anon;
revoke all on function public.record_social_content_decision(uuid, timestamptz, text, text) from public, anon;
revoke all on function public.is_current_social_final_approver() from public, anon;

grant execute on function public.import_media_package(text, text, text, text, text, text, boolean, text, text, jsonb) to authenticated;
grant execute on function public.authorize_media_package_private_upload(uuid, timestamptz) to authenticated;
grant execute on function public.finalize_media_package_private_upload_verified(uuid, uuid, jsonb) to service_role;
grant execute on function public.create_media_social_content_draft(uuid, text, text, text) to authenticated;
grant execute on function public.record_social_content_decision(uuid, timestamptz, text, text) to authenticated;
grant execute on function public.is_current_social_final_approver() to authenticated;

comment on table public.media_packages is
  'Sanitized private-review packages from CAIOS Media Studio. No publishing capability.';
comment on table public.media_ingest_authorizations is
  'Single-use authorization for external transmission to private CAIOS review storage only.';
comment on table public.social_final_approvers is
  'Exact Supabase user UUIDs permitted to issue final social approval. No name or metadata authorization.';
