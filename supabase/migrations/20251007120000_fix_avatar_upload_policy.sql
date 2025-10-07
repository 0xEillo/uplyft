-- Fix the avatar upload RLS policies to correctly validate user IDs in filenames

-- Drop existing policies
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;

-- Allow authenticated users to upload their own avatars
-- Filename format: {user_id}-{timestamp}.{ext}
-- We check if the filename starts with the user's ID followed by a dash
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = 'avatars' AND
  (storage.filename(name)) LIKE (auth.uid()::text || '-%')
);

-- Allow authenticated users to update their own avatars
CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = 'avatars' AND
  (storage.filename(name)) LIKE (auth.uid()::text || '-%')
);

-- Allow authenticated users to delete their own avatars
CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = 'avatars' AND
  (storage.filename(name)) LIKE (auth.uid()::text || '-%')
);
