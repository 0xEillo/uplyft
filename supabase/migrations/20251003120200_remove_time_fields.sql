-- Remove time-related fields from database

-- Remove duration from workout_sessions
ALTER TABLE workout_sessions DROP COLUMN IF EXISTS duration;

-- Remove rest_time from sets
ALTER TABLE sets DROP COLUMN IF EXISTS rest_time;

