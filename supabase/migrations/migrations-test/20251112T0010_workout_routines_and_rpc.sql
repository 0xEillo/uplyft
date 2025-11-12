-- Workout routine schema and RPC to instantiate sessions from templates

-- Core routine tables
create table if not exists public.workout_routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  notes text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workout_routine_exercises (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.workout_routines(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  order_index int not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unique_workout_routine_exercise_order unique (routine_id, order_index)
);

create table if not exists public.workout_routine_sets (
  id uuid primary key default gen_random_uuid(),
  routine_exercise_id uuid not null references public.workout_routine_exercises(id) on delete cascade,
  set_number int not null,
  reps_min int,
  reps_max int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reps_range_valid check (
    (reps_min is null and reps_max is null)
    or (
      reps_min is not null
      and reps_max is not null
      and reps_min > 0
      and reps_max >= reps_min
      and reps_max <= 100
    )
  ),
  constraint unique_workout_routine_set_order unique (routine_exercise_id, set_number)
);

-- Shared updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_timestamp_workout_routines
before update on public.workout_routines
for each row execute function public.set_updated_at();

create trigger set_timestamp_workout_routine_exercises
before update on public.workout_routine_exercises
for each row execute function public.set_updated_at();

create trigger set_timestamp_workout_routine_sets
before update on public.workout_routine_sets
for each row execute function public.set_updated_at();

-- Helpful indexes
create index if not exists idx_workout_routines_user on public.workout_routines(user_id);
create index if not exists idx_workout_routine_exercises_routine on public.workout_routine_exercises(routine_id, order_index);
create index if not exists idx_workout_routine_sets_exercise on public.workout_routine_sets(routine_exercise_id, set_number);

-- Enable RLS and owner-only policies
alter table public.workout_routines enable row level security;
alter table public.workout_routine_exercises enable row level security;
alter table public.workout_routine_sets enable row level security;

create policy workout_routines_select on public.workout_routines
  for select
  using (user_id = auth.uid());

create policy workout_routines_insert on public.workout_routines
  for insert
  with check (user_id = auth.uid());

create policy workout_routines_update on public.workout_routines
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy workout_routines_delete on public.workout_routines
  for delete
  using (user_id = auth.uid());

create policy workout_routine_exercises_select on public.workout_routine_exercises
  for select
  using (exists (
    select 1
    from public.workout_routines r
    where r.id = routine_id
      and r.user_id = auth.uid()
  ));

create policy workout_routine_exercises_insert on public.workout_routine_exercises
  for insert
  with check (exists (
    select 1
    from public.workout_routines r
    where r.id = routine_id
      and r.user_id = auth.uid()
  ));

create policy workout_routine_exercises_update on public.workout_routine_exercises
  for update
  using (exists (
    select 1
    from public.workout_routines r
    where r.id = routine_id
      and r.user_id = auth.uid()
  ))
  with check (exists (
    select 1
    from public.workout_routines r
    where r.id = routine_id
      and r.user_id = auth.uid()
  ));

create policy workout_routine_exercises_delete on public.workout_routine_exercises
  for delete
  using (exists (
    select 1
    from public.workout_routines r
    where r.id = routine_id
      and r.user_id = auth.uid()
  ));

create policy workout_routine_sets_select on public.workout_routine_sets
  for select
  using (exists (
    select 1
    from public.workout_routine_exercises e
    join public.workout_routines r on r.id = e.routine_id
    where e.id = routine_exercise_id
      and r.user_id = auth.uid()
  ));

create policy workout_routine_sets_insert on public.workout_routine_sets
  for insert
  with check (exists (
    select 1
    from public.workout_routine_exercises e
    join public.workout_routines r on r.id = e.routine_id
    where e.id = routine_exercise_id
      and r.user_id = auth.uid()
  ));

create policy workout_routine_sets_update on public.workout_routine_sets
  for update
  using (exists (
    select 1
    from public.workout_routine_exercises e
    join public.workout_routines r on r.id = e.routine_id
    where e.id = routine_exercise_id
      and r.user_id = auth.uid()
  ))
  with check (exists (
    select 1
    from public.workout_routine_exercises e
    join public.workout_routines r on r.id = e.routine_id
    where e.id = routine_exercise_id
      and r.user_id = auth.uid()
  ));

create policy workout_routine_sets_delete on public.workout_routine_sets
  for delete
  using (exists (
    select 1
    from public.workout_routine_exercises e
    join public.workout_routines r on r.id = e.routine_id
    where e.id = routine_exercise_id
      and r.user_id = auth.uid()
  ));

grant select, insert, update, delete on public.workout_routines to authenticated;
grant select, insert, update, delete on public.workout_routine_exercises to authenticated;
grant select, insert, update, delete on public.workout_routine_sets to authenticated;

-- Initial RPC to copy routines into sessions
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

  insert into public.workout_sessions (user_id, date, notes, type)
  values (v_user_id, p_date, p_notes, coalesce(p_type, 'routine'))
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

revoke all on function public.create_workout_from_routine(uuid, timestamptz, text, text) from public;
grant execute on function public.create_workout_from_routine(uuid, timestamptz, text, text) to authenticated;

-- Link sessions back to routines
alter table public.workout_sessions
  add column routine_id uuid references public.workout_routines(id) on delete set null;

create index idx_workout_sessions_routine_id on public.workout_sessions(routine_id);
create index idx_workout_sessions_user_routine_date on public.workout_sessions(user_id, routine_id, date desc);

-- Final RPC version stores routine_id when generating sessions
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

grant execute on function public.create_workout_from_routine(uuid, timestamptz, text, text) to authenticated;

