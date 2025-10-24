create or replace function get_exercise_percentiles(
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
  requester uuid := auth.uid();
  requester_role text := auth.role();
  user_row exercise_user_1rm%rowtype;
  overall_result record;
  gender_result record;
  bucket_result record;
begin
  if requester_role is distinct from 'service_role' then
    if requester is null or requester <> p_user_id then
      raise exception
        using message = 'Insufficient privileges to access requested user data',
              errcode = '42501';
    end if;
  end if;

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

grant execute on function get_exercise_percentiles(uuid, uuid) to authenticated;

revoke all on table exercise_user_1rm from public;
revoke all on table exercise_user_1rm from anon;
revoke all on table exercise_user_1rm from authenticated;

