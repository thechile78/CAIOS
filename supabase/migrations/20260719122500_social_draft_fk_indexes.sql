-- Cover reviewer and last-editor foreign keys reported by the Supabase advisor.

create index social_content_drafts_updated_by_idx
  on public.social_content_drafts (updated_by);

create index social_content_drafts_approved_by_idx
  on public.social_content_drafts (approved_by)
  where approved_by is not null;
