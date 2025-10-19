-- Migration: Create body_log_images table
-- Description: Stores metadata for user body progress photos stored in the body-log bucket
-- Created: 2025-01-XX

-- Create body_log_images table
create table if not exists body_log_images (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  file_path text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add indexes for performance
create index if not exists body_log_images_user_id_idx on body_log_images(user_id);
create index if not exists body_log_images_created_at_idx on body_log_images(created_at desc);

-- Enable Row Level Security
alter table body_log_images enable row level security;

-- RLS Policy: Users can only view their own body log images
create policy "Users can view own body log images"
  on body_log_images
  for select
  using (auth.uid() = user_id);

-- RLS Policy: Users can only insert their own body log images
create policy "Users can insert own body log images"
  on body_log_images
  for insert
  with check (auth.uid() = user_id);

-- RLS Policy: Users can only delete their own body log images
create policy "Users can delete own body log images"
  on body_log_images
  for delete
  using (auth.uid() = user_id);

-- Add comment to table
comment on table body_log_images is 'Stores metadata for user body progress photos. Images are stored in the body-log storage bucket organized by user_id.';

-- Add comments to columns
comment on column body_log_images.id is 'Unique identifier for the body log image record';
comment on column body_log_images.user_id is 'Foreign key to auth.users - owner of the image';
comment on column body_log_images.file_path is 'Storage path in body-log bucket (format: {user_id}/{timestamp}.jpg)';
comment on column body_log_images.created_at is 'Timestamp when the image was uploaded';
