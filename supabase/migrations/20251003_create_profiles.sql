-- Create profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_tag TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add constraint for user_tag format (lowercase alphanumeric and underscores only)
ALTER TABLE profiles ADD CONSTRAINT user_tag_format
  CHECK (user_tag ~ '^[a-z0-9_]{3,30}$');

-- Index for user_tag lookups
CREATE INDEX idx_profiles_user_tag ON profiles(user_tag);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles are viewable by everyone (for social features)
CREATE POLICY "Profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

-- Users can insert their own profile
CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Users can delete their own profile
CREATE POLICY "Users can delete their own profile"
  ON profiles FOR DELETE
  USING (auth.uid() = id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on profile updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION create_profile_on_signup()
RETURNS TRIGGER AS $$
DECLARE
  base_tag TEXT;
  unique_tag TEXT;
  counter INTEGER := 0;
BEGIN
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
    split_part(NEW.email, '@', 1) -- Use email username as display name initially
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile when user signs up
CREATE TRIGGER create_profile_on_signup_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_profile_on_signup();
