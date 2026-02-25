-- Create storage bucket for user-uploaded custom exercise images
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'exercise-images',
  'exercise-images',
  true,
  5242880, -- 5MB limit
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

-- Allow authenticated users to upload images to their own folder
create policy "Users can upload their own exercise images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'exercise-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to update their own images
create policy "Users can update their own exercise images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'exercise-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to delete their own images
create policy "Users can delete their own exercise images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'exercise-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow public read access (bucket is public)
create policy "Public can view exercise images"
  on storage.objects for select
  to public
  using (bucket_id = 'exercise-images');
