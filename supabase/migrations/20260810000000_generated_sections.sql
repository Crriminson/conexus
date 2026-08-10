-- Task 12 (generate-section): persists the 3 AI-generated narrative
-- sections (Risk Factors, MD&A, Business Overview) per architecture §2/§6.
-- Stored on the project row, same pattern as `facts`/`conflicts` — a JSONB
-- map keyed by section, each value { body, citations, generatedAt }.
-- Written wholesale by the generate-section Edge Function (no merge()
-- involved — this isn't proposed-vs-confirmed fact data, it's generated
-- prose regenerated on demand), guarded by the same `version` CAS as
-- everything else on this row.
alter table projects add column generated_sections jsonb not null default '{}'::jsonb;
