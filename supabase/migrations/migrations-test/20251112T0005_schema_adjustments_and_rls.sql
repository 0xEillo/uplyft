-- Schema tweaks and RLS optimizations

-- Remove unused duration/rest_time fields
alter table workout_sessions drop column if exists duration;
alter table sets drop column if exists rest_time;

-- workout_exercises no longer needs a type column
alter table workout_exercises drop column if exists type;

-- Allow logging sets without reps (e.g. tempo or AMRAP markers)
alter table sets
  alter column reps drop not null;

-- Optimize RLS policies to avoid repeated auth.uid() evaluation

-- ============================================================================
-- EXERCISES TABLE
-- ============================================================================

drop policy if exists "Users can insert their own exercises" on exercises;
create policy "Users can insert their own exercises"
  on exercises for insert
  with check ((select auth.uid()) = created_by);

drop policy if exists "Users can update their own exercises" on exercises;
create policy "Users can update their own exercises"
  on exercises for update
  using ((select auth.uid()) = created_by);

drop policy if exists "Users can delete their own exercises" on exercises;
create policy "Users can delete their own exercises"
  on exercises for delete
  using ((select auth.uid()) = created_by);

-- ============================================================================
-- WORKOUT_SESSIONS TABLE
-- ============================================================================

drop policy if exists "Users can view their own workout sessions" on workout_sessions;
create policy "Users can view their own workout sessions"
  on workout_sessions for select
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own workout sessions" on workout_sessions;
create policy "Users can insert their own workout sessions"
  on workout_sessions for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own workout sessions" on workout_sessions;
create policy "Users can update their own workout sessions"
  on workout_sessions for update
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own workout sessions" on workout_sessions;
create policy "Users can delete their own workout sessions"
  on workout_sessions for delete
  using ((select auth.uid()) = user_id);

-- ============================================================================
-- WORKOUT_EXERCISES TABLE
-- ============================================================================

drop policy if exists "Users can view workout exercises from their sessions" on workout_exercises;
create policy "Users can view workout exercises from their sessions"
  on workout_exercises for select
  using (
    exists (
      select 1 from workout_sessions
      where workout_sessions.id = workout_exercises.session_id
        and workout_sessions.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users can insert workout exercises to their sessions" on workout_exercises;
create policy "Users can insert workout exercises to their sessions"
  on workout_exercises for insert
  with check (
    exists (
      select 1 from workout_sessions
      where workout_sessions.id = workout_exercises.session_id
        and workout_sessions.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users can update workout exercises from their sessions" on workout_exercises;
create policy "Users can update workout exercises from their sessions"
  on workout_exercises for update
  using (
    exists (
      select 1 from workout_sessions
      where workout_sessions.id = workout_exercises.session_id
        and workout_sessions.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users can delete workout exercises from their sessions" on workout_exercises;
create policy "Users can delete workout exercises from their sessions"
  on workout_exercises for delete
  using (
    exists (
      select 1 from workout_sessions
      where workout_sessions.id = workout_exercises.session_id
        and workout_sessions.user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- SETS TABLE
-- ============================================================================

drop policy if exists "Users can view sets from their workout exercises" on sets;
create policy "Users can view sets from their workout exercises"
  on sets for select
  using (
    exists (
      select 1 from workout_exercises
      join workout_sessions on workout_sessions.id = workout_exercises.session_id
      where workout_exercises.id = sets.workout_exercise_id
        and workout_sessions.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users can insert sets to their workout exercises" on sets;
create policy "Users can insert sets to their workout exercises"
  on sets for insert
  with check (
    exists (
      select 1 from workout_exercises
      join workout_sessions on workout_sessions.id = workout_exercises.session_id
      where workout_exercises.id = sets.workout_exercise_id
        and workout_sessions.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users can update sets from their workout exercises" on sets;
create policy "Users can update sets from their workout exercises"
  on sets for update
  using (
    exists (
      select 1 from workout_exercises
      join workout_sessions on workout_sessions.id = workout_exercises.session_id
      where workout_exercises.id = sets.workout_exercise_id
        and workout_sessions.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users can delete sets from their workout exercises" on sets;
create policy "Users can delete sets from their workout exercises"
  on sets for delete
  using (
    exists (
      select 1 from workout_exercises
      join workout_sessions on workout_sessions.id = workout_exercises.session_id
      where workout_exercises.id = sets.workout_exercise_id
        and workout_sessions.user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- PROFILES TABLE
-- ============================================================================

drop policy if exists "Users can insert their own profile" on profiles;
create policy "Users can insert their own profile"
  on profiles for insert
  with check ((select auth.uid()) = id);

drop policy if exists "Users can update their own profile" on profiles;
create policy "Users can update their own profile"
  on profiles for update
  using ((select auth.uid()) = id);

drop policy if exists "Users can delete their own profile" on profiles;
create policy "Users can delete their own profile"
  on profiles for delete
  using ((select auth.uid()) = id);

