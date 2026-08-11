-- Async extraction (Task 6/8 rework): the extract function now returns
-- immediately and does the real work in a background task, so we need to
-- know when a document started processing (for the reaper) and why it
-- failed (for the UI). `version` backs optimistic-concurrency retry on the
-- project row, which becomes necessary once extraction runs concurrently
-- (background tasks today, chunked sub-extractions next).
alter table documents add column extraction_started_at timestamptz;
alter table documents add column extraction_error text;
alter table projects add column version integer not null default 0;
