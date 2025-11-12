-- Enable required extensions and core workout schema
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- Compatibility shim: define uuid_generate_v4() if missing
do $$
begin
  if not exists (
    select 1 from pg_proc where proname = 'uuid_generate_v4'
  ) then
    create or replace function uuid_generate_v4()
    returns uuid
    as $fn$
      select gen_random_uuid()
    $fn$
    language sql volatile;
  end if;
end
$$;

-- Exercises table
create table exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  muscle_group text,
  type text,
  equipment text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

-- Workout sessions table
create table workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date timestamptz default now(),
  raw_text text,
  duration integer,
  notes text,
  type text,
  created_at timestamptz default now()
);

-- Workout exercises table
create table workout_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references workout_sessions(id) on delete cascade,
  exercise_id uuid not null references exercises(id) on delete cascade,
  order_index integer not null,
  type text,
  notes text,
  created_at timestamptz default now()
);

-- Sets table
create table sets (
  id uuid primary key default gen_random_uuid(),
  workout_exercise_id uuid not null references workout_exercises(id) on delete cascade,
  set_number integer not null,
  reps integer not null,
  weight float,
  rest_time integer,
  rpe float,
  notes text,
  created_at timestamptz default now()
);

-- Indexes
create index idx_workout_sessions_user_id on workout_sessions(user_id);
create index idx_workout_sessions_date on workout_sessions(date);
create index idx_workout_exercises_session_id on workout_exercises(session_id);
create index idx_workout_exercises_exercise_id on workout_exercises(exercise_id);
create index idx_sets_workout_exercise_id on sets(workout_exercise_id);
create index idx_exercises_name on exercises(name);

-- Enable row level security
alter table exercises enable row level security;
alter table workout_sessions enable row level security;
alter table workout_exercises enable row level security;
alter table sets enable row level security;

-- Exercises policies
create policy "Exercises are viewable by everyone"
  on exercises for select
  using (true);

create policy "Users can insert their own exercises"
  on exercises for insert
  with check (auth.uid() = created_by);

create policy "Users can update their own exercises"
  on exercises for update
  using (auth.uid() = created_by);

create policy "Users can delete their own exercises"
  on exercises for delete
  using (auth.uid() = created_by);

-- Workout sessions policies
create policy "Users can view their own workout sessions"
  on workout_sessions for select
  using (auth.uid() = user_id);

create policy "Users can insert their own workout sessions"
  on workout_sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own workout sessions"
  on workout_sessions for update
  using (auth.uid() = user_id);

create policy "Users can delete their own workout sessions"
  on workout_sessions for delete
  using (auth.uid() = user_id);

-- Workout exercises policies
create policy "Users can view workout exercises from their sessions"
  on workout_exercises for select
  using (
    exists (
      select 1 from workout_sessions
      where workout_sessions.id = workout_exercises.session_id
        and workout_sessions.user_id = auth.uid()
    )
  );

create policy "Users can insert workout exercises to their sessions"
  on workout_exercises for insert
  with check (
    exists (
      select 1 from workout_sessions
      where workout_sessions.id = workout_exercises.session_id
        and workout_sessions.user_id = auth.uid()
    )
  );

create policy "Users can update workout exercises from their sessions"
  on workout_exercises for update
  using (
    exists (
      select 1 from workout_sessions
      where workout_sessions.id = workout_exercises.session_id
        and workout_sessions.user_id = auth.uid()
    )
  );

create policy "Users can delete workout exercises from their sessions"
  on workout_exercises for delete
  using (
    exists (
      select 1 from workout_sessions
      where workout_sessions.id = workout_exercises.session_id
        and workout_sessions.user_id = auth.uid()
    )
  );

-- Sets policies
create policy "Users can view sets from their workout exercises"
  on sets for select
  using (
    exists (
      select 1 from workout_exercises
      join workout_sessions on workout_sessions.id = workout_exercises.session_id
      where workout_exercises.id = sets.workout_exercise_id
        and workout_sessions.user_id = auth.uid()
    )
  );

create policy "Users can insert sets to their workout exercises"
  on sets for insert
  with check (
    exists (
      select 1 from workout_exercises
      join workout_sessions on workout_sessions.id = workout_exercises.session_id
      where workout_exercises.id = sets.workout_exercise_id
        and workout_sessions.user_id = auth.uid()
    )
  );

create policy "Users can update sets from their workout exercises"
  on sets for update
  using (
    exists (
      select 1 from workout_exercises
      join workout_sessions on workout_sessions.id = workout_exercises.session_id
      where workout_exercises.id = sets.workout_exercise_id
        and workout_sessions.user_id = auth.uid()
    )
  );

create policy "Users can delete sets from their workout exercises"
  on sets for delete
  using (
    exists (
      select 1 from workout_exercises
      join workout_sessions on workout_sessions.id = workout_exercises.session_id
      where workout_exercises.id = sets.workout_exercise_id
        and workout_sessions.user_id = auth.uid()
    )
  );

