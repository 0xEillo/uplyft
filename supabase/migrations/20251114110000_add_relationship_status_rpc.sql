-- RPC to fetch batched relationship state between viewer and target users

CREATE OR REPLACE FUNCTION public.get_relationship_statuses(
  viewer UUID,
  target_ids UUID[]
)
RETURNS TABLE (
  target_id UUID,
  is_private BOOLEAN,
  is_following BOOLEAN,
  has_pending_request BOOLEAN,
  request_id UUID,
  has_incoming_request BOOLEAN,
  incoming_request_id UUID
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH normalized_targets AS (
    SELECT
      id,
      is_private
    FROM profiles
    WHERE id = ANY(COALESCE(target_ids, ARRAY[]::UUID[]))
  ),
  follow_edges AS (
    SELECT followee_id
    FROM follows
    WHERE follower_id = viewer
      AND followee_id = ANY(COALESCE(target_ids, ARRAY[]::UUID[]))
  ),
  pending_requests AS (
    SELECT followee_id, id
    FROM follow_requests
    WHERE follower_id = viewer
      AND status = 'pending'
      AND followee_id = ANY(COALESCE(target_ids, ARRAY[]::UUID[]))
  ),
  incoming_requests AS (
    SELECT follower_id, id
    FROM follow_requests
    WHERE followee_id = viewer
      AND status = 'pending'
      AND follower_id = ANY(COALESCE(target_ids, ARRAY[]::UUID[]))
  )
  SELECT
    nt.id AS target_id,
    COALESCE(nt.is_private, FALSE) AS is_private,
    (fe.followee_id IS NOT NULL) AS is_following,
    (pr.id IS NOT NULL) AS has_pending_request,
    pr.id AS request_id,
    (ir.id IS NOT NULL) AS has_incoming_request,
    ir.id AS incoming_request_id
  FROM normalized_targets nt
  LEFT JOIN follow_edges fe ON fe.followee_id = nt.id
  LEFT JOIN pending_requests pr ON pr.followee_id = nt.id
  LEFT JOIN incoming_requests ir ON ir.follower_id = nt.id;
$$;

