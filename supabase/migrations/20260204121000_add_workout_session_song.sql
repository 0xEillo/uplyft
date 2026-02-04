ALTER TABLE public.workout_sessions
  ADD COLUMN IF NOT EXISTS song jsonb;
