-- Remove experience_level field from profiles table
-- Drop the constraint first
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS valid_experience_level;

-- Drop the column
ALTER TABLE profiles DROP COLUMN IF EXISTS experience_level;
