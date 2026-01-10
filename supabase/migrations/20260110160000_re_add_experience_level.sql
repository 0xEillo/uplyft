-- Re-add experience_level column to profiles table
-- This was previously removed but is now needed for onboarding

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS experience_level TEXT;

-- Add constraint for valid values
ALTER TABLE profiles ADD CONSTRAINT valid_experience_level
  CHECK (experience_level IS NULL OR experience_level IN ('beginner', 'intermediate', 'advanced'));
