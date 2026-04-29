-- Notify users when someone they follow posts a workout.

ALTER TABLE retention_push_preferences
  ADD COLUMN IF NOT EXISTS followed_workout_posts_enabled BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check CHECK (
    type IN (
      'workout_like',
      'workout_comment',
      'workout_comment_reply',
      'workout_comment_like',
      'followed_workout_post',
      'follow_request_received',
      'follow_request_approved',
      'follow_request_declined',
      'follow_received',
      'trial_reminder',
      'retention_scheduled_workout',
      'retention_streak_protection',
      'retention_inactivity',
      'retention_weekly_recap',
      'retention_milestone'
    )
  );

CREATE OR REPLACE FUNCTION public.notify_followers_of_workout_post()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO notifications (
    recipient_id,
    type,
    workout_id,
    actors,
    metadata,
    created_at,
    updated_at,
    read
  )
  SELECT
    f.follower_id,
    'followed_workout_post',
    NEW.id,
    ARRAY[NEW.user_id],
    jsonb_build_object(
      'workout_id', NEW.id::text,
      'poster_id', NEW.user_id::text
    ),
    NOW(),
    NOW(),
    FALSE
  FROM follows f
  JOIN retention_push_preferences rpp
    ON rpp.user_id = f.follower_id
  JOIN profiles follower
    ON follower.id = f.follower_id
  WHERE f.followee_id = NEW.user_id
    AND f.follower_id <> NEW.user_id
    AND rpp.enabled = TRUE
    AND rpp.followed_workout_posts_enabled = TRUE
    AND follower.expo_push_token IS NOT NULL
  ON CONFLICT (recipient_id, workout_id, type)
  DO UPDATE SET
    actors = EXCLUDED.actors,
    metadata = EXCLUDED.metadata,
    updated_at = NOW(),
    read = FALSE;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS workout_sessions_notify_followers_on_insert ON workout_sessions;
CREATE TRIGGER workout_sessions_notify_followers_on_insert
  AFTER INSERT ON workout_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_followers_of_workout_post();
