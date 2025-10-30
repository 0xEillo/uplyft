create or replace function calculate_exercise_percentile(
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
  user_count integer := 0;
  below_or_equal integer := 0;
begin
  select count(*) into user_count
  from exercise_user_1rm
  where exercise_user_1rm.exercise_id = calculate_exercise_percentile.exercise_id;

  if user_count = 0 then
    percentile := null;
    total_users := 0;
    return next;
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

create or replace function calculate_exercise_percentile_filtered(
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
  user_count integer := 0;
  below_or_equal integer := 0;
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
    return next;
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
  overall_percentile_value numeric := null;
  overall_total_users_value integer := 0;
  gender_percentile_value numeric := null;
  gender_total_users_value integer := 0;
  bucket_percentile_value numeric := null;
  bucket_total_users_value integer := 0;
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

  select percentile, total_users
    into overall_percentile_value, overall_total_users_value
  from calculate_exercise_percentile(user_row.exercise_id, user_row.est_1rm);

  if not found then
    overall_percentile_value := null;
    overall_total_users_value := 0;
  end if;

  if user_row.gender is not null then
    select percentile, total_users
      into gender_percentile_value, gender_total_users_value
    from calculate_exercise_percentile_filtered(
      user_row.exercise_id,
      user_row.est_1rm,
      user_row.gender,
      null,
      null
    );

    if not found then
      gender_percentile_value := null;
      gender_total_users_value := 0;
    end if;
  end if;

  if user_row.gender is not null
     and user_row.weight_bucket_start is not null
     and user_row.weight_bucket_end is not null then
    select percentile, total_users
      into bucket_percentile_value, bucket_total_users_value
    from calculate_exercise_percentile_filtered(
      user_row.exercise_id,
      user_row.est_1rm,
      user_row.gender,
      user_row.weight_bucket_start,
      user_row.weight_bucket_end
    );

    if not found then
      bucket_percentile_value := null;
      bucket_total_users_value := 0;
    end if;
  end if;

  exercise_id := user_row.exercise_id;
  exercise_name := user_row.exercise_name;
  user_est_1rm := user_row.est_1rm;
  overall_percentile := overall_percentile_value;
  overall_total_users := overall_total_users_value;
  gender := user_row.gender;
  gender_percentile := gender_percentile_value;
  gender_total_users := gender_total_users_value;
  weight_bucket_start := user_row.weight_bucket_start;
  weight_bucket_end := user_row.weight_bucket_end;
  gender_weight_percentile := bucket_percentile_value;
  gender_weight_total_users := bucket_total_users_value;

  return next;
end;
$$;

