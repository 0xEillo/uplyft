-- Change exercise FK in routine tables from RESTRICT to CASCADE
-- This allows deleting exercises even if they're used in routines

-- explore_routine_exercises: drop and recreate FK with CASCADE
alter table public.explore_routine_exercises
  drop constraint if exists explore_routine_exercises_exercise_id_fkey;

alter table public.explore_routine_exercises
  add constraint explore_routine_exercises_exercise_id_fkey
  foreign key (exercise_id) references public.exercises(id) on delete cascade;

-- workout_routine_exercises: drop and recreate FK with CASCADE
alter table public.workout_routine_exercises
  drop constraint if exists workout_routine_exercises_exercise_id_fkey;

alter table public.workout_routine_exercises
  add constraint workout_routine_exercises_exercise_id_fkey
  foreign key (exercise_id) references public.exercises(id) on delete cascade;



