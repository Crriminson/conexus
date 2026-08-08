-- Chunking pivoted to client-side splitting (human call, 2026-08-08,
-- revised after the server-side pdf-lib attempt died to a ~2s CPU-time
-- budget — separate from and much stricter than the ~150s wall-clock
-- ceiling, hit just from parsing the source PDF before any Gemini call).
-- The browser splits the PDF into page-range chunks at upload time and
-- uploads each as its own Storage object; this column is that plan, so the
-- edge function only ever downloads an already-chunk-sized file and never
-- touches PDF structure.
alter table documents add column chunk_plan jsonb;
