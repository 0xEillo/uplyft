-- Add reply threads + comment likes for workout comments

-- 1) Reply metadata on workout comments
ALTER TABLE workout_comments
  ADD COLUMN IF NOT EXISTS parent_comment_id UUID REFERENCES workout_comments(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS reply_to_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_workout_comments_parent_comment_id
  ON workout_comments(parent_comment_id);

CREATE INDEX IF NOT EXISTS idx_workout_comments_reply_to_user_id
  ON workout_comments(reply_to_user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'workout_comments_no_self_parent'
  ) THEN
    ALTER TABLE workout_comments
      ADD CONSTRAINT workout_comments_no_self_parent
      CHECK (parent_comment_id IS NULL OR parent_comment_id <> id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_workout_comment_reply_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  parent_workout_id UUID;
  parent_user_id UUID;
BEGIN
  IF NEW.parent_comment_id IS NULL THEN
    NEW.reply_to_user_id := NULL;
    RETURN NEW;
  END IF;

  SELECT workout_id, user_id
  INTO parent_workout_id, parent_user_id
  FROM workout_comments
  WHERE id = NEW.parent_comment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parent comment % does not exist', NEW.parent_comment_id;
  END IF;

  IF NEW.workout_id <> parent_workout_id THEN
    RAISE EXCEPTION 'Reply workout mismatch for parent comment %', NEW.parent_comment_id;
  END IF;

  NEW.reply_to_user_id := COALESCE(NEW.reply_to_user_id, parent_user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS workout_comments_set_reply_metadata ON workout_comments;
CREATE TRIGGER workout_comments_set_reply_metadata
  BEFORE INSERT OR UPDATE OF parent_comment_id, workout_id, reply_to_user_id
  ON workout_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_workout_comment_reply_metadata();

-- 2) Comment likes table
CREATE TABLE IF NOT EXISTS workout_comment_likes (
  comment_id UUID NOT NULL REFERENCES workout_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT workout_comment_likes_pkey PRIMARY KEY (comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workout_comment_likes_user_id
  ON workout_comment_likes(user_id);

CREATE INDEX IF NOT EXISTS idx_workout_comment_likes_created_at
  ON workout_comment_likes(created_at DESC);

ALTER TABLE workout_comment_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workout comment likes visible when workout is viewable" ON workout_comment_likes;
CREATE POLICY "Workout comment likes visible when workout is viewable"
  ON workout_comment_likes
  FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1
      FROM workout_comments wc
      JOIN workout_sessions ws ON ws.id = wc.workout_id
      WHERE wc.id = workout_comment_likes.comment_id
        AND public.can_view_user_content(ws.user_id)
    )
  );

DROP POLICY IF EXISTS "Users can like comments they can view" ON workout_comment_likes;
CREATE POLICY "Users can like comments they can view"
  ON workout_comment_likes
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM workout_comments wc
      JOIN workout_sessions ws ON ws.id = wc.workout_id
      WHERE wc.id = workout_comment_likes.comment_id
        AND public.can_view_user_content(ws.user_id)
    )
  );

DROP POLICY IF EXISTS "Users can unlike their own comment likes" ON workout_comment_likes;
CREATE POLICY "Users can unlike their own comment likes"
  ON workout_comment_likes
  FOR DELETE
  USING (auth.uid() = user_id);

-- 3) Expand notifications type constraint with reply/comment-like events
ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check CHECK (
    type IN (
      'workout_like',
      'workout_comment',
      'workout_comment_reply',
      'workout_comment_like',
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

-- 4) Keep workout comment notifications top-level only (replies have their own type)
CREATE OR REPLACE FUNCTION handle_workout_comment_notification()
RETURNS TRIGGER AS $$
DECLARE
  workout_owner_id UUID;
  truncated_content TEXT;
BEGIN
  -- Reply comments are handled by dedicated reply notifications
  IF NEW.parent_comment_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

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
    comment_preview = truncated_content,
    updated_at = NOW(),
    read = FALSE;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION handle_workout_comment_delete_notification()
RETURNS TRIGGER AS $$
DECLARE
  workout_owner_id UUID;
  latest_comment TEXT;
BEGIN
  -- Reply comments are handled by dedicated reply notifications
  IF OLD.parent_comment_id IS NOT NULL THEN
    RETURN OLD;
  END IF;

  -- Get workout owner
  SELECT user_id INTO workout_owner_id
  FROM workout_sessions
  WHERE id = OLD.workout_id;

  -- Get latest top-level comment for preview (if exists)
  SELECT LEFT(content, 100) INTO latest_comment
  FROM workout_comments
  WHERE workout_id = OLD.workout_id
    AND id != OLD.id
    AND parent_comment_id IS NULL
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

-- 5) Notifications for replies to comments
CREATE OR REPLACE FUNCTION public.handle_workout_comment_reply_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_recipient_id UUID;
  truncated_content TEXT;
