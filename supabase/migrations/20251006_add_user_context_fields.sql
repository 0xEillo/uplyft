-- Add user context fields to profiles table
ALTER TABLE profiles
ADD COLUMN gender TEXT,
ADD COLUMN height_cm NUMERIC,
ADD COLUMN weight_kg NUMERIC,
ADD COLUMN goal TEXT;

-- Add constraint for valid gender values
ALTER TABLE profiles ADD CONSTRAINT valid_gender
  CHECK (gender IS NULL OR gender IN ('male', 'female', 'prefer_not_to_say'));

-- Add constraint for valid goal values
ALTER TABLE profiles ADD CONSTRAINT valid_goal
  CHECK (goal IS NULL OR goal IN ('build_muscle', 'lose_fat', 'gain_strength', 'general_fitness'));

-- Add constraints for reasonable height and weight values
ALTER TABLE profiles ADD CONSTRAINT valid_height
  CHECK (height_cm IS NULL OR (height_cm >= 50 AND height_cm <= 300));

ALTER TABLE profiles ADD CONSTRAINT valid_weight
  CHECK (weight_kg IS NULL OR (weight_kg >= 20 AND weight_kg <= 500));
