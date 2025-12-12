-- Add comprehensive exercise metadata fields from exercises.json
ALTER TABLE exercises
ADD COLUMN IF NOT EXISTS exercise_id TEXT,
ADD COLUMN IF NOT EXISTS gif_url TEXT,
ADD COLUMN IF NOT EXISTS target_muscles TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS body_parts TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS equipments TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS secondary_muscles TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS instructions TEXT[] DEFAULT '{}';

-- Create index on exercise_id for lookups
CREATE INDEX IF NOT EXISTS idx_exercises_exercise_id ON exercises(exercise_id);

-- Create GIN indexes for array fields for better search performance
CREATE INDEX IF NOT EXISTS idx_exercises_target_muscles ON exercises USING GIN (target_muscles);
CREATE INDEX IF NOT EXISTS idx_exercises_body_parts ON exercises USING GIN (body_parts);
CREATE INDEX IF NOT EXISTS idx_exercises_equipments ON exercises USING GIN (equipments);
CREATE INDEX IF NOT EXISTS idx_exercises_secondary_muscles ON exercises USING GIN (secondary_muscles);