BEGIN
  IF NEW.parent_comment_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_recipient_id := NEW.reply_to_user_id;

  IF v_recipient_id IS NULL THEN
    SELECT user_id INTO v_recipient_id
    FROM workout_comments
    WHERE id = NEW.parent_comment_id;
  END IF;

  IF v_recipient_id IS NULL OR v_recipient_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  truncated_content := LEFT(NEW.content, 100);
  IF LENGTH(NEW.content) > 100 THEN
    truncated_content := truncated_content || '...';
  END IF;

  INSERT INTO notifications (
    recipient_id,
    type,
    workout_id,
    actors,
    comment_preview,
    created_at,
    updated_at,
    read
  )
  VALUES (
    v_recipient_id,
    'workout_comment_reply',
    NEW.workout_id,
    ARRAY[NEW.user_id],
    truncated_content,
    NOW(),
    NOW(),
    FALSE
  )
  ON CONFLICT (recipient_id, type, workout_id)
  DO UPDATE SET
    actors = CASE
      WHEN NEW.user_id = ANY(notifications.actors) THEN notifications.actors
      ELSE array_append(notifications.actors, NEW.user_id)
    END,
    comment_preview = truncated_content,
    updated_at = NOW(),
    read = FALSE;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.handle_workout_comment_reply_delete_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_recipient_id UUID;
  latest_reply TEXT;
BEGIN
  IF OLD.parent_comment_id IS NULL THEN
    RETURN OLD;
  END IF;

  v_recipient_id := OLD.reply_to_user_id;

  IF v_recipient_id IS NULL THEN
    SELECT user_id INTO v_recipient_id
    FROM workout_comments
    WHERE id = OLD.parent_comment_id;
  END IF;

  IF v_recipient_id IS NULL THEN
    RETURN OLD;
  END IF;

  SELECT LEFT(content, 100) INTO latest_reply
  FROM workout_comments
  WHERE workout_id = OLD.workout_id
    AND parent_comment_id = OLD.parent_comment_id
    AND id != OLD.id
  ORDER BY created_at DESC
  LIMIT 1;

  IF latest_reply IS NOT NULL AND LENGTH(latest_reply) = 100 THEN
    latest_reply := latest_reply || '...';
  END IF;

  UPDATE notifications
  SET
    actors = array_remove(actors, OLD.user_id),
    comment_preview = latest_reply,
    updated_at = NOW()
  WHERE recipient_id = v_recipient_id
    AND type = 'workout_comment_reply'
    AND workout_id = OLD.workout_id;

  DELETE FROM notifications
  WHERE recipient_id = v_recipient_id
    AND type = 'workout_comment_reply'
    AND workout_id = OLD.workout_id
    AND array_length(actors, 1) IS NULL;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6) Notifications for comment likes
CREATE OR REPLACE FUNCTION public.handle_workout_comment_like_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_comment_owner_id UUID;
  v_workout_id UUID;
BEGIN
  SELECT user_id, workout_id
  INTO v_comment_owner_id, v_workout_id
  FROM workout_comments
  WHERE id = NEW.comment_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF v_comment_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO notifications (
    recipient_id,
    type,
    workout_id,
    actors,
    created_at,
    updated_at,
    read
  )
  VALUES (
    v_comment_owner_id,
    'workout_comment_like',
    v_workout_id,
    ARRAY[NEW.user_id],
    NOW(),
    NOW(),
    FALSE
  )
  ON CONFLICT (recipient_id, type, workout_id)
  DO UPDATE SET
    actors = CASE
      WHEN NEW.user_id = ANY(notifications.actors) THEN notifications.actors
      ELSE array_append(notifications.actors, NEW.user_id)
    END,
    updated_at = NOW(),
    read = FALSE;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.handle_workout_comment_unlike_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_comment_owner_id UUID;
  v_workout_id UUID;
BEGIN
  SELECT user_id, workout_id
  INTO v_comment_owner_id, v_workout_id
  FROM workout_comments
  WHERE id = OLD.comment_id;

  IF NOT FOUND THEN
    RETURN OLD;
  END IF;

  UPDATE notifications
  SET
    actors = array_remove(actors, OLD.user_id),
    updated_at = NOW()
  WHERE recipient_id = v_comment_owner_id
    AND type = 'workout_comment_like'
    AND workout_id = v_workout_id;

  DELETE FROM notifications
  WHERE recipient_id = v_comment_owner_id
    AND type = 'workout_comment_like'
    AND workout_id = v_workout_id
    AND array_length(actors, 1) IS NULL;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS workout_comment_reply_notification_trigger ON workout_comments;
CREATE TRIGGER workout_comment_reply_notification_trigger
  AFTER INSERT ON workout_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_workout_comment_reply_notification();

DROP TRIGGER IF EXISTS workout_comment_reply_delete_notification_trigger ON workout_comments;
CREATE TRIGGER workout_comment_reply_delete_notification_trigger
  AFTER DELETE ON workout_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_workout_comment_reply_delete_notification();

DROP TRIGGER IF EXISTS workout_comment_like_notification_trigger ON workout_comment_likes;
CREATE TRIGGER workout_comment_like_notification_trigger
  AFTER INSERT ON workout_comment_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_workout_comment_like_notification();

DROP TRIGGER IF EXISTS workout_comment_unlike_notification_trigger ON workout_comment_likes;
CREATE TRIGGER workout_comment_unlike_notification_trigger
  AFTER DELETE ON workout_comment_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_workout_comment_unlike_notification();
