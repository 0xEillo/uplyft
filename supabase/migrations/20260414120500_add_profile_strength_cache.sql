alter table public.profiles
  add column if not exists overall_strength_score integer,
  add column if not exists overall_strength_level text,
  add column if not exists overall_strength_progress integer,
  add column if not exists overall_strength_updated_at timestamptz;
