-- Add push notification system for social interactions
-- Handles grouped notifications for likes and comments on workout posts

-- Add expo_push_token to profiles for storing device tokens
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS expo_push_token TEXT;

-- Create index for push token lookups
CREATE INDEX IF NOT EXISTS idx_profiles_expo_push_token
  ON profiles(expo_push_token)
  WHERE expo_push_token IS NOT NULL;

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('workout_like', 'workout_comment')),
  workout_id UUID NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  actors UUID[] NOT NULL DEFAULT '{}', -- Array of user IDs who liked/commented
  comment_preview TEXT, -- Latest comment text (nullable)
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Unique constraint for grouping: one notification per (recipient, type, workout)
  CONSTRAINT notifications_unique_key UNIQUE (recipient_id, type, workout_id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_workout_id ON notifications(workout_id);
CREATE INDEX IF NOT EXISTS idx_notifications_updated_at ON notifications(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read) WHERE read = FALSE;

-- Enable RLS on notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS policy: users can only see their own notifications
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
CREATE POLICY "Users can view their own notifications"
  ON notifications
  FOR SELECT
  USING (auth.uid() = recipient_id);

-- Trigger to keep updated_at in sync
DROP TRIGGER IF EXISTS notifications_set_updated_at ON notifications;
CREATE TRIGGER notifications_set_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Function to handle workout like notifications
CREATE OR REPLACE FUNCTION handle_workout_like_notification()
RETURNS TRIGGER AS $$
DECLARE
  workout_owner_id UUID;
BEGIN
  -- Get workout owner
  SELECT user_id INTO workout_owner_id
  FROM workout_sessions
  WHERE id = NEW.workout_id;

  -- Skip if user liked their own workout
  IF workout_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Upsert notification: add liker to actors array
  INSERT INTO notifications (recipient_id, type, workout_id, actors, created_at, updated_at)
  VALUES (workout_owner_id, 'workout_like', NEW.workout_id, ARRAY[NEW.user_id], NOW(), NOW())
  ON CONFLICT (recipient_id, type, workout_id)
  DO UPDATE SET
    actors = CASE
      WHEN NEW.user_id = ANY(notifications.actors) THEN notifications.actors
      ELSE array_append(notifications.actors, NEW.user_id)
    END,
    updated_at = NOW(),
    read = FALSE; -- Mark as unread when new actor added

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle workout unlike (remove from notification)
CREATE OR REPLACE FUNCTION handle_workout_unlike_notification()
RETURNS TRIGGER AS $$
DECLARE
  workout_owner_id UUID;
BEGIN
  -- Get workout owner
  SELECT user_id INTO workout_owner_id
  FROM workout_sessions
  WHERE id = OLD.workout_id;

  -- Remove user from actors array
  UPDATE notifications
  SET
    actors = array_remove(actors, OLD.user_id),
    updated_at = NOW()
  WHERE recipient_id = workout_owner_id
    AND type = 'workout_like'
    AND workout_id = OLD.workout_id;

  -- Delete notification if no actors left
  DELETE FROM notifications
  WHERE recipient_id = workout_owner_id
    AND type = 'workout_like'
    AND workout_id = OLD.workout_id
    AND array_length(actors, 1) IS NULL; -- Empty array

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle workout comment notifications
CREATE OR REPLACE FUNCTION handle_workout_comment_notification()
RETURNS TRIGGER AS $$
DECLARE
  workout_owner_id UUID;
  truncated_content TEXT;
BEGIN
  -- Get workout owner
  SELECT user_id INTO workout_owner_id
  FROM workout_sessions
  WHERE id = NEW.workout_id;

  -- Skip if user commented on their own workout
  IF workout_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Truncate comment to 100 chars for preview
  truncated_content := LEFT(NEW.content, 100);
  IF LENGTH(NEW.content) > 100 THEN
    truncated_content := truncated_content || '...';
  END IF;

  -- Upsert notification: add commenter to actors, update preview
  INSERT INTO notifications (recipient_id, type, workout_id, actors, comment_preview, created_at, updated_at)
  VALUES (workout_owner_id, 'workout_comment', NEW.workout_id, ARRAY[NEW.user_id], truncated_content, NOW(), NOW())
  ON CONFLICT (recipient_id, type, workout_id)
  DO UPDATE SET
    actors = CASE
      WHEN NEW.user_id = ANY(notifications.actors) THEN notifications.actors
      ELSE array_append(notifications.actors, NEW.user_id)
    END,
    comment_preview = truncated_content, -- Always update to latest comment
    updated_at = NOW(),
    read = FALSE;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle comment deletion (remove from notification)
CREATE OR REPLACE FUNCTION handle_workout_comment_delete_notification()
RETURNS TRIGGER AS $$
DECLARE
  workout_owner_id UUID;
  latest_comment TEXT;
BEGIN
  -- Get workout owner
  SELECT user_id INTO workout_owner_id
  FROM workout_sessions
  WHERE id = OLD.workout_id;

  -- Get the next most recent comment for preview (if exists)
  SELECT LEFT(content, 100) INTO latest_comment
  FROM workout_comments
  WHERE workout_id = OLD.workout_id
    AND id != OLD.id
  ORDER BY created_at DESC
  LIMIT 1;

  -- Add ellipsis if truncated
  IF latest_comment IS NOT NULL AND LENGTH(latest_comment) = 100 THEN
    latest_comment := latest_comment || '...';
  END IF;

  -- Remove user from actors array, update preview
  UPDATE notifications
  SET
    actors = array_remove(actors, OLD.user_id),
    comment_preview = latest_comment,
    updated_at = NOW()
  WHERE recipient_id = workout_owner_id
    AND type = 'workout_comment'
    AND workout_id = OLD.workout_id;

  -- Delete notification if no actors left
  DELETE FROM notifications
  WHERE recipient_id = workout_owner_id
    AND type = 'workout_comment'
    AND workout_id = OLD.workout_id
    AND array_length(actors, 1) IS NULL;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers
DROP TRIGGER IF EXISTS workout_like_notification_trigger ON workout_likes;
CREATE TRIGGER workout_like_notification_trigger
  AFTER INSERT ON workout_likes
  FOR EACH ROW
  EXECUTE FUNCTION handle_workout_like_notification();

DROP TRIGGER IF EXISTS workout_unlike_notification_trigger ON workout_likes;
CREATE TRIGGER workout_unlike_notification_trigger
  AFTER DELETE ON workout_likes
  FOR EACH ROW
  EXECUTE FUNCTION handle_workout_unlike_notification();

DROP TRIGGER IF EXISTS workout_comment_notification_trigger ON workout_comments;
CREATE TRIGGER workout_comment_notification_trigger
  AFTER INSERT ON workout_comments
  FOR EACH ROW
  EXECUTE FUNCTION handle_workout_comment_notification();

DROP TRIGGER IF EXISTS workout_comment_delete_notification_trigger ON workout_comments;
CREATE TRIGGER workout_comment_delete_notification_trigger
  AFTER DELETE ON workout_comments
  FOR EACH ROW
  EXECUTE FUNCTION handle_workout_comment_delete_notification();
