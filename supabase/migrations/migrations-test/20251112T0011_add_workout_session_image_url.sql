-- Attach optional media to workout sessions
alter table public.workout_sessions
  add column if not exists image_url text;

