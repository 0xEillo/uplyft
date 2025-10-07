-- Add age and commitment fields to profiles table
ALTER TABLE profiles
ADD COLUMN age INTEGER,
ADD COLUMN commitment TEXT;

-- Add constraint for reasonable age values
ALTER TABLE profiles ADD CONSTRAINT valid_age
  CHECK (age IS NULL OR (age >= 13 AND age <= 120));

-- Add constraint for valid commitment values
ALTER TABLE profiles ADD CONSTRAINT valid_commitment
  CHECK (commitment IS NULL OR commitment IN ('2_times', '3_times', '4_times', '5_plus'));
