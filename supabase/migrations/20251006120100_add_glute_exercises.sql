-- Add glute-focused exercises that were missing from initial seed
INSERT INTO exercises (name, muscle_group, type, equipment) VALUES
  ('Hip Thrust', 'Glutes', 'compound', 'barbell'),
  ('Bulgarian Split Squat', 'Glutes', 'compound', 'dumbbell'),
  ('Glute Bridge', 'Glutes', 'isolation', 'bodyweight'),
  ('Cable Kickback', 'Glutes', 'isolation', 'cable')
ON CONFLICT (name) DO NOTHING;
