-- Fix trap exercises: reassign muscle_group from 'Back' to 'Traps' for exercises
-- whose primary focus is the trapezius muscle. This ensures the trapezius body part
-- on the recovery SVG view gets correctly highlighted when users do trap-focused exercises.

UPDATE exercises
SET muscle_group = 'Traps'
WHERE created_by IS NULL  -- Only update system exercises
  AND LOWER(name) IN (
    'barbell shrug',
    'dumbbell shrug',
    'cable shrug',
    'smith machine shrug',
    'trap bar shrug',
    'hex bar shrug',
    'behind the back shrug',
    'behind-the-back barbell shrug',
    'farmers walk',
    'farmer''s walk',
    'farmer''s carry',
    'farmers carry',
    'rack pull',
    'rack pulls'
  );

-- Also add 'trapezius' as a secondary muscle to common compound back exercises
-- so partial trap activation during rows/pulldowns also feeds into recovery tracking.
-- (These exercises already have muscle_group = 'Back', this just enriches secondary data)
UPDATE exercises
SET secondary_muscles = array_append(
  COALESCE(secondary_muscles, '{}'),
  'trapezius'
)
WHERE created_by IS NULL
  AND LOWER(name) IN (
    'deadlift',
    'deadlifts',
    'romanian deadlift',
    'bent over row',
    'barbell row',
    'bent-over barbell row',
    't-bar row',
    'cable row',
    'seated cable row',
    'one arm dumbbell row',
    'single-arm dumbbell row',
    'pull-ups',
    'pullups',
    'chin-ups',
    'chinups',
    'lat pulldown',
    'face pull',
    'upright row',
    'barbell upright row',
    'dumbbell upright row',
    'cable upright row'
  )
  AND NOT (secondary_muscles @> ARRAY['trapezius']);
