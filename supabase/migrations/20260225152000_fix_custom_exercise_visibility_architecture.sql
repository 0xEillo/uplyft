-- Keep exercises search/select scoped to owner+global, while allowing social/routine display via scoped RPCs

-- 1) Restore strict exercise visibility for direct table reads/search (prevents leakage into select-exercise)
drop policy if exists "Exercises visible to owners, global, or via followed routines" on public.exercises;
drop policy if exists "Exercises visible to owners or global" on public.exercises;

create policy "Exercises visible to owners or global"
  on public.exercises for select
  using (
    created_by is null
    or created_by = (select auth.uid())
  );

-- 2) Provide follower-safe exercise details for routine views without broadening exercises SELECT
drop function if exists public.get_visible_workout_routine_exercise_exercise_details(uuid[]);

create or replace function public.get_visible_workout_routine_exercise_exercise_details(
  p_workout_routine_exercise_ids uuid[]
)
returns table (
  workout_routine_exercise_id uuid,
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
    wre.id as workout_routine_exercise_id,
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
  from public.workout_routine_exercises wre
  join public.workout_routines wr
    on wr.id = wre.routine_id
  join public.exercises e
    on e.id = wre.exercise_id
  where coalesce(array_length(p_workout_routine_exercise_ids, 1), 0) > 0
    and wre.id = any(p_workout_routine_exercise_ids)
    and (
      wr.user_id = auth.uid()
      or exists (
        select 1
        from public.follows f
        where f.follower_id = auth.uid()
          and f.followee_id = wr.user_id
      )
    );
$$;

-- 3) When logging a routine, clone foreign custom exercises into the current user's library
drop function if exists public.resolve_exercise_for_routine_log(uuid, uuid, uuid);

create or replace function public.resolve_exercise_for_routine_log(
  p_source_exercise_id uuid,
  p_user_id uuid,
  p_routine_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source public.exercises%rowtype;
  v_existing_id uuid;
  v_new_id uuid;
begin
  if p_user_id is null then
    raise exception 'p_user_id is null';
  end if;

  if p_user_id <> auth.uid() then
    raise exception 'not authorized';
  end if;

  if not exists (
    select 1
    from public.workout_routines wr
    join public.workout_routine_exercises wre on wre.routine_id = wr.id
    where wr.id = p_routine_id
      and wr.user_id = p_user_id
      and wre.exercise_id = p_source_exercise_id
  ) then
    raise exception 'exercise is not part of an owned routine';
  end if;

  select *
    into v_source
  from public.exercises
  where id = p_source_exercise_id;

  if not found then
    raise exception 'source exercise not found: %', p_source_exercise_id;
  end if;

  -- System exercises and the user's own exercises can be reused directly
  if v_source.created_by is null or v_source.created_by = p_user_id then
    return v_source.id;
  end if;

  -- Reuse an existing exercise owned by the user with the same name to avoid duplicates
  select e.id
    into v_existing_id
  from public.exercises e
  where e.created_by = p_user_id
    and lower(e.name) = lower(v_source.name)
  order by e.created_at asc
  limit 1;

  if v_existing_id is not null then
    return v_existing_id;
  end if;

  begin
    insert into public.exercises (
      name,
      muscle_group,
      type,
      equipment,
      created_by,
      aliases,
      exercise_id,
      gif_url,
      target_muscles,
      body_parts,
      equipments,
      secondary_muscles,
      instructions
    )
    values (
      v_source.name,
      v_source.muscle_group,
      v_source.type,
      v_source.equipment,
      p_user_id,
      v_source.aliases,
      v_source.exercise_id,
      v_source.gif_url,
      v_source.target_muscles,
      v_source.body_parts,
      v_source.equipments,
      v_source.secondary_muscles,
      v_source.instructions
    )
    returning id into v_new_id;

    return v_new_id;
  exception when unique_violation then
    select e.id
      into v_existing_id
    from public.exercises e
    where e.created_by = p_user_id
      and lower(e.name) = lower(v_source.name)
    order by e.created_at asc
    limit 1;

    if v_existing_id is not null then
      return v_existing_id;
    end if;

    raise;
  end;
end;
$$;

-- 4) Update routine -> workout RPC to resolve each exercise into the current user's usable exercise set
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

  insert into public.workout_sessions (user_id, date, notes, type, routine_id)
  values (v_user_id, p_date, p_notes, coalesce(p_type, 'routine'), p_routine_id)
  returning id into v_session_id;

  with routine_exercises as (
    select
      id as routine_exercise_id,
      public.resolve_exercise_for_routine_log(exercise_id, v_user_id, p_routine_id) as exercise_id,
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
    select
      re.routine_exercise_id,
      ie.id as workout_exercise_id
    from routine_exercises re
    join inserted_exercises ie using (order_index)
  )
  insert into public.sets (workout_exercise_id, set_number, reps)
  select
    em.workout_exercise_id,
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
