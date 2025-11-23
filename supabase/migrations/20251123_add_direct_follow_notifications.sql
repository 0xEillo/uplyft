-- Add direct follow notifications for public profiles
-- When user A follows user B's public profile, user B should be notified

-- 1. Update notifications type constraint to include 'follow_received'
ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check CHECK (
    type IN (
      'workout_like',
      'workout_comment',
      'follow_request_received',
      'follow_request_approved',
      'follow_request_declined',
      'follow_received'
    )
  );

-- 2. Add follow_id column to track individual follows
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS follow_id TEXT;

-- 3. Create unique constraint for follow notifications
-- We use a composite key with recipient_id, follow_id, and type
ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_unique_follow_events;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_unique_follow_events
    UNIQUE (recipient_id, follow_id, type);

-- 4. Create function to notify when someone follows a public profile
CREATE OR REPLACE FUNCTION public.notify_direct_follow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  followee_profile RECORD;
  follow_identifier TEXT;
BEGIN
  -- Only create notification if followee exists
  SELECT id, is_private
  INTO followee_profile
  FROM profiles
  WHERE id = NEW.followee_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Only notify for public profiles (private profiles use follow requests instead)
  IF followee_profile.is_private = TRUE THEN
    RETURN NEW;
  END IF;

  -- Create a unique identifier for this follow relationship
  -- Format: "follower_id:followee_id"
  follow_identifier := NEW.follower_id::TEXT || ':' || NEW.followee_id::TEXT;

  -- Create notification for the followee
  INSERT INTO notifications (
    recipient_id,
    type,
    actors,
    metadata,
    created_at,
    updated_at,
    read,
    follow_id
  )
  VALUES (
    NEW.followee_id,
    'follow_received',
    ARRAY[NEW.follower_id],
    jsonb_build_object(
      'follower_id', NEW.follower_id::text,
      'followee_id', NEW.followee_id::text
    ),
    NOW(),
    NOW(),
    FALSE,
    follow_identifier
  )
  ON CONFLICT (recipient_id, follow_id, type)
  DO UPDATE SET
    actors = EXCLUDED.actors,
    metadata = EXCLUDED.metadata,
    updated_at = NOW(),
    read = FALSE;

  RETURN NEW;
END;
$$;

-- 5. Create trigger on follows table
DROP TRIGGER IF EXISTS follows_notify_direct_follow ON follows;
CREATE TRIGGER follows_notify_direct_follow
  AFTER INSERT ON follows
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_direct_follow();
