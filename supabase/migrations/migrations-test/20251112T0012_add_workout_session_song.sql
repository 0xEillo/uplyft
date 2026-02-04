alter table public.workout_sessions
  add column if not exists song jsonb;
