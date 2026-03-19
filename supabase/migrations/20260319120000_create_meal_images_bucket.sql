-- Create a private storage bucket for daily log meal photos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'meal-images',
  'meal-images',
  false,
  5242880,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

drop policy if exists "Users can upload their own meal images" on storage.objects;
drop policy if exists "Users can view their own meal images" on storage.objects;
drop policy if exists "Users can update their own meal images" on storage.objects;
drop policy if exists "Users can delete their own meal images" on storage.objects;

create policy "Users can upload their own meal images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'meal-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can view their own meal images"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'meal-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can update their own meal images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'meal-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete their own meal images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'meal-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
