-- Function to get the weight needed to reach a target percentile
create or replace function get_weight_for_percentile(
  in p_exercise_id uuid,
  in p_target_percentile numeric,
  in p_filter_gender text default null,
  in p_bucket_start numeric default null,
  in p_bucket_end numeric default null
)
returns numeric
language plpgsql
security definer
as $$
declare
  user_count integer;
  target_position integer;
  weight_at_percentile numeric;
begin
  -- Get total user count with filters
  select count(*) into user_count
  from exercise_user_1rm
  where exercise_user_1rm.exercise_id = p_exercise_id
    and (p_filter_gender is null or exercise_user_1rm.gender = p_filter_gender)
    and (
      p_bucket_start is null
      or (
        exercise_user_1rm.weight_bucket_start = p_bucket_start
        and exercise_user_1rm.weight_bucket_end = p_bucket_end
      )
    );

  if user_count = 0 then
    return null;
  end if;

  -- Calculate position: target_percentile% of users should be below or equal
  -- We want the weight at which (position / total) * 100 >= target_percentile
  -- So position = ceil(target_percentile / 100 * total_users)
  target_position := ceil((p_target_percentile / 100.0) * user_count)::integer;

  -- Get the weight at that position (sorted ascending)
  select est_1rm into weight_at_percentile
  from (
    select est_1rm,
           row_number() over (order by est_1rm asc) as rn
    from exercise_user_1rm
    where exercise_user_1rm.exercise_id = p_exercise_id
      and (p_filter_gender is null or exercise_user_1rm.gender = p_filter_gender)
      and (
        p_bucket_start is null
        or (
          exercise_user_1rm.weight_bucket_start = p_bucket_start
          and exercise_user_1rm.weight_bucket_end = p_bucket_end
        )
      )
  ) ranked
  where rn = target_position
  limit 1;

  return weight_at_percentile;
end;
$$;

revoke all on function get_weight_for_percentile(uuid, numeric, text, numeric, numeric) from public;
grant execute on function get_weight_for_percentile(uuid, numeric, text, numeric, numeric) to authenticated;

