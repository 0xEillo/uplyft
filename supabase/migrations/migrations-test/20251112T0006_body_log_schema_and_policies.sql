-- Body log tables, policies, and storage access rules

-- Initial body_log_images table for single-image entries
create table if not exists body_log_images (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  file_path text not null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists body_log_images_user_id_idx on body_log_images(user_id);
create index if not exists body_log_images_created_at_idx on body_log_images(created_at desc);

alter table body_log_images enable row level security;

create policy "Users can view own body log images"
  on body_log_images
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own body log images"
  on body_log_images
  for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own body log images"
  on body_log_images
  for delete
  using (auth.uid() = user_id);

comment on table body_log_images is
  'Stores metadata for user body progress photos. Images are stored in the body-log storage bucket organized by user_id.';
comment on column body_log_images.id is
  'Unique identifier for the body log image record';
comment on column body_log_images.user_id is
  'Foreign key to auth.users - owner of the image';
comment on column body_log_images.file_path is
  'Storage path in body-log bucket (format: {user_id}/{timestamp}.jpg)';
comment on column body_log_images.created_at is
  'Timestamp when the image was uploaded';

-- Additional metrics per image (legacy before refactor)
alter table body_log_images
  add column weight_kg numeric,
  add column body_fat_percentage numeric,
  add column bmi numeric,
  add column muscle_mass_kg numeric;

create policy "Users can update own body log images"
  on body_log_images
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on column body_log_images.weight_kg is
  'User weight in kilograms (stored in metric, displayed based on user preference)';
comment on column body_log_images.body_fat_percentage is
  'Estimated body fat percentage (0-100)';
comment on column body_log_images.bmi is
  'Calculated Body Mass Index';
comment on column body_log_images.muscle_mass_kg is
  'Estimated muscle mass in kilograms';

-- Refactor: introduce body_log_entries table with 1:N images
create table if not exists body_log_entries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  weight_kg numeric,
  body_fat_percentage numeric,
  bmi numeric,
  muscle_mass_kg numeric
);

create index if not exists body_log_entries_user_id_idx on body_log_entries(user_id);
create index if not exists body_log_entries_created_at_idx on body_log_entries(created_at desc);
create index if not exists body_log_entries_user_id_created_at_idx on body_log_entries(user_id, created_at desc);

alter table body_log_entries enable row level security;

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

comment on table body_log_entries is
  'Stores body composition entry metadata and aggregated AI metrics. Each entry can have 1-3 associated images.';
comment on column body_log_entries.id is 'Unique identifier for the entry';
comment on column body_log_entries.user_id is 'Foreign key to auth.users - entry owner';
comment on column body_log_entries.created_at is 'Timestamp when entry was created';
comment on column body_log_entries.weight_kg is 'Aggregated weight from AI analysis';
comment on column body_log_entries.body_fat_percentage is 'Aggregated body fat % from AI analysis';
comment on column body_log_entries.bmi is 'Aggregated BMI from AI analysis';
comment on column body_log_entries.muscle_mass_kg is 'Aggregated muscle mass from AI analysis';

-- Migrate legacy body_log_images schema to entry-based model
alter table body_log_images
  drop column if exists weight_kg,
  drop column if exists body_fat_percentage,
  drop column if exists bmi,
  drop column if exists muscle_mass_kg;

alter table body_log_images
  add column entry_id uuid references body_log_entries(id) on delete cascade,
  add column sequence integer check (sequence >= 1 and sequence <= 3);

do $$
declare
  img record;
  new_entry_id uuid;
begin
  for img in select id, user_id, created_at from body_log_images loop
    insert into body_log_entries (id, user_id, created_at)
    values (gen_random_uuid(), img.user_id, img.created_at)
    returning id into new_entry_id;

    update body_log_images
      set entry_id = new_entry_id,
          sequence = 1
      where id = img.id;
  end loop;
end $$;

alter table body_log_images
  alter column entry_id set not null,
  alter column sequence set not null;

create index if not exists body_log_images_entry_id_idx on body_log_images(entry_id);
create index if not exists body_log_images_entry_id_sequence_idx on body_log_images(entry_id, sequence);

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

comment on column body_log_images.entry_id is
  'Foreign key to body_log_entries - which entry this image belongs to';
comment on column body_log_images.sequence is
  'Image sequence in entry (1, 2, or 3)';

-- Store AI analysis text alongside aggregated metrics
alter table body_log_entries
  add column if not exists analysis_summary text;

-- Storage policies for private body-log bucket
create policy "Users can upload to own folder in body-log"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'body-log'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can view own images in body-log"
on storage.objects for select
to authenticated
using (
  bucket_id = 'body-log'
  and (storage.foldername(name))[1] = auth.uid()::text
);

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

create policy "Users can delete own images in body-log"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'body-log'
  and (storage.foldername(name))[1] = auth.uid()::text
);

