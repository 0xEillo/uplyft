-- Fix profile creation trigger to work with RLS
-- The issue is that the trigger runs before the user is authenticated,
-- so auth.uid() returns null, blocking the INSERT.

-- Drop the old INSERT policy that blocks trigger execution
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;

-- Create new INSERT policy that allows both authenticated users and service role
CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (
    auth.uid() = id OR 
    auth.role() = 'service_role'
  );

-- Alternative: Update the trigger function to set the JWT context
-- This makes auth.uid() work correctly in the trigger
CREATE OR REPLACE FUNCTION create_profile_on_signup()
RETURNS TRIGGER AS $$
DECLARE
  base_tag TEXT;
  unique_tag TEXT;
  counter INTEGER := 0;
BEGIN
  -- Set JWT context so auth.uid() works in RLS policies
  PERFORM set_config('request.jwt.claim.sub', NEW.id::text, true);
  
  -- Extract username from email (before @)
  base_tag := lower(regexp_replace(split_part(NEW.email, '@', 1), '[^a-z0-9]', '', 'g'));

  -- Ensure base_tag is at least 3 characters
  IF length(base_tag) < 3 THEN
    base_tag := 'user' || substring(NEW.id::text, 1, 6);
  END IF;

  -- Ensure base_tag is max 30 characters
  IF length(base_tag) > 30 THEN
    base_tag := substring(base_tag, 1, 30);
  END IF;

  unique_tag := base_tag;

  -- Keep trying until we find a unique user_tag
  WHILE EXISTS (SELECT 1 FROM profiles WHERE user_tag = unique_tag) LOOP
    counter := counter + 1;
    unique_tag := substring(base_tag, 1, 25) || counter;
  END LOOP;

  -- Create profile with generated user_tag
  INSERT INTO profiles (id, user_tag, display_name)
  VALUES (
    NEW.id,
    unique_tag,
    split_part(NEW.email, '@', 1)
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error and continue (don't block user creation)
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
