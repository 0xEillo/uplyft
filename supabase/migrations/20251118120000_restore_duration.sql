-- Add duration column back to workout_sessions
-- This column was accidentally removed in 20251003120200_remove_time_fields.sql
-- but is still used by the application logic and UI.

ALTER TABLE workout_sessions 
ADD COLUMN IF NOT EXISTS duration INTEGER;

