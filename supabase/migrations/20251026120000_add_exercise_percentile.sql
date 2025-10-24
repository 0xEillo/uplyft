create materialized view if not exists exercise_user_1rm as
select
  we.exercise_id,
  e.name as exercise_name,
  ws.user_id,
  max(set_1rm.est_1rm) as est_1rm,
  max(set_1rm.weight) as best_weight,
  max(set_1rm.reps) as best_reps
from workout_sessions ws
  join workout_exercises we on we.session_id = ws.id
  join exercises e on e.id = we.exercise_id
  join lateral (
    select
      s.weight,
      s.reps,
      s.weight * (1 + s.reps::numeric / 30) as est_1rm
    from sets s
    where s.workout_exercise_id = we.id
  ) as set_1rm on true
where
  ws.user_id is not null
  and set_1rm.weight is not null
  and set_1rm.reps is not null
group by we.exercise_id, e.name, ws.user_id;

create unique index if not exists exercise_user_1rm_idx
  on exercise_user_1rm (exercise_id, user_id);

create function calculate_exercise_percentile(exercise_id uuid, user_est_1rm numeric)
returns table (
  percentile numeric,
  total_users integer
)
language plpgsql
security definer
as $$
declare
  user_count integer;
  below_or_equal integer;
begin
  select count(*) into user_count
  from exercise_user_1rm
  where exercise_user_1rm.exercise_id = calculate_exercise_percentile.exercise_id;

  if user_count = 0 then
    percentile := null;
    total_users := 0;
    return;
  end if;

  select count(*) into below_or_equal
  from exercise_user_1rm
  where exercise_user_1rm.exercise_id = calculate_exercise_percentile.exercise_id
    and exercise_user_1rm.est_1rm <= calculate_exercise_percentile.user_est_1rm;

  percentile := round((below_or_equal::numeric * 100) / user_count, 2);
  total_users := user_count;
  return next;
end;
$$;

revoke all on function calculate_exercise_percentile(uuid, numeric) from public;
grant execute on function calculate_exercise_percentile(uuid, numeric) to authenticated;

