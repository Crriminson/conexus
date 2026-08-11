-- Task 3's schema only had facts + conflicts. Section 4's provenance log
-- (MergeEvent[]) needs somewhere to live on the project row for Task 8.
alter table projects add column merge_events jsonb not null default '[]'::jsonb;
