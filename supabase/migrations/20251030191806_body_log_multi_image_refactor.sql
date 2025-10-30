-- Migration: Create body log multi-image architecture
-- Description: Creates two-table schema to support 1-3 images per body log entry
-- Created: 2025-10-30

-- Create body_log_entries table (parent - stores aggregated metrics)
create table if not exists body_log_entries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  weight_kg numeric,
  body_fat_percentage numeric,
  bmi numeric,
  muscle_mass_kg numeric
);

-- Create indexes for performance
create index if not exists body_log_entries_user_id_idx on body_log_entries(user_id);
create index if not exists body_log_entries_created_at_idx on body_log_entries(created_at desc);
create index if not exists body_log_entries_user_id_created_at_idx on body_log_entries(user_id, created_at desc);

-- Enable Row Level Security
alter table body_log_entries enable row level security;

-- RLS Policies for entries
create policy "Users can view own body log entries"
  on body_log_entries
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own body log entries"
  on body_log_entries
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own body log entries"
  on body_log_entries
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own body log entries"
  on body_log_entries
  for delete
  using (auth.uid() = user_id);

-- Table comments
comment on table body_log_entries is 'Stores body composition entry metadata and aggregated AI metrics. Each entry can have 1-3 associated images.';
comment on column body_log_entries.id is 'Unique identifier for the entry';
comment on column body_log_entries.user_id is 'Foreign key to auth.users - entry owner';
comment on column body_log_entries.created_at is 'Timestamp when entry was created';
comment on column body_log_entries.weight_kg is 'Aggregated weight from AI analysis';
comment on column body_log_entries.body_fat_percentage is 'Aggregated body fat % from AI analysis';
comment on column body_log_entries.bmi is 'Aggregated BMI from AI analysis';
comment on column body_log_entries.muscle_mass_kg is 'Aggregated muscle mass from AI analysis';

-- Update body_log_images table structure
-- Drop old metric columns (now stored in body_log_entries)
alter table body_log_images
  drop column if exists weight_kg,
  drop column if exists body_fat_percentage,
  drop column if exists bmi,
  drop column if exists muscle_mass_kg;

-- Add new columns as nullable first
alter table body_log_images
  add column entry_id uuid references body_log_entries(id) on delete cascade,
  add column sequence integer check (sequence >= 1 and sequence <= 3);

-- Migrate existing images to entries
-- For each image, create a corresponding entry and link it
do $$
declare
  img record;
  new_entry_id uuid;
begin
  for img in select id, user_id, created_at from body_log_images loop
    -- Create entry for this image
    insert into body_log_entries (id, user_id, created_at)
    values (gen_random_uuid(), img.user_id, img.created_at)
    returning id into new_entry_id;

    -- Link image to entry
    update body_log_images
    set entry_id = new_entry_id, sequence = 1
    where id = img.id;
  end loop;
end $$;

-- Now make the columns NOT NULL
alter table body_log_images
  alter column entry_id set not null,
  alter column sequence set not null;

-- Create indexes for image queries
create index if not exists body_log_images_entry_id_idx on body_log_images(entry_id);
create index if not exists body_log_images_entry_id_sequence_idx on body_log_images(entry_id, sequence);

-- Update RLS policies for body_log_images
drop policy if exists "Users can view own body log images" on body_log_images;
drop policy if exists "Users can insert own body log images" on body_log_images;
drop policy if exists "Users can delete own body log images" on body_log_images;

create policy "Users can view body log images for their entries"
  on body_log_images
  for select
  using (auth.uid() = user_id);

create policy "Users can insert body log images for their entries"
  on body_log_images
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update body log images for their entries"
  on body_log_images
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete body log images for their entries"
  on body_log_images
  for delete
  using (auth.uid() = user_id);

-- Update column comments for body_log_images
comment on column body_log_images.entry_id is 'Foreign key to body_log_entries - which entry this image belongs to';
comment on column body_log_images.sequence is 'Image sequence in entry (1, 2, or 3)';
