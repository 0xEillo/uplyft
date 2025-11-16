-- Stored procedures, triggers, and notification plumbing for follow requests

-- 1. Extend notifications table for follow-request events
ALTER TABLE notifications
  ALTER COLUMN workout_id DROP NOT NULL;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS metadata JSONB;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS request_id UUID REFERENCES follow_requests(id) ON DELETE CASCADE;

ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check CHECK (
    type IN (
      'workout_like',
      'workout_comment',
      'follow_request_received',
      'follow_request_approved',
      'follow_request_declined'
    )
  );

ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_unique_key;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_unique_workout_events
    UNIQUE (recipient_id, workout_id, type);

ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_unique_request_events;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_unique_request_events
    UNIQUE (recipient_id, request_id, type);

-- 2. RPC helpers for managing follow relationships

CREATE OR REPLACE FUNCTION public.request_follow(follower UUID, followee UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  viewer UUID := auth.uid();
  target_profile RECORD;
  pending_request_id UUID;
BEGIN
  IF viewer IS NULL THEN
    RAISE EXCEPTION 'request_follow: authentication required';
  END IF;

  IF follower IS NULL OR follower <> viewer THEN
    RAISE EXCEPTION 'request_follow: follower mismatch';
  END IF;

  IF followee IS NULL OR followee = follower THEN
    RAISE EXCEPTION 'request_follow: invalid follow target';
  END IF;

  SELECT id, is_private
  INTO target_profile
  FROM profiles
  WHERE id = followee;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'request_follow: target profile not found';
  END IF;

  -- Already following
  IF EXISTS (
    SELECT 1
    FROM follows
    WHERE follower_id = follower
      AND followee_id = followee
  ) THEN
    RETURN jsonb_build_object('status', 'already_following');
  END IF;

  -- Public profile: follow immediately
  IF target_profile.is_private = FALSE THEN
    INSERT INTO follows (follower_id, followee_id)
    VALUES (follower, followee)
    ON CONFLICT DO NOTHING;

    RETURN jsonb_build_object('status', 'following');
  END IF;

  -- Private profile: enqueue follow request
  INSERT INTO follow_requests (follower_id, followee_id)
  VALUES (follower, followee)
  ON CONFLICT ON CONSTRAINT follow_requests_unique_pair
  DO UPDATE SET status = 'pending', responded_at = NULL, updated_at = NOW()
  RETURNING id INTO pending_request_id;

  IF pending_request_id IS NULL THEN
    SELECT id INTO pending_request_id
    FROM follow_requests
    WHERE follower_id = follower
      AND followee_id = followee
      AND status = 'pending';
  END IF;

  RETURN jsonb_build_object(
    'status', 'request_pending',
    'request_id', pending_request_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_follow_request(request_id UUID, decision TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  viewer UUID := auth.uid();
  request_row follow_requests%ROWTYPE;
  normalized TEXT := lower(coalesce(decision, ''));
  new_status TEXT;
BEGIN
  IF viewer IS NULL THEN
    RAISE EXCEPTION 'respond_follow_request: authentication required';
  END IF;

  SELECT *
  INTO request_row
  FROM follow_requests
  WHERE id = request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'respond_follow_request: request not found';
  END IF;

  IF request_row.followee_id <> viewer THEN
    RAISE EXCEPTION 'respond_follow_request: not authorized';
  END IF;

  IF request_row.status <> 'pending' THEN
    RETURN jsonb_build_object('status', request_row.status);
  END IF;

  IF normalized IN ('approve', 'approved', 'accept', 'accepted') THEN
    new_status := 'approved';
    UPDATE follow_requests
    SET status = new_status,
        responded_at = NOW()
    WHERE id = request_id;

    INSERT INTO follows (follower_id, followee_id)
    VALUES (request_row.follower_id, request_row.followee_id)
    ON CONFLICT DO NOTHING;

    RETURN jsonb_build_object('status', new_status);
  ELSIF normalized IN ('decline', 'declined', 'reject', 'rejected') THEN
    new_status := 'declined';
    UPDATE follow_requests
    SET status = new_status,
        responded_at = NOW()
    WHERE id = request_id;

    RETURN jsonb_build_object('status', new_status);
  ELSE
    RAISE EXCEPTION 'respond_follow_request: unknown decision %', decision;
  END IF;
END;
$$;

-- 3. Guardrails to prevent duplicate data

CREATE OR REPLACE FUNCTION public.prevent_follow_request_when_follow_exists()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM follows
    WHERE follower_id = NEW.follower_id
      AND followee_id = NEW.followee_id
  ) THEN
    RAISE EXCEPTION 'follow request invalid: already following user %', NEW.followee_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_duplicate_follow_requests ON follow_requests;
CREATE TRIGGER prevent_duplicate_follow_requests
  BEFORE INSERT ON follow_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_follow_request_when_follow_exists();

CREATE OR REPLACE FUNCTION public.cleanup_pending_follow_requests()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM follow_requests
  WHERE follower_id = NEW.follower_id
    AND followee_id = NEW.followee_id
    AND status = 'pending';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cleanup_follow_requests_after_follow ON follows;
CREATE TRIGGER cleanup_follow_requests_after_follow
  AFTER INSERT ON follows
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_pending_follow_requests();

-- 4. Notifications for follow request lifecycle

CREATE OR REPLACE FUNCTION public.notify_follow_request_pending()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'pending' THEN
    RETURN NEW;
  END IF;

  INSERT INTO notifications (
    recipient_id,
    type,
    workout_id,
    request_id,
    actors,
    metadata,
    created_at,
    updated_at,
    read
  )
  VALUES (
    NEW.followee_id,
    'follow_request_received',
    NULL,
    NEW.id,
    ARRAY[NEW.follower_id],
    jsonb_build_object(
      'request_id', NEW.id::text,
      'follower_id', NEW.follower_id::text
    ),
    NOW(),
    NOW(),
    FALSE
  )
  ON CONFLICT ON CONSTRAINT notifications_unique_request_events
  DO UPDATE SET
    actors = EXCLUDED.actors,
    metadata = EXCLUDED.metadata,
    updated_at = NOW(),
    read = FALSE;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS follow_requests_notify_pending ON follow_requests;
CREATE TRIGGER follow_requests_notify_pending
  AFTER INSERT OR UPDATE ON follow_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_follow_request_pending();

CREATE OR REPLACE FUNCTION public.notify_follow_request_response()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  response_type TEXT;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status NOT IN ('approved', 'declined') THEN
    RETURN NEW;
  END IF;

  response_type :=
    CASE NEW.status
      WHEN 'approved' THEN 'follow_request_approved'
      ELSE 'follow_request_declined'
    END;

  INSERT INTO notifications (
    recipient_id,
    type,
    workout_id,
    request_id,
    actors,
    metadata,
    created_at,
    updated_at,
    read
  )
  VALUES (
    NEW.follower_id,
    response_type,
    NULL,
    NEW.id,
    ARRAY[NEW.followee_id],
    jsonb_build_object(
      'request_id', NEW.id::text,
      'followee_id', NEW.followee_id::text,
      'status', NEW.status
    ),
    NOW(),
    NOW(),
    FALSE
  )
  ON CONFLICT ON CONSTRAINT notifications_unique_request_events
  DO UPDATE SET
    actors = EXCLUDED.actors,
    metadata = EXCLUDED.metadata,
    updated_at = NOW(),
    read = FALSE;

  -- Mark the original notification as handled
  UPDATE notifications
  SET read = TRUE,
      updated_at = NOW()
  WHERE request_id = NEW.id
    AND type = 'follow_request_received';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS follow_requests_notify_response ON follow_requests;
CREATE TRIGGER follow_requests_notify_response
  AFTER UPDATE ON follow_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_follow_request_response();

