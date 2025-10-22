-- Migration: Setup body-log storage bucket policies
-- Description: Configures RLS policies for the body-log storage bucket to allow users private access to their images
-- Created: 2025-01-XX

-- Note: Ensure the 'body-log' bucket already exists and is NOT public
-- If it doesn't exist, create it first in the Supabase Dashboard (Storage section)
-- with public access set to FALSE

-- Enable RLS on the storage.objects table for the body-log bucket
-- This is required for the policies to work

-- Policy: Users can upload images to their own folder
create policy "Users can upload to own folder in body-log"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'body-log'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can view/download images from their own folder
create policy "Users can view own images in body-log"
on storage.objects for select
to authenticated
using (
  bucket_id = 'body-log'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can update images in their own folder
create policy "Users can update own images in body-log"
on storage.objects for update
to authenticated
using (
  bucket_id = 'body-log'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'body-log'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can delete images from their own folder
create policy "Users can delete own images in body-log"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'body-log'
  and (storage.foldername(name))[1] = auth.uid()::text
);
