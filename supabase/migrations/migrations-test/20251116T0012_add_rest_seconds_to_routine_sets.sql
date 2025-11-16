-- Test fixture: add rest_seconds to workout routine sets

alter table if exists public.workout_routine_sets
  add column if not exists rest_seconds integer;

alter table public.workout_routine_sets
  drop constraint if exists workout_routine_sets_rest_seconds_check;

alter table public.workout_routine_sets
  add constraint workout_routine_sets_rest_seconds_check
  check (
    rest_seconds is null
    or (
      rest_seconds >= 0
      and rest_seconds <= 3600
    )
  );

