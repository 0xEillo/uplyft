-- Update commitment column to support day-of-week values instead of frequency
-- Drop the old check constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS valid_commitment;

-- Change commitment column to text array for multiple day selection
ALTER TABLE profiles ALTER COLUMN commitment TYPE text[] USING 
  CASE 
    WHEN commitment IS NULL THEN NULL
    WHEN commitment = '2_times' THEN ARRAY['monday', 'wednesday']::text[]
    WHEN commitment = '3_times' THEN ARRAY['monday', 'wednesday', 'friday']::text[]
    WHEN commitment = '4_times' THEN ARRAY['monday', 'tuesday', 'thursday', 'friday']::text[]
    WHEN commitment = '5_plus' THEN ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday']::text[]
    ELSE ARRAY[commitment]::text[]
  END;

-- Add new check constraint for valid day values
ALTER TABLE profiles ADD CONSTRAINT valid_commitment
  CHECK (
    commitment IS NULL 
    OR (
      commitment <@ ARRAY['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'not_sure']::text[]
      AND array_length(commitment, 1) > 0
    )
  );

COMMENT ON COLUMN profiles.commitment IS 'Array of days user commits to working out: sunday, monday, tuesday, wednesday, thursday, friday, saturday, or not_sure';
