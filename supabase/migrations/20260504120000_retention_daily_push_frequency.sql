-- Target ~one retention-class push per day: higher weekly cap + new default.

ALTER TABLE public.retention_push_preferences
  ALTER COLUMN max_pushes_per_week SET DEFAULT 7;

UPDATE public.retention_push_preferences
SET max_pushes_per_week = 7
WHERE max_pushes_per_week = 3;
