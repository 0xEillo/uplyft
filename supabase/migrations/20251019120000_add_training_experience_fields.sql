-- Add training experience fields to profiles table
ALTER TABLE profiles
ADD COLUMN training_years TEXT,
ADD COLUMN experience_level TEXT;

-- Add constraint for valid training years values
ALTER TABLE profiles ADD CONSTRAINT valid_training_years
  CHECK (training_years IS NULL OR training_years IN ('less_than_1', '1_to_3', '3_to_5', '5_plus'));

-- Add constraint for valid experience level values
ALTER TABLE profiles ADD CONSTRAINT valid_experience_level
  CHECK (experience_level IS NULL OR experience_level IN ('beginner', 'intermediate', 'advanced'));
