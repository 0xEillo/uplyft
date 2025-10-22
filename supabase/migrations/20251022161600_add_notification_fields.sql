-- Add notification-related fields to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trial_notification_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trial_notification_scheduled_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trial_start_date TIMESTAMPTZ;

-- Add index for trial_notification_id lookups
CREATE INDEX IF NOT EXISTS idx_profiles_trial_notification_id
  ON profiles(trial_notification_id)
  WHERE trial_notification_id IS NOT NULL;

-- Add index for trial_start_date to find users whose trials are expiring
CREATE INDEX IF NOT EXISTS idx_profiles_trial_start_date
  ON profiles(trial_start_date)
  WHERE trial_start_date IS NOT NULL;
