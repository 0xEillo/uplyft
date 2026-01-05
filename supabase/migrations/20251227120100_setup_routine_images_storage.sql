-- Setup storage bucket for routine images
-- Note: The bucket 'routine-images' should already be created in the Supabase dashboard

-- Allow public read access to routine images (they are not user-specific)
create policy "Public read access for routine images"
on storage.objects for select
using (bucket_id = 'routine-images');

-- Allow authenticated users to upload routine images (optional, for future use)
create policy "Authenticated users can upload routine images"
on storage.objects for insert
with check (
  bucket_id = 'routine-images'
  and auth.role() = 'authenticated'
);

-- Allow authenticated users to update their uploads (optional)
create policy "Authenticated users can update routine images"
on storage.objects for update
using (
  bucket_id = 'routine-images'
  and auth.role() = 'authenticated'
);
