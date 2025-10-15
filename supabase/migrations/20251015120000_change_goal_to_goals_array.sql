-- Migration: Change goal column from single TEXT to goals TEXT[] array
-- This allows users to have multiple fitness goals

-- Step 1: Drop the existing constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS valid_goal;

-- Step 2: Rename the column to indicate it's now plural
ALTER TABLE profiles RENAME COLUMN goal TO goals;

-- Step 3: Convert existing goal values to an array
-- First, create a temporary column to hold the array
ALTER TABLE profiles ADD COLUMN goals_temp TEXT[];

-- Convert existing single goal values to arrays
UPDATE profiles
SET goals_temp = ARRAY[goals]::TEXT[]
WHERE goals IS NOT NULL;

-- For NULL values, keep them as NULL
UPDATE profiles
SET goals_temp = NULL
WHERE goals IS NULL;

-- Drop the old text column
ALTER TABLE profiles DROP COLUMN goals;

-- Rename the temp column to goals
ALTER TABLE profiles RENAME COLUMN goals_temp TO goals;

-- Step 4: Add constraint to validate each element in the array
ALTER TABLE profiles ADD CONSTRAINT valid_goals
  CHECK (
    goals IS NULL OR
    (
      goals <@ ARRAY['build_muscle', 'lose_fat', 'gain_strength', 'general_fitness']::TEXT[] AND
      array_length(goals, 1) > 0
    )
  );

-- Add comment for documentation
COMMENT ON COLUMN profiles.goals IS 'Array of user fitness goals: build_muscle, lose_fat, gain_strength, general_fitness';
