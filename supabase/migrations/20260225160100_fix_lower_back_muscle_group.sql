-- Fix lower back exercises: reassign muscle_group for exercises whose primary focus
-- is the lower back / erector spinae. This ensures the lower-back SVG region on the
-- recovery body view gets correctly highlighted.
--
-- Also adds 'lower back' as a secondary muscle to heavy compound exercises that
-- significantly load the erectors (deadlifts, rows, squats, etc.).

-- 1. Reassign primary muscle_group for lower-back-focused exercises
UPDATE exercises
SET muscle_group = 'Lower Back'
WHERE created_by IS NULL  -- Only update system exercises
  AND LOWER(name) IN (
    'good morning',
    'back extension',
    'back extensions',
    'hyperextension',
    'hyperextensions',
    '45 degree hyperextension',
    'reverse hyperextension',
    'reverse hyperextensions',
    'superman',
    'supermans',
    'roman chair back extension'
  );

-- 2. Add 'lower back' as a secondary muscle to compound exercises that heavily
-- load the erectors, so partial lower back activation feeds into recovery tracking.
UPDATE exercises
SET secondary_muscles = array_append(
  COALESCE(secondary_muscles, '{}'),
  'lower back'
)
WHERE created_by IS NULL
  AND LOWER(name) IN (
    'deadlift',
    'deadlifts',
    'sumo deadlift',
    'romanian deadlift',
    'single leg romanian deadlift',
    'rack pull',
    'rack pulls',
    'barbell squat',
    'squat',
    'front squat',
    'deficit deadlift',
    'bent over row',
    'barbell row',
    'bent-over barbell row',
    't-bar row',
    'pendlay row',
    'good morning'
  )
  AND NOT (secondary_muscles @> ARRAY['lower back']);
