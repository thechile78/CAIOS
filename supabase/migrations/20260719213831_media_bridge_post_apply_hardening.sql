-- Remove direct API execution from internal approval payload/hash helpers.
-- SECURITY DEFINER workflow functions may still call them internally.
revoke execute on function public.social_media_approval_payload(text, text, text, uuid)
  from authenticated, service_role;
revoke execute on function public.social_media_approval_hash(text, text, text, uuid)
  from authenticated, service_role;

create index social_final_approvers_bound_by_idx
  on public.social_final_approvers (bound_by);
