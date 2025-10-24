drop function if exists calculate_exercise_percentile(uuid, numeric);

create function calculate_exercise_percentile(
  exercise_id uuid,
  user_est_1rm numeric
)
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
