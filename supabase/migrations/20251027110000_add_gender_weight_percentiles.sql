drop function if exists get_exercise_percentiles(uuid, uuid);
drop function if exists calculate_exercise_percentile_filtered(uuid, numeric, text, numeric, numeric);
drop function if exists calculate_exercise_percentile(uuid, numeric);
drop materialized view if exists exercise_user_1rm;

create materialized view if not exists exercise_user_1rm as
select
  we.exercise_id,
  e.name as exercise_name,
  ws.user_id,
  max(set_1rm.est_1rm)::numeric as est_1rm,
  max(set_1rm.weight)::numeric as best_weight,
  max(set_1rm.reps) as best_reps,
  p.gender,
  case
    when p.weight_kg is null then null
    else floor(p.weight_kg / 5) * 5
  end as weight_bucket_start,
  case
    when p.weight_kg is null then null
    else floor(p.weight_kg / 5) * 5 + 5
  end as weight_bucket_end
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
      and s.weight is not null
      and s.reps is not null
  ) as set_1rm on true
  left join profiles p on p.id = ws.user_id
where
  ws.user_id is not null
group by we.exercise_id, e.name, ws.user_id, p.gender, weight_bucket_start, weight_bucket_end;

create unique index if not exists exercise_user_1rm_idx
  on exercise_user_1rm (exercise_id, user_id);

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

  percentile := round((below_or_equal::numeric * 100) / greatest(user_count, 1), 2);
  total_users := user_count;
  return next;
end;
$$;

create function calculate_exercise_percentile_filtered(
  exercise_id uuid,
  user_est_1rm numeric,
  filter_gender text,
  bucket_start numeric,
  bucket_end numeric
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
  where exercise_user_1rm.exercise_id = calculate_exercise_percentile_filtered.exercise_id
    and (filter_gender is null or exercise_user_1rm.gender = filter_gender)
    and (
      bucket_start is null
      or (
        exercise_user_1rm.weight_bucket_start = bucket_start
        and exercise_user_1rm.weight_bucket_end = bucket_end
      )
    );

  if user_count = 0 then
    percentile := null;
    total_users := 0;
    return;
  end if;

  select count(*) into below_or_equal
  from exercise_user_1rm
  where exercise_user_1rm.exercise_id = calculate_exercise_percentile_filtered.exercise_id
    and exercise_user_1rm.est_1rm <= calculate_exercise_percentile_filtered.user_est_1rm
    and (filter_gender is null or exercise_user_1rm.gender = filter_gender)
    and (
      bucket_start is null
      or (
        exercise_user_1rm.weight_bucket_start = bucket_start
        and exercise_user_1rm.weight_bucket_end = bucket_end
      )
    );

  percentile := round((below_or_equal::numeric * 100) / greatest(user_count, 1), 2);
  total_users := user_count;
  return next;
end;
$$;

create function get_exercise_percentiles(
  in p_exercise_id uuid,
  in p_user_id uuid
)
returns table (
  exercise_id uuid,
  exercise_name text,
  user_est_1rm numeric,
  overall_percentile numeric,
  overall_total_users integer,
  gender text,
  gender_percentile numeric,
  gender_total_users integer,
  weight_bucket_start numeric,
  weight_bucket_end numeric,
  gender_weight_percentile numeric,
  gender_weight_total_users integer
)
language plpgsql
security definer
as $$
declare
  user_row exercise_user_1rm%rowtype;
  overall_result record;
  gender_result record;
  bucket_result record;
begin
  select *
    into user_row
  from exercise_user_1rm
  where exercise_user_1rm.exercise_id = p_exercise_id
    and exercise_user_1rm.user_id = p_user_id
  limit 1;

  if user_row.exercise_id is null then
    return;
  end if;

  select *
    into overall_result
  from calculate_exercise_percentile(user_row.exercise_id, user_row.est_1rm);

  if user_row.gender is not null then
    select *
      into gender_result
    from calculate_exercise_percentile_filtered(
      user_row.exercise_id,
      user_row.est_1rm,
      user_row.gender,
      null,
      null
    );
  end if;

  if user_row.gender is not null and user_row.weight_bucket_start is not null then
    select *
      into bucket_result
    from calculate_exercise_percentile_filtered(
      user_row.exercise_id,
      user_row.est_1rm,
      user_row.gender,
      user_row.weight_bucket_start,
      user_row.weight_bucket_end
    );
  end if;

  exercise_id := user_row.exercise_id;
  exercise_name := user_row.exercise_name;
  user_est_1rm := user_row.est_1rm;
  overall_percentile := overall_result.percentile;
  overall_total_users := overall_result.total_users;
  gender := user_row.gender;
  gender_percentile := gender_result.percentile;
  gender_total_users := gender_result.total_users;
  weight_bucket_start := user_row.weight_bucket_start;
  weight_bucket_end := user_row.weight_bucket_end;
  gender_weight_percentile := bucket_result.percentile;
  gender_weight_total_users := bucket_result.total_users;

  return next;
end;
$$;

revoke all on function calculate_exercise_percentile(uuid, numeric) from public;
grant execute on function calculate_exercise_percentile(uuid, numeric) to authenticated;

revoke all on function calculate_exercise_percentile_filtered(uuid, numeric, text, numeric, numeric) from public;
grant execute on function calculate_exercise_percentile_filtered(uuid, numeric, text, numeric, numeric) to authenticated;

revoke all on function get_exercise_percentiles(uuid, uuid) from public;
grant execute on function get_exercise_percentiles(uuid, uuid) to authenticated;

refresh materialized view exercise_user_1rm;

