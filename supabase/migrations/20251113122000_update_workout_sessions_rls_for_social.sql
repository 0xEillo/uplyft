-- Update workout_sessions RLS to allow viewing workouts from followed users
-- This enables the social feed feature

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Users can view their own workout sessions" ON workout_sessions;

-- Create new policy: users can view their own workouts AND workouts from users they follow
CREATE POLICY "Users can view workouts from followed users"
  ON workout_sessions
  FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1
      FROM follows
      WHERE follows.follower_id = auth.uid()
        AND follows.followee_id = workout_sessions.user_id
    )
  );

-- Similarly update workout_exercises policy
DROP POLICY IF EXISTS "Users can view workout exercises from their sessions" ON workout_exercises;

CREATE POLICY "Users can view workout exercises from followed users"
  ON workout_exercises
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM workout_sessions ws
      WHERE ws.id = workout_exercises.session_id
        AND (
          ws.user_id = auth.uid() OR
          EXISTS (
            SELECT 1
            FROM follows
            WHERE follows.follower_id = auth.uid()
              AND follows.followee_id = ws.user_id
          )
        )
    )
  );

-- Similarly update sets policy
DROP POLICY IF EXISTS "Users can view sets from their workout exercises" ON sets;

CREATE POLICY "Users can view sets from followed users"
  ON sets
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM workout_exercises we
      JOIN workout_sessions ws ON ws.id = we.session_id
      WHERE we.id = sets.workout_exercise_id
        AND (
          ws.user_id = auth.uid() OR
          EXISTS (
            SELECT 1
            FROM follows
            WHERE follows.follower_id = auth.uid()
              AND follows.followee_id = ws.user_id
          )
        )
    )
  );
