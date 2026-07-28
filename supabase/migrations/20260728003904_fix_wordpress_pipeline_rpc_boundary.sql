alter function public.package_approved_handoff(uuid,timestamptz,jsonb) security definer;
alter function public.queue_wordpress_draft_intent(uuid,timestamptz,jsonb) security definer;
alter function public.begin_wordpress_draft_dispatch(uuid,timestamptz) security definer;
alter function public.finish_wordpress_draft_dispatch(uuid,boolean,text,text,text) security definer;

revoke execute on function public.package_approved_handoff(uuid,timestamptz,jsonb) from public, anon;
revoke execute on function public.queue_wordpress_draft_intent(uuid,timestamptz,jsonb) from public, anon;
revoke execute on function public.begin_wordpress_draft_dispatch(uuid,timestamptz) from public, anon;
revoke execute on function public.finish_wordpress_draft_dispatch(uuid,boolean,text,text,text) from public, anon;

grant execute on function public.package_approved_handoff(uuid,timestamptz,jsonb) to authenticated;
grant execute on function public.queue_wordpress_draft_intent(uuid,timestamptz,jsonb) to authenticated;
grant execute on function public.begin_wordpress_draft_dispatch(uuid,timestamptz) to authenticated;
grant execute on function public.finish_wordpress_draft_dispatch(uuid,boolean,text,text,text) to authenticated;
