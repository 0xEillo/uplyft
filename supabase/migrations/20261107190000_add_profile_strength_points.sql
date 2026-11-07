-- Strength scores moved from a 0-1000 to a 0-10000 scale in app 1.0.33.
-- overall_strength_points caches the new-scale score. overall_strength_score
-- stays on the old scale (points / 10) so older app versions keep working.
-- Readers fall back to overall_strength_score * 10 until a profile is
-- refreshed by a new client or edge function.
alter table public.profiles
  add column if not exists overall_strength_points integer;
