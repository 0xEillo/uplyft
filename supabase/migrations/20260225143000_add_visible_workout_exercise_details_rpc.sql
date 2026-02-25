-- Provide follower-safe exercise details for workout views when custom exercises are hidden by exercises RLS

drop function if exists public.get_visible_workout_exercise_exercise_details(uuid[]);

create or replace function public.get_visible_workout_exercise_exercise_details(
  p_workout_exercise_ids uuid[]
)
returns table (
  workout_exercise_id uuid,
  id uuid,
  name text,
  muscle_group text,
  type text,
  equipment text,
  created_by uuid,
  created_at timestamptz,
  aliases text[],
  exercise_id text,
  gif_url text,
  target_muscles text[],
  body_parts text[],
  equipments text[],
  secondary_muscles text[],
  instructions text[]
)
language sql
stable
security definer
set search_path = public
as $$
  select
    we.id as workout_exercise_id,
    e.id,
    e.name,
    e.muscle_group,
    e.type,
    e.equipment,
    e.created_by,
    e.created_at,
    e.aliases,
    e.exercise_id,
    e.gif_url,
    e.target_muscles,
    e.body_parts,
    e.equipments,
    e.secondary_muscles,
    e.instructions
  from public.workout_exercises we
  join public.workout_sessions ws
    on ws.id = we.session_id
  join public.exercises e
    on e.id = we.exercise_id
  where coalesce(array_length(p_workout_exercise_ids, 1), 0) > 0
    and we.id = any(p_workout_exercise_ids)
    and public.can_view_user_content(ws.user_id);
$$;
