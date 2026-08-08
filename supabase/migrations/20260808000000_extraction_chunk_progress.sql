-- Chunked extraction (human call, 2026-08-08): fixed 20-page splits,
-- processed sequentially via self-triggered continuation invocations (see
-- supabase/functions/extract/index.ts), merged in one chunk at a time.
-- These track progress across that chain of invocations so the UI can show
-- "processing chunk 3/20" instead of an opaque `processing` for several
-- minutes.
alter table documents add column extraction_total_chunks integer;
alter table documents add column extraction_completed_chunks integer not null default 0;
