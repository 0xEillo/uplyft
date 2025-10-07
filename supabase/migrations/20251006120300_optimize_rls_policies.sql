-- Optimize RLS policies to prevent auth.uid() re-evaluation on each row
-- Replace auth.uid() with (select auth.uid()) for better performance

-- ============================================================================
-- EXERCISES TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can insert their own exercises" ON exercises;
CREATE POLICY "Users can insert their own exercises"
  ON exercises FOR INSERT
  WITH CHECK ((select auth.uid()) = created_by);

DROP POLICY IF EXISTS "Users can update their own exercises" ON exercises;
CREATE POLICY "Users can update their own exercises"
  ON exercises FOR UPDATE
  USING ((select auth.uid()) = created_by);

DROP POLICY IF EXISTS "Users can delete their own exercises" ON exercises;
CREATE POLICY "Users can delete their own exercises"
  ON exercises FOR DELETE
  USING ((select auth.uid()) = created_by);

-- ============================================================================
-- WORKOUT_SESSIONS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own workout sessions" ON workout_sessions;
CREATE POLICY "Users can view their own workout sessions"
  ON workout_sessions FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own workout sessions" ON workout_sessions;
CREATE POLICY "Users can insert their own workout sessions"
  ON workout_sessions FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own workout sessions" ON workout_sessions;
CREATE POLICY "Users can update their own workout sessions"
  ON workout_sessions FOR UPDATE
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own workout sessions" ON workout_sessions;
CREATE POLICY "Users can delete their own workout sessions"
  ON workout_sessions FOR DELETE
  USING ((select auth.uid()) = user_id);

-- ============================================================================
-- WORKOUT_EXERCISES TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can view workout exercises from their sessions" ON workout_exercises;
CREATE POLICY "Users can view workout exercises from their sessions"
  ON workout_exercises FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workout_sessions
      WHERE workout_sessions.id = workout_exercises.session_id
      AND workout_sessions.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert workout exercises to their sessions" ON workout_exercises;
CREATE POLICY "Users can insert workout exercises to their sessions"
  ON workout_exercises FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_sessions
      WHERE workout_sessions.id = workout_exercises.session_id
      AND workout_sessions.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update workout exercises from their sessions" ON workout_exercises;
CREATE POLICY "Users can update workout exercises from their sessions"
  ON workout_exercises FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workout_sessions
      WHERE workout_sessions.id = workout_exercises.session_id
      AND workout_sessions.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete workout exercises from their sessions" ON workout_exercises;
CREATE POLICY "Users can delete workout exercises from their sessions"
  ON workout_exercises FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workout_sessions
      WHERE workout_sessions.id = workout_exercises.session_id
      AND workout_sessions.user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- SETS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can view sets from their workout exercises" ON sets;
CREATE POLICY "Users can view sets from their workout exercises"
  ON sets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workout_exercises
      JOIN workout_sessions ON workout_sessions.id = workout_exercises.session_id
      WHERE workout_exercises.id = sets.workout_exercise_id
      AND workout_sessions.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert sets to their workout exercises" ON sets;
CREATE POLICY "Users can insert sets to their workout exercises"
  ON sets FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_exercises
      JOIN workout_sessions ON workout_sessions.id = workout_exercises.session_id
      WHERE workout_exercises.id = sets.workout_exercise_id
      AND workout_sessions.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update sets from their workout exercises" ON sets;
CREATE POLICY "Users can update sets from their workout exercises"
  ON sets FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workout_exercises
      JOIN workout_sessions ON workout_sessions.id = workout_exercises.session_id
      WHERE workout_exercises.id = sets.workout_exercise_id
      AND workout_sessions.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete sets from their workout exercises" ON sets;
CREATE POLICY "Users can delete sets from their workout exercises"
  ON sets FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workout_exercises
      JOIN workout_sessions ON workout_sessions.id = workout_exercises.session_id
      WHERE workout_exercises.id = sets.workout_exercise_id
      AND workout_sessions.user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- PROFILES TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can delete their own profile" ON profiles;
CREATE POLICY "Users can delete their own profile"
  ON profiles FOR DELETE
  USING ((select auth.uid()) = id);
