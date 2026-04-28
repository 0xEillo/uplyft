-- Lightweight aggregate for the home screen weekly snapshot.

drop function if exists public.get_weekly_progress_stats(uuid, timestamptz, timestamptz, timestamptz);

create or replace function public.get_weekly_progress_stats(
  p_user_id uuid,
  p_previous_week_start timestamptz,
  p_current_week_start timestamptz,
  p_end timestamptz
)
returns table (
  period text,
  workout_count integer,
  duration_seconds integer,
  volume_kg numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with visible_sessions as (
    select
      ws.id,
      ws.date,
      ws.duration
    from public.workout_sessions ws
    where ws.user_id = p_user_id
      and ws.user_id = auth.uid()
      and ws.is_processing = false
      and ws.date >= p_previous_week_start
      and ws.date <= p_end
  ),
  session_sets as (
    select
      vs.id as session_id,
      vs.date,
      vs.duration,
      count(s.id)::integer as set_count,
      coalesce(
        sum(
          case
            when coalesce(s.reps, 0) > 0 then
              greatest(coalesce(s.weight, 1), 1) * s.reps
            else 0
          end
        ),
        0
      ) as volume_kg
    from visible_sessions vs
    left join public.workout_exercises we
      on we.session_id = vs.id
    left join public.sets s
      on s.workout_exercise_id = we.id
    group by vs.id, vs.date, vs.duration
  ),
  session_stats as (
    select
      case
        when date >= p_current_week_start then 'current'
        else 'previous'
      end as period,
      coalesce(duration, ((set_count * 3 + 2) * 60))::integer as duration_seconds,
      volume_kg
    from session_sets
  ),
  periods as (
    select 'current'::text as period
    union all
    select 'previous'::text as period
  )
  select
    periods.period,
    coalesce(count(session_stats.period), 0)::integer as workout_count,
    coalesce(sum(session_stats.duration_seconds), 0)::integer as duration_seconds,
    coalesce(sum(session_stats.volume_kg), 0)::numeric as volume_kg
  from periods
  left join session_stats
    on session_stats.period = periods.period
  group by periods.period
  order by periods.period;
$$;

revoke all on function public.get_weekly_progress_stats(uuid, timestamptz, timestamptz, timestamptz) from public;
grant execute on function public.get_weekly_progress_stats(uuid, timestamptz, timestamptz, timestamptz) to authenticated;
