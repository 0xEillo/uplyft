-- Persist per-session record counts so the feed can render "Records"
-- without recomputing PRs inside every feed card mount.

alter table public.workout_sessions
  add column if not exists record_count integer not null default 0;

create or replace function public.calculate_workout_record_count(
  p_session_id uuid
)
returns integer
language sql
stable
set search_path = public
as $$
  with target_session as (
    select id, user_id, date, created_at
    from public.workout_sessions
    where id = p_session_id
  ),
  current_sets as (
    select
      we.exercise_id,
      s.weight::numeric as weight,
      s.reps::numeric as reps
    from target_session ts
    join public.workout_exercises we
      on we.session_id = ts.id
    join public.sets s
      on s.workout_exercise_id = we.id
    where coalesce(s.is_warmup, false) = false
      and s.weight is not null
      and s.weight > 0
      and s.reps is not null
      and s.reps > 0
  ),
  current_metrics as (
    select
      exercise_id,
      max(weight) as max_weight,
      max(weight * (1 + reps / 30.0)) as max_estimated_1rm,
      max(weight * reps) as max_set_volume
    from current_sets
    group by exercise_id
  ),
  historic_sets as (
    select
      we.exercise_id,
      s.weight::numeric as weight,
      s.reps::numeric as reps
    from target_session ts
    join public.workout_sessions ws
      on ws.user_id = ts.user_id
    join public.workout_exercises we
      on we.session_id = ws.id
    join public.sets s
      on s.workout_exercise_id = we.id
    where coalesce(s.is_warmup, false) = false
      and s.weight is not null
      and s.weight > 0
      and s.reps is not null
      and s.reps > 0
      and we.exercise_id in (select exercise_id from current_metrics)
      and (
        ws.date < ts.date
        or (ws.date = ts.date and ws.created_at < ts.created_at)
      )
  ),
  historic_metrics as (
    select
      exercise_id,
      max(weight) as max_weight,
      max(weight * (1 + reps / 30.0)) as max_estimated_1rm,
      max(weight * reps) as max_set_volume
    from historic_sets
    group by exercise_id
  ),
  per_exercise_records as (
    select
      cm.exercise_id,
      (
        case
          when hm.max_weight is null then 1
          when cm.max_weight > hm.max_weight then 1
          else 0
        end
        +
        case
          when hm.max_estimated_1rm is null then 1
          when cm.max_estimated_1rm > hm.max_estimated_1rm then 1
          else 0
        end
        +
        case
          when hm.max_set_volume is null then 1
          when cm.max_set_volume > hm.max_set_volume then 1
          else 0
        end
      )::integer as record_count
    from current_metrics cm
    left join historic_metrics hm
      on hm.exercise_id = cm.exercise_id
  )
  select coalesce(sum(record_count), 0)::integer
  from per_exercise_records;
$$;

create or replace function public.refresh_workout_record_count(
  p_session_id uuid
)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_record_count integer;
begin
  select public.calculate_workout_record_count(p_session_id)
    into v_record_count;

  update public.workout_sessions
  set record_count = coalesce(v_record_count, 0)
  where id = p_session_id;

  if not found then
    raise exception 'workout session not found';
  end if;

  return coalesce(v_record_count, 0);
end;
$$;

grant execute on function public.calculate_workout_record_count(uuid) to authenticated, service_role;
grant execute on function public.refresh_workout_record_count(uuid) to authenticated, service_role;

update public.workout_sessions ws
set record_count = public.calculate_workout_record_count(ws.id);
