-- Add flag to track if user has been asked for push notification permissions
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS has_requested_push_notifications BOOLEAN DEFAULT FALSE;

-- Add index for efficient queries
CREATE INDEX IF NOT EXISTS idx_profiles_has_requested_push_notifications
  ON profiles(has_requested_push_notifications)
  WHERE has_requested_push_notifications = FALSE;
