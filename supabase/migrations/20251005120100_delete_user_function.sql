-- Function to delete current user's account
-- This will cascade delete all related data due to foreign key constraints
CREATE OR REPLACE FUNCTION delete_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete the user from auth.users (this will cascade to profiles, workout_sessions, etc.)
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;
