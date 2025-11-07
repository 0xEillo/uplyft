-- Workout routines schema: routines, exercises, sets with optional rep ranges

-- 1) Base tables
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

-- 2) Timestamp trigger helper (shared across tables)
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

-- 3) Helpful indexes
create index if not exists idx_workout_routines_user on public.workout_routines(user_id);
create index if not exists idx_workout_routine_exercises_routine on public.workout_routine_exercises(routine_id, order_index);
create index if not exists idx_workout_routine_sets_exercise on public.workout_routine_sets(routine_exercise_id, set_number);

-- 4) Enable RLS
alter table public.workout_routines enable row level security;
alter table public.workout_routine_exercises enable row level security;
alter table public.workout_routine_sets enable row level security;

-- 5) Policies: owner-only access
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

-- 6) Grants for authenticated users (policies still enforce ownership)
grant select, insert, update, delete on public.workout_routines to authenticated;
grant select, insert, update, delete on public.workout_routine_exercises to authenticated;
grant select, insert, update, delete on public.workout_routine_sets to authenticated;

