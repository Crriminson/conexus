-- Audit trail (go-ahead given 2026-08-11, see docs/STATE.md): a write-once
-- log of every state change to a fact — extraction merge, human edit,
-- confirm, conflict raised, conflict resolved. Application-level, not
-- Supabase Auth/RLS-backed (this schema has no RLS anywhere yet — see
-- init_schema.sql/documents_bucket_policies.sql — the anon key already has
-- full CRUD on every existing table); the REVOKE below is the one piece of
-- this that IS enforced at the DB layer rather than left to code discipline
-- alone, since "no updates or deletes, ever" is cheap to guarantee for real.
--
-- `fact_id` is a fieldPath string (src/lib/facts/fieldPath.ts's grammar,
-- e.g. "company.legalName" or "promoters[<uuid>].name"), not a foreign key
-- to a `facts` table — this schema has never had one; facts live in
-- `projects.facts` jsonb (see init_schema.sql), addressed by path rather
-- than by row id. fieldPath is what `FactConflict.fieldPath` and
-- `MergeEvent.fieldsWritten` already key on, so this reuses that grammar
-- instead of inventing a second identifier scheme for the same fact.
--
-- `event_type`/`source` are plain `text` + `check`, not Postgres `enum`
-- types — every other status-like column in this schema
-- (`documents.extraction_status`, the `FieldStatus`/`FactConflict.resolution`
-- unions) follows the same convention, validated at the TypeScript layer via
-- a union type, not a DB enum. Kept consistent rather than introducing the
-- one enum type in an otherwise enum-free schema.
create table fact_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id),
  fact_id text not null,
  event_type text not null check (event_type in ('extracted', 'edited', 'confirmed', 'conflict_raised', 'conflict_resolved')),
  old_value jsonb,
  new_value jsonb,
  source text not null check (source in ('extraction', 'manual', 'merge')),
  created_at timestamptz not null default now()
);

create index fact_events_project_id_idx on fact_events (project_id);
create index fact_events_project_id_fact_id_idx on fact_events (project_id, fact_id);

-- Write-once: no code path should ever UPDATE or DELETE a row here. Revoked
-- outright rather than relying on nothing in the app ever calling it.
revoke update, delete on fact_events from anon, authenticated;
