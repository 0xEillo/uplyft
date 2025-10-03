-- Seed common exercises (created_by is NULL for system exercises)
INSERT INTO exercises (name, muscle_group, type, equipment) VALUES
  -- Chest
  ('Bench Press', 'Chest', 'compound', 'barbell'),
  ('Incline Bench Press', 'Chest', 'compound', 'barbell'),
  ('Dumbbell Bench Press', 'Chest', 'compound', 'dumbbell'),
  ('Push-ups', 'Chest', 'compound', 'bodyweight'),
  ('Chest Fly', 'Chest', 'isolation', 'dumbbell'),
  ('Cable Fly', 'Chest', 'isolation', 'cable'),
  
  -- Back
  ('Deadlift', 'Back', 'compound', 'barbell'),
  ('Bent Over Row', 'Back', 'compound', 'barbell'),
  ('Pull-ups', 'Back', 'compound', 'bodyweight'),
  ('Lat Pulldown', 'Back', 'compound', 'cable'),
  ('Seated Cable Row', 'Back', 'compound', 'cable'),
  ('T-Bar Row', 'Back', 'compound', 'barbell'),
  
  -- Legs
  ('Squat', 'Legs', 'compound', 'barbell'),
  ('Front Squat', 'Legs', 'compound', 'barbell'),
  ('Leg Press', 'Legs', 'compound', 'machine'),
  ('Romanian Deadlift', 'Legs', 'compound', 'barbell'),
  ('Leg Curl', 'Legs', 'isolation', 'machine'),
  ('Leg Extension', 'Legs', 'isolation', 'machine'),
  ('Calf Raise', 'Legs', 'isolation', 'machine'),
  ('Lunges', 'Legs', 'compound', 'bodyweight'),
  
  -- Shoulders
  ('Overhead Press', 'Shoulders', 'compound', 'barbell'),
  ('Dumbbell Shoulder Press', 'Shoulders', 'compound', 'dumbbell'),
  ('Lateral Raise', 'Shoulders', 'isolation', 'dumbbell'),
  ('Front Raise', 'Shoulders', 'isolation', 'dumbbell'),
  ('Face Pull', 'Shoulders', 'isolation', 'cable'),
  ('Arnold Press', 'Shoulders', 'compound', 'dumbbell'),
  
  -- Arms
  ('Barbell Curl', 'Biceps', 'isolation', 'barbell'),
  ('Dumbbell Curl', 'Biceps', 'isolation', 'dumbbell'),
  ('Hammer Curl', 'Biceps', 'isolation', 'dumbbell'),
  ('Tricep Dip', 'Triceps', 'compound', 'bodyweight'),
  ('Tricep Pushdown', 'Triceps', 'isolation', 'cable'),
  ('Skull Crusher', 'Triceps', 'isolation', 'barbell'),
  ('Close Grip Bench Press', 'Triceps', 'compound', 'barbell'),
  
  -- Core
  ('Plank', 'Core', 'isolation', 'bodyweight'),
  ('Sit-ups', 'Core', 'isolation', 'bodyweight'),
  ('Russian Twist', 'Core', 'isolation', 'bodyweight'),
  ('Hanging Leg Raise', 'Core', 'isolation', 'bodyweight'),
  ('Ab Wheel', 'Core', 'compound', 'equipment')
ON CONFLICT (name) DO NOTHING;

