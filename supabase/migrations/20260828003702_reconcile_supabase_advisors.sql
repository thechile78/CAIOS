-- Forward-only reconciliation for actionable Supabase advisor findings.
-- This migration is intentionally idempotent so it can be reviewed safely
-- against staging before any live application.

alter function public.set_updated_at_timestamp()
  set search_path = '';

create index if not exists search_console_connections_connected_by_idx
  on public.search_console_connections (connected_by);
