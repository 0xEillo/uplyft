-- Add routine_id column to workout_sessions to track which routine was used
-- This allows us to show previous workout data when user loads the same routine

-- Add the column
alter table public.workout_sessions
  add column routine_id uuid references public.workout_routines(id) on delete set null;

-- Create index for faster queries
create index idx_workout_sessions_routine_id on public.workout_sessions(routine_id);

-- Create index for querying last workout by routine
create index idx_workout_sessions_user_routine_date on public.workout_sessions(user_id, routine_id, date desc);
