-- Mention notifications for workout comments.

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check CHECK (
    type IN (
      'workout_like',
      'workout_comment',
      'workout_comment_reply',
      'workout_comment_like',
      'workout_comment_mention',
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
      'retention_milestone',
      'proactive_coach_workout_day_morning',
      'proactive_coach_missed_workout',
      'proactive_coach_comeback',
      'proactive_coach_post_workout_followup'
    )
  );

CREATE TABLE IF NOT EXISTS public.workout_comment_mentions (
  comment_id UUID NOT NULL REFERENCES public.workout_comments(id) ON DELETE CASCADE,
  workout_id UUID NOT NULL REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mentioned_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mentioned_user_tag TEXT NOT NULL,
  comment_preview TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT workout_comment_mentions_pkey PRIMARY KEY (comment_id, mentioned_user_id),
  CONSTRAINT workout_comment_mentions_no_self_mention CHECK (actor_id <> mentioned_user_id)
);

CREATE INDEX IF NOT EXISTS idx_workout_comment_mentions_recipient_workout
  ON public.workout_comment_mentions(mentioned_user_id, workout_id);

CREATE INDEX IF NOT EXISTS idx_workout_comment_mentions_actor_workout
  ON public.workout_comment_mentions(actor_id, workout_id);

ALTER TABLE public.workout_comment_mentions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workout comment mentions visible when workout is viewable" ON public.workout_comment_mentions;
CREATE POLICY "Workout comment mentions visible when workout is viewable"
  ON public.workout_comment_mentions
  FOR SELECT
  USING (
    auth.uid() = mentioned_user_id OR
    auth.uid() = actor_id OR
    EXISTS (
      SELECT 1
      FROM public.workout_sessions ws
      WHERE ws.id = workout_comment_mentions.workout_id
        AND public.can_view_user_content(ws.user_id)
    )
  );

CREATE OR REPLACE FUNCTION public.extract_workout_comment_mentions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  truncated_content TEXT;
BEGIN
  truncated_content := LEFT(NEW.content, 100);
  IF LENGTH(NEW.content) > 100 THEN
    truncated_content := truncated_content || '...';
  END IF;

  INSERT INTO public.workout_comment_mentions (
    comment_id,
    workout_id,
    actor_id,
    mentioned_user_id,
    mentioned_user_tag,
    comment_preview,
    created_at
  )
  SELECT DISTINCT
    NEW.id,
    NEW.workout_id,
    NEW.user_id,
    p.id,
    p.user_tag,
    truncated_content,
    NOW()
  FROM regexp_matches(
    NEW.content,
    '(^|[^A-Za-z0-9_])@([a-z0-9_]{3,30})',
    'gi'
  ) AS m(matches)
  JOIN public.profiles p
    ON p.user_tag = lower(m.matches[2])
  JOIN public.follows f
    ON f.follower_id = p.id
   AND f.followee_id = NEW.user_id
  WHERE p.id <> NEW.user_id
  ON CONFLICT (comment_id, mentioned_user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_workout_comment_mention_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (
    recipient_id,
    type,
    workout_id,
    actors,
    comment_preview,
    metadata,
    created_at,
    updated_at,
    read
  )
  VALUES (
    NEW.mentioned_user_id,
    'workout_comment_mention',
    NEW.workout_id,
    ARRAY[NEW.actor_id],
    NEW.comment_preview,
    jsonb_build_object(
      'comment_id', NEW.comment_id::text,
      'mentioned_user_tag', NEW.mentioned_user_tag
    ),
    NOW(),
    NOW(),
    FALSE
  )
  ON CONFLICT (recipient_id, workout_id, type)
  DO UPDATE SET
    actors = CASE
      WHEN NEW.actor_id = ANY(notifications.actors) THEN notifications.actors
      ELSE array_append(notifications.actors, NEW.actor_id)
    END,
    comment_preview = NEW.comment_preview,
    metadata = jsonb_build_object(
      'comment_id', NEW.comment_id::text,
      'mentioned_user_tag', NEW.mentioned_user_tag
    ),
    updated_at = NOW(),
    read = FALSE;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_workout_comment_mention_delete_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  latest_preview TEXT;
  latest_comment_id UUID;
  latest_user_tag TEXT;
BEGIN
  SELECT comment_preview, comment_id, mentioned_user_tag
  INTO latest_preview, latest_comment_id, latest_user_tag
  FROM public.workout_comment_mentions
  WHERE mentioned_user_id = OLD.mentioned_user_id
    AND workout_id = OLD.workout_id
    AND comment_id <> OLD.comment_id
  ORDER BY created_at DESC
  LIMIT 1;

  UPDATE public.notifications
  SET
    actors = CASE
      WHEN EXISTS (
        SELECT 1
        FROM public.workout_comment_mentions remaining
        WHERE remaining.mentioned_user_id = OLD.mentioned_user_id
          AND remaining.workout_id = OLD.workout_id
          AND remaining.actor_id = OLD.actor_id
          AND remaining.comment_id <> OLD.comment_id
      )
      THEN actors
      ELSE array_remove(actors, OLD.actor_id)
    END,
    comment_preview = latest_preview,
    metadata = CASE
      WHEN latest_comment_id IS NULL THEN metadata
      ELSE jsonb_build_object(
        'comment_id', latest_comment_id::text,
        'mentioned_user_tag', latest_user_tag
      )
    END,
    updated_at = NOW()
  WHERE recipient_id = OLD.mentioned_user_id
    AND type = 'workout_comment_mention'
    AND workout_id = OLD.workout_id;

  DELETE FROM public.notifications
  WHERE recipient_id = OLD.mentioned_user_id
    AND type = 'workout_comment_mention'
    AND workout_id = OLD.workout_id
    AND array_length(actors, 1) IS NULL;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS workout_comment_extract_mentions_trigger ON public.workout_comments;
CREATE TRIGGER workout_comment_extract_mentions_trigger
  AFTER INSERT ON public.workout_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.extract_workout_comment_mentions();

DROP TRIGGER IF EXISTS workout_comment_mention_notification_trigger ON public.workout_comment_mentions;
CREATE TRIGGER workout_comment_mention_notification_trigger
  AFTER INSERT ON public.workout_comment_mentions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_workout_comment_mention_notification();

DROP TRIGGER IF EXISTS workout_comment_mention_delete_notification_trigger ON public.workout_comment_mentions;
CREATE TRIGGER workout_comment_mention_delete_notification_trigger
  AFTER DELETE ON public.workout_comment_mentions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_workout_comment_mention_delete_notification();
