-- Function to refresh the exercise_user_1rm materialized view
create or replace function refresh_exercise_user_1rm()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Refresh the materialized view concurrently to avoid locking
  refresh materialized view concurrently exercise_user_1rm;
  return null;
end;
$$;

-- Trigger on sets table (since this is where weight/rep data changes)
drop trigger if exists refresh_exercise_user_1rm_on_sets on sets;
create trigger refresh_exercise_user_1rm_on_sets
  after insert or update or delete on sets
  for each statement
  execute function refresh_exercise_user_1rm();

-- Trigger on workout_exercises table (in case exercises are added/removed)
drop trigger if exists refresh_exercise_user_1rm_on_workout_exercises on workout_exercises;
create trigger refresh_exercise_user_1rm_on_workout_exercises
  after insert or update or delete on workout_exercises
  for each statement
  execute function refresh_exercise_user_1rm();

-- Initial refresh to catch any existing data
refresh materialized view concurrently exercise_user_1rm;
