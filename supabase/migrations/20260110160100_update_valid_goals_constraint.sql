-- Update valid_goals constraint to include improve_cardio and become_flexible

-- Drop the existing constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS valid_goals;

-- Add updated constraint with all goal values
ALTER TABLE profiles ADD CONSTRAINT valid_goals
  CHECK (
    goals IS NULL OR
    (
      goals <@ ARRAY['build_muscle', 'lose_fat', 'gain_strength', 'general_fitness', 'improve_cardio', 'become_flexible']::TEXT[] AND
      array_length(goals, 1) > 0
    )
  );

-- Update comment for documentation
COMMENT ON COLUMN profiles.goals IS 'Array of user fitness goals: build_muscle, lose_fat, gain_strength, general_fitness, improve_cardio, become_flexible';
