create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  facts jsonb not null default '{}'::jsonb,
  conflicts jsonb not null default '[]'::jsonb
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id),
  filename text not null,
  storage_path text not null,
  extraction_status text not null default 'pending'
);
