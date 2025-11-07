-- Update RPC function to store routine_id when creating workout from routine

create or replace function public.create_workout_from_routine(
  p_routine_id uuid,
  p_date timestamptz default now(),
  p_notes text default null,
  p_type text default 'routine'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_user_id uuid := auth.uid();
  v_exists boolean;
begin
  if v_user_id is null then
    raise exception 'auth.uid() is null';
  end if;

  select true
    into v_exists
  from public.workout_routines r
  where r.id = p_routine_id
    and r.user_id = v_user_id
  limit 1;

  if not coalesce(v_exists, false) then
    raise exception 'not authorized or routine not found';
  end if;

  -- Store routine_id when creating the workout session
  insert into public.workout_sessions (user_id, date, notes, type, routine_id)
  values (v_user_id, p_date, p_notes, coalesce(p_type, 'routine'), p_routine_id)
  returning id into v_session_id;

  with routine_exercises as (
    select id as routine_exercise_id,
           exercise_id,
           order_index,
           notes
    from public.workout_routine_exercises
    where routine_id = p_routine_id
    order by order_index
  ), inserted_exercises as (
    insert into public.workout_exercises (session_id, exercise_id, order_index, notes)
    select v_session_id, exercise_id, order_index, notes
    from routine_exercises
    returning id, order_index
  ), exercise_map as (
    select re.routine_exercise_id,
           ie.id as workout_exercise_id
    from routine_exercises re
    join inserted_exercises ie using (order_index)
  )
  insert into public.sets (workout_exercise_id, set_number, reps)
  select em.workout_exercise_id,
         rs.set_number,
         case
           when rs.reps_min is not null and rs.reps_min = rs.reps_max then rs.reps_min
           else null
         end as reps
  from public.workout_routine_sets rs
  join exercise_map em on em.routine_exercise_id = rs.routine_exercise_id
  order by em.workout_exercise_id, rs.set_number;

  return v_session_id;
end;
$$;
