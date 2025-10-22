-- Migration: Add body metrics to body_log_images
-- Description: Adds weight, body fat %, BMI, and muscle mass columns
-- Created: 2025-10-19

-- Add metrics columns (all nullable, will be populated by AI or manual entry)
alter table body_log_images
  add column weight_kg numeric,
  add column body_fat_percentage numeric,
  add column bmi numeric,
  add column muscle_mass_kg numeric;

-- RLS Policy: Users can update their own body log images
create policy "Users can update own body log images"
  on body_log_images
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Add comments to new columns
comment on column body_log_images.weight_kg is 'User weight in kilograms (stored in metric, displayed based on user preference)';
comment on column body_log_images.body_fat_percentage is 'Estimated body fat percentage (0-100)';
comment on column body_log_images.bmi is 'Calculated Body Mass Index';
comment on column body_log_images.muscle_mass_kg is 'Estimated muscle mass in kilograms';
