-- Migration: Support anonymous (guest) users
-- This migration updates the profile creation trigger to handle anonymous users
-- who don't have an email address.

-- Add is_guest column to profiles to track guest users
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_guest BOOLEAN DEFAULT false;

-- Update existing profiles to mark them as non-guests (they have emails)
UPDATE profiles SET is_guest = false WHERE is_guest IS NULL;

-- Drop the existing trigger and function
DROP TRIGGER IF EXISTS create_profile_on_signup_trigger ON auth.users;
DROP FUNCTION IF EXISTS create_profile_on_signup();

-- Create updated function to handle both regular and anonymous users
CREATE OR REPLACE FUNCTION create_profile_on_signup()
RETURNS TRIGGER AS $$
DECLARE
  base_tag TEXT;
  unique_tag TEXT;
  counter INTEGER := 0;
  is_anon BOOLEAN;
  display TEXT;
BEGIN
  -- Check if this is an anonymous user
  is_anon := NEW.is_anonymous = true OR NEW.email IS NULL;
  
  IF is_anon THEN
    -- For anonymous users, use 'guest' + first 8 chars of user ID
    base_tag := 'guest' || substring(replace(NEW.id::text, '-', ''), 1, 8);
    display := 'Guest';
  ELSE
    -- For regular users, extract username from email (before @)
    base_tag := lower(regexp_replace(split_part(NEW.email, '@', 1), '[^a-z0-9]', '', 'g'));
    display := split_part(NEW.email, '@', 1);
    
    -- Ensure base_tag is at least 3 characters
    IF length(base_tag) < 3 THEN
      base_tag := 'user' || substring(NEW.id::text, 1, 6);
    END IF;
  END IF;

  -- Ensure base_tag is max 27 characters (room for 3-digit suffix)
  IF length(base_tag) > 27 THEN
    base_tag := substring(base_tag, 1, 27);
  END IF;

  unique_tag := base_tag;

  -- Try up to 999 numbers like Twitter (1-999)
  WHILE counter <= 999 AND EXISTS (SELECT 1 FROM profiles WHERE user_tag = unique_tag) LOOP
    counter := counter + 1;
    unique_tag := base_tag || counter;
  END LOOP;

  -- Create profile with generated user_tag
  INSERT INTO profiles (id, user_tag, display_name, is_guest)
  VALUES (
    NEW.id,
    unique_tag,
    display,
    is_anon
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER create_profile_on_signup_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_profile_on_signup();

-- Update RLS policies to explicitly allow anonymous users
-- The existing policies use auth.uid() which already works for anonymous users
-- since they still have a valid user ID in the JWT.

-- Add comment for clarity
COMMENT ON COLUMN profiles.is_guest IS 'True if user signed up anonymously and has not linked a permanent identity';

