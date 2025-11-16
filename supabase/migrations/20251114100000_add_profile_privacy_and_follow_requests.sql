-- Add privacy controls to profiles and gate social content behind approvals

-- 1. Profiles: add privacy flag (default public) and supporting index
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_profiles_is_private
  ON profiles(is_private)
  WHERE is_private = TRUE;

-- Helper to determine if the current viewer can see a target user's content
CREATE OR REPLACE FUNCTION public.can_view_user_content(target_user UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT
    target_user IS NOT NULL
    AND (
      target_user = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM profiles p
        WHERE p.id = target_user
          AND p.is_private = FALSE
      )
      OR EXISTS (
        SELECT 1
        FROM follows f
        WHERE f.follower_id = auth.uid()
          AND f.followee_id = target_user
      )
    );
$$;

COMMENT ON FUNCTION public.can_view_user_content
IS 'Returns true when the current auth.uid() can view the specified user''s social content.';

-- 2. Follow requests table (Strava-style follow approvals)
CREATE TABLE IF NOT EXISTS follow_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  followee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'declined', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  CONSTRAINT follow_requests_no_self_follow CHECK (follower_id <> followee_id)
);

CREATE INDEX IF NOT EXISTS idx_follow_requests_follower
  ON follow_requests(follower_id, status);

CREATE INDEX IF NOT EXISTS idx_follow_requests_followee_pending
  ON follow_requests(followee_id)
  WHERE status = 'pending';

ALTER TABLE follow_requests
  ADD CONSTRAINT follow_requests_unique_pair
    UNIQUE (follower_id, followee_id);

ALTER TABLE follow_requests ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS follow_requests_set_updated_at ON follow_requests;
CREATE TRIGGER follow_requests_set_updated_at
  BEFORE UPDATE ON follow_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP POLICY IF EXISTS "Follow requests selectable by participants" ON follow_requests;
CREATE POLICY "Follow requests selectable by participants"
  ON follow_requests
  FOR SELECT
  USING (auth.uid() IN (follower_id, followee_id));

DROP POLICY IF EXISTS "Follow requests insertable by follower" ON follow_requests;
CREATE POLICY "Follow requests insertable by follower"
  ON follow_requests
  FOR INSERT
  WITH CHECK (auth.uid() = follower_id AND follower_id <> followee_id);

DROP POLICY IF EXISTS "Follow requests updatable by participants" ON follow_requests;
CREATE POLICY "Follow requests updatable by participants"
  ON follow_requests
  FOR UPDATE
  USING (auth.uid() IN (follower_id, followee_id))
  WITH CHECK (auth.uid() IN (follower_id, followee_id));

DROP POLICY IF EXISTS "Follow requests deletable by participants" ON follow_requests;
CREATE POLICY "Follow requests deletable by participants"
  ON follow_requests
  FOR DELETE
  USING (auth.uid() IN (follower_id, followee_id));

-- 3. RLS updates for social tables to honor privacy flag

-- Workouts
DROP POLICY IF EXISTS "Users can view workouts from followed users" ON workout_sessions;
CREATE POLICY "Users can view workouts when permitted"
  ON workout_sessions
  FOR SELECT
  USING (public.can_view_user_content(user_id));

-- Workout exercises
DROP POLICY IF EXISTS "Users can view workout exercises from followed users" ON workout_exercises;
CREATE POLICY "Users can view workout exercises when permitted"
  ON workout_exercises
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM workout_sessions ws
      WHERE ws.id = workout_exercises.session_id
        AND public.can_view_user_content(ws.user_id)
    )
  );

-- Sets
DROP POLICY IF EXISTS "Users can view sets from followed users" ON sets;
CREATE POLICY "Users can view sets when permitted"
  ON sets
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM workout_exercises we
      JOIN workout_sessions ws ON ws.id = we.session_id
      WHERE we.id = sets.workout_exercise_id
        AND public.can_view_user_content(ws.user_id)
    )
  );

-- Workout likes
DROP POLICY IF EXISTS "Workout likes are viewable by everyone" ON workout_likes;
CREATE POLICY "Workout likes visible when workout is viewable"
  ON workout_likes
  FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1
      FROM workout_sessions ws
      WHERE ws.id = workout_likes.workout_id
        AND public.can_view_user_content(ws.user_id)
    )
  );

-- Workout comments
DROP POLICY IF EXISTS "Workout comments are viewable by everyone" ON workout_comments;
CREATE POLICY "Workout comments visible when workout is viewable"
  ON workout_comments
  FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1
      FROM workout_sessions ws
      WHERE ws.id = workout_comments.workout_id
        AND public.can_view_user_content(ws.user_id)
    )
  );

