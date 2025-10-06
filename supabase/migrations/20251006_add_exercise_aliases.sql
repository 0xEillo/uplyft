-- Add aliases column to exercises table for fuzzy matching
ALTER TABLE exercises
ADD COLUMN aliases text[] DEFAULT '{}';

-- Add common aliases for exercises to help with AI parsing
-- Format: aliases should include common variations without equipment specification

-- Chest exercises
UPDATE exercises SET aliases = ARRAY['bench press', 'flat bench', 'barbell bench press', 'bb bench'] WHERE name = 'Bench Press';
UPDATE exercises SET aliases = ARRAY['incline bench', 'incline press'] WHERE name = 'Incline Bench Press';
UPDATE exercises SET aliases = ARRAY['db bench', 'dumbbell bench'] WHERE name = 'Dumbbell Bench Press';
UPDATE exercises SET aliases = ARRAY['pushup', 'push up', 'pushups'] WHERE name = 'Push-ups';
UPDATE exercises SET aliases = ARRAY['chest fly', 'flyes', 'flys', 'dumbbell fly'] WHERE name = 'Chest Fly';
UPDATE exercises SET aliases = ARRAY['cable flyes', 'cable chest fly'] WHERE name = 'Cable Fly';

-- Back exercises
UPDATE exercises SET aliases = ARRAY['deadlift', 'conventional deadlift', 'dead lift', 'barbell deadlift'] WHERE name = 'Deadlift';
UPDATE exercises SET aliases = ARRAY['barbell row', 'bb row', 'bent row', 'bent over barbell row'] WHERE name = 'Bent Over Row';
UPDATE exercises SET aliases = ARRAY['pullup', 'pull up', 'pullups', 'overhand pullup'] WHERE name = 'Pull-ups';
UPDATE exercises SET aliases = ARRAY['lat pull down', 'lat pull', 'pulldown'] WHERE name = 'Lat Pulldown';
UPDATE exercises SET aliases = ARRAY['cable row', 'seated row'] WHERE name = 'Seated Cable Row';
UPDATE exercises SET aliases = ARRAY['t bar row', 'tbar row'] WHERE name = 'T-Bar Row';

-- Legs exercises
UPDATE exercises SET aliases = ARRAY['back squat', 'barbell squat', 'bb squat'] WHERE name = 'Squat';
UPDATE exercises SET aliases = ARRAY['front squat'] WHERE name = 'Front Squat';
UPDATE exercises SET aliases = ARRAY['leg press'] WHERE name = 'Leg Press';
UPDATE exercises SET aliases = ARRAY['rdl', 'romanian deadlift', 'stiff leg deadlift'] WHERE name = 'Romanian Deadlift';
UPDATE exercises SET aliases = ARRAY['hamstring curl', 'leg curls'] WHERE name = 'Leg Curl';
UPDATE exercises SET aliases = ARRAY['leg extensions', 'quad extension'] WHERE name = 'Leg Extension';
UPDATE exercises SET aliases = ARRAY['calf raises', 'calves', 'machine calf raise'] WHERE name = 'Calf Raise';
UPDATE exercises SET aliases = ARRAY['lunge', 'lunges', 'bodyweight lunge'] WHERE name = 'Lunges';

-- Shoulders exercises
UPDATE exercises SET aliases = ARRAY['ohp', 'overhead press', 'military press', 'shoulder press', 'standing press'] WHERE name = 'Overhead Press';
UPDATE exercises SET aliases = ARRAY['db shoulder press', 'dumbbell press', 'db press'] WHERE name = 'Dumbbell Shoulder Press';
UPDATE exercises SET aliases = ARRAY['lateral raises', 'side raise', 'side raises', 'lat raise'] WHERE name = 'Lateral Raise';
UPDATE exercises SET aliases = ARRAY['front raises'] WHERE name = 'Front Raise';
UPDATE exercises SET aliases = ARRAY['face pulls', 'facepull'] WHERE name = 'Face Pull';
UPDATE exercises SET aliases = ARRAY['arnold press'] WHERE name = 'Arnold Press';

-- Arms exercises (Biceps)
UPDATE exercises SET aliases = ARRAY['bicep curl', 'db curl', 'dumbbell curls', 'arm curl'] WHERE name = 'Dumbbell Curl';
UPDATE exercises SET aliases = ARRAY['bb curl', 'barbell curls', 'barbell bicep curl'] WHERE name = 'Barbell Curl';
UPDATE exercises SET aliases = ARRAY['hammer curls'] WHERE name = 'Hammer Curl';

-- Arms exercises (Triceps)
UPDATE exercises SET aliases = ARRAY['dips', 'chest dip', 'chest dips', 'tricep dip', 'tricep dips', 'bar dips', 'parallel bar dips', 'bench dip', 'bench dips'] WHERE name = 'Dip';
UPDATE exercises SET aliases = ARRAY['tricep pushdowns', 'cable pushdown', 'tricep cable pushdown'] WHERE name = 'Tricep Pushdown';
UPDATE exercises SET aliases = ARRAY['skull crushers', 'skullcrusher', 'lying tricep extension'] WHERE name = 'Skull Crusher';
UPDATE exercises SET aliases = ARRAY['close grip bench', 'cgbp', 'close bench'] WHERE name = 'Close Grip Bench Press';

-- Core exercises
UPDATE exercises SET aliases = ARRAY['planks'] WHERE name = 'Plank';
UPDATE exercises SET aliases = ARRAY['situp', 'sit up', 'crunches', 'crunch'] WHERE name = 'Sit-ups';
UPDATE exercises SET aliases = ARRAY['russian twists'] WHERE name = 'Russian Twist';
UPDATE exercises SET aliases = ARRAY['hanging leg raises', 'hanging leg raise', 'hlr'] WHERE name = 'Hanging Leg Raise';
UPDATE exercises SET aliases = ARRAY['ab roller', 'ab rollout'] WHERE name = 'Ab Wheel';

-- Glutes exercises
UPDATE exercises SET aliases = ARRAY['hip thrusts', 'barbell hip thrust', 'hip thrust'] WHERE name = 'Hip Thrust';
UPDATE exercises SET aliases = ARRAY['bulgarian split squats', 'split squat', 'bss'] WHERE name = 'Bulgarian Split Squat';
UPDATE exercises SET aliases = ARRAY['glute bridges', 'bodyweight bridge', 'bw bridge'] WHERE name = 'Glute Bridge';
UPDATE exercises SET aliases = ARRAY['cable kickbacks', 'glute kickback', 'cable glute kickback'] WHERE name = 'Cable Kickback';

-- Create index on aliases for faster searching
CREATE INDEX IF NOT EXISTS idx_exercises_aliases ON exercises USING GIN (aliases);
