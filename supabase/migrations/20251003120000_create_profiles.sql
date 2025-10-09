-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_tag TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add constraint for user_tag format (lowercase alphanumeric and underscores only)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_tag_format') THEN
    ALTER TABLE profiles ADD CONSTRAINT user_tag_format
      CHECK (user_tag ~ '^[a-z0-9_]{3,30}$');
  END IF;
END $$;

-- Index for user_tag lookups
CREATE INDEX IF NOT EXISTS idx_profiles_user_tag ON profiles(user_tag);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles are viewable by everyone (for social features)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Profiles are viewable by everyone') THEN
    CREATE POLICY "Profiles are viewable by everyone"
      ON profiles FOR SELECT
      USING (true);
  END IF;
END $$;

-- Users can insert their own profile
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can insert their own profile') THEN
    CREATE POLICY "Users can insert their own profile"
      ON profiles FOR INSERT
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- Users can update their own profile
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can update their own profile') THEN
    CREATE POLICY "Users can update their own profile"
      ON profiles FOR UPDATE
      USING (auth.uid() = id);
  END IF;
END $$;

-- Users can delete their own profile
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can delete their own profile') THEN
    CREATE POLICY "Users can delete their own profile"
      ON profiles FOR DELETE
      USING (auth.uid() = id);
  END IF;
END $$;

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on profile updates
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_profiles_updated_at') THEN
    CREATE TRIGGER update_profiles_updated_at
      BEFORE UPDATE ON profiles
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION create_profile_on_signup()
RETURNS TRIGGER AS $$
DECLARE
  base_tag TEXT;
  unique_tag TEXT;
  counter INTEGER := 0;
BEGIN
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
    split_part(NEW.email, '@', 1) -- Use email username as display name initially
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile when user signs up
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'create_profile_on_signup_trigger') THEN
    CREATE TRIGGER create_profile_on_signup_trigger
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION create_profile_on_signup();
  END IF;
END $$;
