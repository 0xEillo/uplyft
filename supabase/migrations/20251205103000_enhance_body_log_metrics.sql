-- Add new body composition and physique analysis columns to body_log_entries

alter table body_log_entries
  add column if not exists lean_mass_kg numeric,
  add column if not exists fat_mass_kg numeric,
  add column if not exists score_v_taper integer check (score_v_taper >= 0 and score_v_taper <= 100),
  add column if not exists score_chest integer check (score_chest >= 0 and score_chest <= 100),
  add column if not exists score_shoulders integer check (score_shoulders >= 0 and score_shoulders <= 100),
  add column if not exists score_abs integer check (score_abs >= 0 and score_abs <= 100),
  add column if not exists score_arms integer check (score_arms >= 0 and score_arms <= 100),
  add column if not exists score_back integer check (score_back >= 0 and score_back <= 100),
  add column if not exists score_legs integer check (score_legs >= 0 and score_legs <= 100);

comment on column body_log_entries.lean_mass_kg is 'Calculated lean body mass in kg';
comment on column body_log_entries.fat_mass_kg is 'Calculated fat mass in kg';
comment on column body_log_entries.score_v_taper is 'AI score for V-Taper (0-100)';
comment on column body_log_entries.score_chest is 'AI score for Chest development (0-100)';
comment on column body_log_entries.score_shoulders is 'AI score for Shoulder development (0-100)';
comment on column body_log_entries.score_abs is 'AI score for Abdominal definition (0-100)';
comment on column body_log_entries.score_arms is 'AI score for Arm development (0-100)';
comment on column body_log_entries.score_back is 'AI score for Back development (0-100)';
comment on column body_log_entries.score_legs is 'AI score for Leg development (0-100)';
