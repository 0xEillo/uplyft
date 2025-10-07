-- Remove the type field from workout_exercises table
ALTER TABLE workout_exercises DROP COLUMN IF EXISTS type;
