-- Add image_path and tint_color columns to workout_routines table
-- image_path: stores the file path in the routine-images storage bucket
-- tint_color: stores the hex color for the card overlay tint (set once randomly on creation)

alter table public.workout_routines
  add column if not exists image_path text,
  add column if not exists tint_color text;

-- Add comment for documentation
comment on column public.workout_routines.image_path is 'File path in routine-images storage bucket';
comment on column public.workout_routines.tint_color is 'Hex color for card overlay tint (e.g. #A3E635)';
