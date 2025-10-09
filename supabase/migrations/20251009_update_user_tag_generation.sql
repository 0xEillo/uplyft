-- Update user tag generation to use Twitter-style numbering (1-999)
-- This updates the existing trigger function to match the new pattern

CREATE OR REPLACE FUNCTION create_profile_on_signup()
RETURNS TRIGGER AS $$
DECLARE
  base_tag TEXT;
  unique_tag TEXT;
  counter INTEGER := 0;
BEGIN
  -- Set JWT context so auth.uid() works in RLS policies
  PERFORM set_config('request.jwt.claim.sub', NEW.id::text, true);

  -- Extract username from email (before @) as temporary fallback
  -- This will be updated with display name-based tag during signup
  base_tag := lower(regexp_replace(split_part(NEW.email, '@', 1), '[^a-z0-9]', '', 'g'));

  -- Ensure base_tag is at least 3 characters
  IF length(base_tag) < 3 THEN
    base_tag := 'user' || substring(NEW.id::text, 1, 6);
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
