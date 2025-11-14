# Social Feed Schema Overview

This document describes the database primitives that power Strava-style social features in the Rep AI app.

## Core Tables

- `follows`
  - Tracks directed follow relationships (`follower_id` → `followee_id`).
  - Indexed on both follower and followee for fast lookups.
  - Self-follow prevented via check constraint.
- `workout_likes`
  - Stores likes for `workout_sessions`.
  - Composite PK enforces one like per (workout, user) pair.
  - Indexed by `user_id` for "liked workouts" queries.
- `workout_comments`
  - Persists user comments on workouts with edit timestamps.
  - Trigger keeps `updated_at` in sync.
  - Indexed for per-workout threads and user activity.
- `workout_social_stats` (view)
  - Aggregates like/comment counts for each workout.
  - Keeps counts in SQL so the client fetches lightweight metrics.

## Row Level Security

| Table              | Select | Insert                     | Update                 | Delete                          |
| ------------------ | ------ | -------------------------- | ---------------------- | ------------------------------- |
| `follows`          | Public | `auth.uid() = follower_id` | —                      | `auth.uid() = follower_id`      |
| `workout_likes`    | Public | `auth.uid() = user_id`     | —                      | `auth.uid() = user_id`          |
| `workout_comments` | Public | `auth.uid() = user_id`     | `auth.uid() = user_id` | Comment author or workout owner |

Helper functions `follower_count(uuid)` and `following_count(uuid)` expose counts without client-side aggregation.

## Feed Query Plan

The social feed should display workouts from:

1. The authenticated user.
2. Users they follow.

To fetch this efficiently:

1. **Target set of authors**

   ```sql
   SELECT followee_id
   FROM follows
   WHERE follower_id = auth.uid()
   UNION ALL
   SELECT auth.uid();
   ```

2. **Workouts for those authors**

   ```sql
   SELECT ws.*
   FROM workout_sessions ws
   WHERE ws.user_id = ANY(:author_ids)
   ORDER BY ws.created_at DESC
   LIMIT :limit OFFSET :offset;
   ```

3. **Social metadata**

   - Join `workout_social_stats` on `ws.id` for `like_count` and `comment_count`.
   - Fetch user-specific flags:
     ```sql
     SELECT true
     FROM workout_likes
     WHERE workout_id = :workout_id
       AND user_id = auth.uid();
     ```
   - Optional: load last N comments via `workout_comments` for preview.

4. **Supabase implementations**
   - Use a Postgres function (`rpc`) that returns a JSON payload containing workouts, counts, and viewer-specific booleans to reduce round trips.
   - Alternatively, perform three parallel client queries:
     1. `workout_sessions` filtered by `user_id` IN (self + followees).
     2. `workout_social_stats` filtered by `workout_id` IN (workout ids from step 1).
     3. `workout_likes` filtered by the viewer to build `is_liked` flags.

## Backfill & Maintenance

- **Existing workouts**: counts populate automatically as likes/comments are added—no backfill required.
- **Follower counts**: `follower_count` / `following_count` return zero when relationships do not exist.
- **Resetting local data**:
  ```sql
  TRUNCATE follows CASCADE;
  TRUNCATE workout_likes CASCADE;
  TRUNCATE workout_comments CASCADE;
  ```
  Re-run migrations if schemas need a clean slate.
- **Index health**: periodically check index usage via `pg_stat_user_indexes` if feed queries degrade.

## Integration Touchpoints

- `app/(tabs)/index.tsx`: replace the current self-only feed with the author query above.
- `components/feed-card.tsx`: extend props with `like_count`, `comment_count`, `is_liked`, and event handlers.
- `app/user/[userId].tsx`: surface follower/ following counts via `database.follows.getCounts`.
- Notification & analytics layers should log follow/like/comment events for downstream features.
