-- Retention push preferences + notification type expansion

-- 1) Per-user retention push preferences
CREATE TABLE IF NOT EXISTS retention_push_preferences (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  scheduled_reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  streak_protection_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  inactivity_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  weekly_recaps_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  milestones_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  preferred_reminder_hour SMALLINT NOT NULL DEFAULT 18
    CHECK (preferred_reminder_hour BETWEEN 5 AND 22),
  quiet_hours_start TIME NOT NULL DEFAULT TIME '22:00',
  quiet_hours_end TIME NOT NULL DEFAULT TIME '08:00',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  max_pushes_per_week SMALLINT NOT NULL DEFAULT 3
    CHECK (max_pushes_per_week BETWEEN 1 AND 7),
  snoozed_until TIMESTAMPTZ,
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_retention_push_preferences_enabled
  ON retention_push_preferences(enabled)
  WHERE enabled = TRUE;

CREATE INDEX IF NOT EXISTS idx_retention_push_preferences_snoozed_until
  ON retention_push_preferences(snoozed_until)
  WHERE snoozed_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_retention_push_preferences_timezone
  ON retention_push_preferences(timezone);

ALTER TABLE retention_push_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own retention push preferences" ON retention_push_preferences;
CREATE POLICY "Users can view their own retention push preferences"
  ON retention_push_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own retention push preferences" ON retention_push_preferences;
CREATE POLICY "Users can insert their own retention push preferences"
  ON retention_push_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own retention push preferences" ON retention_push_preferences;
CREATE POLICY "Users can update their own retention push preferences"
  ON retention_push_preferences
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS retention_push_preferences_set_updated_at ON retention_push_preferences;
CREATE TRIGGER retention_push_preferences_set_updated_at
  BEFORE UPDATE ON retention_push_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 2) Backfill defaults for existing users
INSERT INTO retention_push_preferences (user_id)
SELECT id FROM profiles
ON CONFLICT (user_id) DO NOTHING;

-- 3) Auto-create preferences row for all future profiles
CREATE OR REPLACE FUNCTION public.create_retention_push_preferences_for_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO retention_push_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_retention_push_preferences_on_profile_insert ON profiles;
CREATE TRIGGER create_retention_push_preferences_on_profile_insert
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_retention_push_preferences_for_profile();

-- 4) Expand notifications type constraint to include trial + retention categories
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
      'follow_received',
      'trial_reminder',
      'retention_scheduled_workout',
      'retention_streak_protection',
      'retention_inactivity',
      'retention_weekly_recap',
      'retention_milestone'
    )
  );
