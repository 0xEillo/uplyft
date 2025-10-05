-- Note: Create the 'avatars' bucket manually in Supabase Dashboard
-- Go to Storage > Create new bucket > name: "avatars", set as Public

-- Allow authenticated users to upload their own avatars
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = 'avatars' AND
  auth.uid()::text = (string_to_array(storage.filename(name), '-'))[1]
);

-- Allow authenticated users to update their own avatars
CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = 'avatars' AND
  auth.uid()::text = (string_to_array(storage.filename(name), '-'))[1]
);

-- Allow authenticated users to delete their own avatars
CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = 'avatars' AND
  auth.uid()::text = (string_to_array(storage.filename(name), '-'))[1]
);

-- Allow public to view all avatars
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');
