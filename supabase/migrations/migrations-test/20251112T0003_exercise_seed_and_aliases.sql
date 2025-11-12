-- Seed baseline exercises and set up alias metadata

insert into exercises (name, muscle_group, type, equipment) values
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
  ('Dip', 'Triceps', 'compound', 'bodyweight'),
  ('Tricep Pushdown', 'Triceps', 'isolation', 'cable'),
  ('Skull Crusher', 'Triceps', 'isolation', 'barbell'),
  ('Close Grip Bench Press', 'Triceps', 'compound', 'barbell'),

  -- Core
  ('Plank', 'Core', 'isolation', 'bodyweight'),
  ('Sit-ups', 'Core', 'isolation', 'bodyweight'),
  ('Russian Twist', 'Core', 'isolation', 'bodyweight'),
  ('Hanging Leg Raise', 'Core', 'isolation', 'bodyweight'),
  ('Ab Wheel', 'Core', 'compound', 'equipment')
on conflict (name) do nothing;

-- Aliases column for fuzzy matching
alter table exercises
add column aliases text[] default '{}';

-- Seed alias metadata (intentional order to match production run)

-- Chest exercises
update exercises set aliases = array['bench press', 'flat bench', 'barbell bench press', 'bb bench'] where name = 'Bench Press';
update exercises set aliases = array['incline bench', 'incline press'] where name = 'Incline Bench Press';
update exercises set aliases = array['db bench', 'dumbbell bench'] where name = 'Dumbbell Bench Press';
update exercises set aliases = array['pushup', 'push up', 'pushups'] where name = 'Push-ups';
update exercises set aliases = array['chest fly', 'flyes', 'flys', 'dumbbell fly'] where name = 'Chest Fly';
update exercises set aliases = array['cable flyes', 'cable chest fly'] where name = 'Cable Fly';

-- Back exercises
update exercises set aliases = array['deadlift', 'conventional deadlift', 'dead lift', 'barbell deadlift'] where name = 'Deadlift';
update exercises set aliases = array['barbell row', 'bb row', 'bent row', 'bent over barbell row'] where name = 'Bent Over Row';
update exercises set aliases = array['pullup', 'pull up', 'pullups', 'overhand pullup'] where name = 'Pull-ups';
update exercises set aliases = array['lat pull down', 'lat pull', 'pulldown'] where name = 'Lat Pulldown';
update exercises set aliases = array['cable row', 'seated row'] where name = 'Seated Cable Row';
update exercises set aliases = array['t bar row', 'tbar row'] where name = 'T-Bar Row';

-- Legs exercises
update exercises set aliases = array['back squat', 'barbell squat', 'bb squat'] where name = 'Squat';
update exercises set aliases = array['front squat'] where name = 'Front Squat';
update exercises set aliases = array['leg press'] where name = 'Leg Press';
update exercises set aliases = array['rdl', 'romanian deadlift', 'stiff leg deadlift'] where name = 'Romanian Deadlift';
update exercises set aliases = array['hamstring curl', 'leg curls'] where name = 'Leg Curl';
update exercises set aliases = array['leg extensions', 'quad extension'] where name = 'Leg Extension';
update exercises set aliases = array['calf raises', 'calves', 'machine calf raise'] where name = 'Calf Raise';
update exercises set aliases = array['lunge', 'lunges', 'bodyweight lunge'] where name = 'Lunges';

-- Shoulders exercises
update exercises set aliases = array['ohp', 'overhead press', 'military press', 'shoulder press', 'standing press'] where name = 'Overhead Press';
update exercises set aliases = array['db shoulder press', 'dumbbell press', 'db press'] where name = 'Dumbbell Shoulder Press';
update exercises set aliases = array['lateral raises', 'side raise', 'side raises', 'lat raise'] where name = 'Lateral Raise';
update exercises set aliases = array['front raises'] where name = 'Front Raise';
update exercises set aliases = array['face pulls', 'facepull'] where name = 'Face Pull';
update exercises set aliases = array['arnold press'] where name = 'Arnold Press';

-- Arms exercises (Biceps)
update exercises set aliases = array['bicep curl', 'db curl', 'dumbbell curls', 'arm curl'] where name = 'Dumbbell Curl';
update exercises set aliases = array['bb curl', 'barbell curls', 'barbell bicep curl'] where name = 'Barbell Curl';
update exercises set aliases = array['hammer curls'] where name = 'Hammer Curl';

-- Arms exercises (Triceps)
update exercises set aliases = array['dips', 'chest dip', 'chest dips', 'tricep dip', 'tricep dips', 'bar dips', 'parallel bar dips', 'bench dip', 'bench dips'] where name = 'Dip';
update exercises set aliases = array['tricep pushdowns', 'cable pushdown', 'tricep cable pushdown'] where name = 'Tricep Pushdown';
update exercises set aliases = array['skull crushers', 'skullcrusher', 'lying tricep extension'] where name = 'Skull Crusher';
update exercises set aliases = array['close grip bench', 'cgbp', 'close bench'] where name = 'Close Grip Bench Press';

-- Core exercises
update exercises set aliases = array['planks'] where name = 'Plank';
update exercises set aliases = array['situp', 'sit up', 'crunches', 'crunch'] where name = 'Sit-ups';
update exercises set aliases = array['russian twists'] where name = 'Russian Twist';
update exercises set aliases = array['hanging leg raises', 'hanging leg raise', 'hlr'] where name = 'Hanging Leg Raise';
update exercises set aliases = array['ab roller', 'ab rollout'] where name = 'Ab Wheel';

-- Glutes exercises (some were inserted in later migrations; updates preserved for parity)
update exercises set aliases = array['hip thrusts', 'barbell hip thrust', 'hip thrust'] where name = 'Hip Thrust';
update exercises set aliases = array['bulgarian split squats', 'split squat', 'bss'] where name = 'Bulgarian Split Squat';
update exercises set aliases = array['glute bridges', 'bodyweight bridge', 'bw bridge'] where name = 'Glute Bridge';
update exercises set aliases = array['cable kickbacks', 'glute kickback', 'cable glute kickback'] where name = 'Cable Kickback';

-- GIN index on aliases
create index if not exists idx_exercises_aliases on exercises using gin (aliases);

-- Add glute-focused exercises
insert into exercises (name, muscle_group, type, equipment) values
  ('Hip Thrust', 'Glutes', 'compound', 'barbell'),
  ('Bulgarian Split Squat', 'Glutes', 'compound', 'dumbbell'),
  ('Glute Bridge', 'Glutes', 'isolation', 'bodyweight'),
  ('Cable Kickback', 'Glutes', 'isolation', 'cable')
on conflict (name) do nothing;

-- Expanded exercise library (truncated comment retained from original migration)
insert into exercises (name, muscle_group, type, equipment, aliases) values
  -- CHEST
  ('Decline Bench Press', 'Chest', 'compound', 'barbell', array['decline bench', 'decline press', 'decline barbell bench']),
  ('Decline Dumbbell Bench Press', 'Chest', 'compound', 'dumbbell', array['decline db bench', 'decline dumbbell press']),
  ('Incline Dumbbell Bench Press', 'Chest', 'compound', 'dumbbell', array['incline db bench', 'incline dumbbell press']),
  ('Incline Dumbbell Fly', 'Chest', 'isolation', 'dumbbell', array['incline fly', 'incline flyes', 'incline dumbbell flyes']),
  ('Decline Dumbbell Fly', 'Chest', 'isolation', 'dumbbell', array['decline fly', 'decline flyes']),
  ('Cable Crossover', 'Chest', 'isolation', 'cable', array['cable cross', 'cable fly crossover', 'crossover']),
  ('Pec Deck', 'Chest', 'isolation', 'machine', array['pec deck fly', 'pec deck machine', 'butterfly', 'pec fly machine']),
  ('Machine Chest Press', 'Chest', 'compound', 'machine', array['machine chest', 'chest press machine', 'chest machine press']),
  ('Landmine Press', 'Chest', 'compound', 'barbell', array['landmine chest press', 'landmine press']),

  -- BACK
  ('Single Arm Dumbbell Row', 'Back', 'compound', 'dumbbell', array['one arm row', 'one arm db row', 'single arm db row', 'single arm dumbbell row']),
  ('Pendlay Row', 'Back', 'compound', 'barbell', array['pendlay rows', 'dead stop row']),
  ('Chest Supported Row', 'Back', 'compound', 'dumbbell', array['incline row', 'supported row', 'incline db row']),
  ('Dumbbell Pullover', 'Back', 'isolation', 'dumbbell', array['pullover', 'pullovers', 'db pullover']),
  ('Cable Pullover', 'Back', 'isolation', 'cable', array['straight arm pulldown', 'cable pullovers']),
  ('Barbell Shrug', 'Back', 'isolation', 'barbell', array['bb shrug', 'trap shrug', 'barbell shrugs']),
  ('Dumbbell Shrug', 'Back', 'isolation', 'dumbbell', array['db shrug', 'dumbbell shrugs', 'db shrugs']),
  ('Rack Pull', 'Back', 'compound', 'barbell', array['rack pulls', 'rack deadlift']),
  ('Sumo Deadlift', 'Back', 'compound', 'barbell', array['sumo dl', 'sumo']),
  ('Seal Row', 'Back', 'compound', 'barbell', array['seal rows']),
  ('Meadows Row', 'Back', 'compound', 'barbell', array['landmine row', 'meadows rows']),
  ('Wide Grip Lat Pulldown', 'Back', 'compound', 'cable', array['wide lat pulldown', 'wide grip pulldown', 'wide grip lat pull']),
  ('Close Grip Lat Pulldown', 'Back', 'compound', 'cable', array['close grip lat pulldown', 'narrow grip pulldown', 'narrow lat pulldown']),
  ('Underhand Lat Pulldown', 'Back', 'compound', 'cable', array['supinated pulldown', 'reverse grip pulldown', 'underhand pulldown']),
  ('Reverse Fly', 'Back', 'isolation', 'dumbbell', array['rear delt fly', 'reverse flyes', 'bent over reverse fly', 'rear delt flyes']),
  ('Cable Reverse Fly', 'Back', 'isolation', 'cable', array['cable rear delt fly', 'cable reverse flyes']),
  ('Machine Row', 'Back', 'compound', 'machine', array['machine rows', 'seated machine row']),
  ('Inverted Row', 'Back', 'compound', 'bodyweight', array['australian pullup', 'bodyweight row', 'inverted rows']),
  ('Chin-ups', 'Back', 'compound', 'bodyweight', array['chin up', 'chinup', 'chinups', 'underhand pullup']),

  -- LEGS - QUADS
  ('Hack Squat', 'Legs', 'compound', 'machine', array['hack squats', 'hack squat machine']),
  ('Goblet Squat', 'Legs', 'compound', 'dumbbell', array['goblet squats', 'kettlebell squat']),
  ('Walking Lunge', 'Legs', 'compound', 'bodyweight', array['walking lunges', 'forward lunge']),
  ('Reverse Lunge', 'Legs', 'compound', 'bodyweight', array['reverse lunges', 'backward lunge']),
  ('Step Up', 'Legs', 'compound', 'bodyweight', array['step ups', 'box step up', 'box step ups']),
  ('Sissy Squat', 'Legs', 'isolation', 'bodyweight', array['sissy squats']),
  ('Box Squat', 'Legs', 'compound', 'barbell', array['box squats']),
  ('Safety Bar Squat', 'Legs', 'compound', 'barbell', array['ssb squat', 'safety squat bar']),

  -- LEGS - HAMSTRINGS
  ('Nordic Curl', 'Legs', 'isolation', 'bodyweight', array['nordic curls', 'nordic hamstring curl', 'nordics']),
  ('Swiss Ball Leg Curl', 'Legs', 'isolation', 'bodyweight', array['stability ball curl', 'physio ball curl']),
  ('Single Leg Romanian Deadlift', 'Legs', 'compound', 'dumbbell', array['single leg rdl', 'one leg rdl', 'sldl']),
  ('Good Morning', 'Legs', 'compound', 'barbell', array['good mornings', 'barbell good morning']),
  ('Seated Leg Curl', 'Legs', 'isolation', 'machine', array['seated hamstring curl', 'seated leg curls']),
  ('Lying Leg Curl', 'Legs', 'isolation', 'machine', array['lying hamstring curl', 'prone leg curl']),
  ('Standing Leg Curl', 'Legs', 'isolation', 'machine', array['standing hamstring curl']),

  -- GLUTES
  ('Single Leg Glute Bridge', 'Glutes', 'isolation', 'bodyweight', array['single leg bridge', 'one leg bridge']),
  ('Barbell Glute Bridge', 'Glutes', 'compound', 'barbell', array['barbell bridge', 'bb glute bridge']),
  ('Donkey Kick', 'Glutes', 'isolation', 'bodyweight', array['donkey kicks', 'quadruped hip extension']),
  ('Fire Hydrant', 'Glutes', 'isolation', 'bodyweight', array['fire hydrants', 'quadruped hip abduction']),
  ('Banded Lateral Walk', 'Glutes', 'isolation', 'bands', array['monster walk', 'band walk', 'side walk']),
  ('Deficit Deadlift', 'Glutes', 'compound', 'barbell', array['deficit dl', 'deficit deadlifts']),
  ('B-Stance Hip Thrust', 'Glutes', 'compound', 'barbell', array['kickstand hip thrust', 'staggered hip thrust']),
  ('Frog Pump', 'Glutes', 'isolation', 'bodyweight', array['frog pumps', 'frog glute bridge']),

  -- CALVES
  ('Standing Calf Raise', 'Calves', 'isolation', 'machine', array['calf raise', 'standing calves', 'standing calf raises']),
  ('Seated Calf Raise', 'Calves', 'isolation', 'machine', array['seated calves', 'seated calf raises']),
  ('Donkey Calf Raise', 'Calves', 'isolation', 'machine', array['donkey calves', 'donkey calf raises']),
  ('Single Leg Calf Raise', 'Calves', 'isolation', 'bodyweight', array['one leg calf raise', 'single calf raise']),

  -- SHOULDERS
  ('Rear Delt Fly', 'Shoulders', 'isolation', 'dumbbell', array['rear delt flyes', 'reverse delt fly', 'bent over lateral raise']),
  ('Upright Row', 'Shoulders', 'compound', 'barbell', array['upright rows', 'barbell upright row']),
  ('Cable Lateral Raise', 'Shoulders', 'isolation', 'cable', array['cable side raise', 'cable lateral raises']),
  ('Machine Shoulder Press', 'Shoulders', 'compound', 'machine', array['shoulder press machine', 'machine shoulder']),
  ('Behind the Neck Press', 'Shoulders', 'compound', 'barbell', array['btn press', 'behind neck press']),
  ('Push Press', 'Shoulders', 'compound', 'barbell', array['push press', 'push jerk']),
  ('Dumbbell Upright Row', 'Shoulders', 'compound', 'dumbbell', array['db upright row']),
  ('Cable Front Raise', 'Shoulders', 'isolation', 'cable', array['cable front raises']),
  ('Cable Rear Delt Fly', 'Shoulders', 'isolation', 'cable', array['cable rear delt flyes', 'cable reverse fly']),
  ('Machine Lateral Raise', 'Shoulders', 'isolation', 'machine', array['machine side raise']),
  ('Barbell Front Raise', 'Shoulders', 'isolation', 'barbell', array['barbell front raises']),
  ('Y Raise', 'Shoulders', 'isolation', 'dumbbell', array['y raises', 'incline y raise']),
  ('W Raise', 'Shoulders', 'isolation', 'dumbbell', array['w raises']),

  -- BICEPS
  ('Preacher Curl', 'Biceps', 'isolation', 'barbell', array['preacher curls', 'barbell preacher curl', 'ez bar preacher curl']),
  ('Dumbbell Preacher Curl', 'Biceps', 'isolation', 'dumbbell', array['db preacher curl', 'dumbbell preacher curls']),
  ('Concentration Curl', 'Biceps', 'isolation', 'dumbbell', array['concentration curls', 'seated concentration curl']),
  ('Cable Curl', 'Biceps', 'isolation', 'cable', array['cable curls', 'cable bicep curl']),
  ('Incline Dumbbell Curl', 'Biceps', 'isolation', 'dumbbell', array['incline curl', 'incline db curl']),
  ('Reverse Curl', 'Biceps', 'isolation', 'barbell', array['reverse curls', 'reverse barbell curl', 'reverse grip barbell curl']),
  ('Spider Curl', 'Biceps', 'isolation', 'barbell', array['spider curls', 'prone curl']),
  ('Zottman Curl', 'Biceps', 'isolation', 'dumbbell', array['zottman curls']),
  ('EZ Bar Curl', 'Biceps', 'isolation', 'barbell', array['ez curl', 'ez bar curls', 'easy bar curl']),
  ('Cable Hammer Curl', 'Biceps', 'isolation', 'cable', array['rope hammer curl', 'cable hammer curls']),
  ('Cross Body Hammer Curl', 'Biceps', 'isolation', 'dumbbell', array['cross body curl', 'pinwheel curl']),

  -- TRICEPS
  ('Overhead Tricep Extension', 'Triceps', 'isolation', 'dumbbell', array['dumbbell overhead extension', 'tricep overhead extension', 'db overhead extension']),
  ('Cable Overhead Tricep Extension', 'Triceps', 'isolation', 'cable', array['cable overhead tricep extension', 'rope overhead extension', 'cable overhead extension']),
  ('Diamond Push-up', 'Triceps', 'compound', 'bodyweight', array['diamond pushup', 'diamond pushups', 'diamond push ups']),
  ('Tricep Kickback', 'Triceps', 'isolation', 'dumbbell', array['tricep kickbacks', 'dumbbell kickback', 'db kickback']),
  ('French Press', 'Triceps', 'isolation', 'barbell', array['lying tricep extension', 'french press']),
  ('Rope Pushdown', 'Triceps', 'isolation', 'cable', array['rope tricep pushdown', 'rope extension']),
  ('Single Arm Cable Pushdown', 'Triceps', 'isolation', 'cable', array['one arm pushdown', 'single arm tricep pushdown']),
  ('Overhead Cable Tricep Extension', 'Triceps', 'isolation', 'cable', array['overhead cable extension']),
  ('Dumbbell Skull Crusher', 'Triceps', 'isolation', 'dumbbell', array['db skull crusher', 'dumbbell lying tricep extension']),
  ('Close Grip Push-up', 'Triceps', 'compound', 'bodyweight', array['close grip pushup', 'narrow pushup']),
  ('Tate Press', 'Triceps', 'isolation', 'dumbbell', array['tate press']),

  -- CORE
  ('Cable Crunch', 'Core', 'isolation', 'cable', array['cable crunches', 'kneeling cable crunch']),
  ('Bicycle Crunch', 'Core', 'isolation', 'bodyweight', array['bicycle crunches', 'bicycle']),
  ('Mountain Climber', 'Core', 'compound', 'bodyweight', array['mountain climbers']),
  ('Side Plank', 'Core', 'isolation', 'bodyweight', array['side planks', 'lateral plank']),
  ('Dead Bug', 'Core', 'isolation', 'bodyweight', array['deadbug', 'dead bugs']),
  ('Bird Dog', 'Core', 'isolation', 'bodyweight', array['birddog', 'bird dogs']),
  ('Pallof Press', 'Core', 'isolation', 'cable', array['pallof', 'pallof press']),
  ('Cable Woodchopper', 'Core', 'compound', 'cable', array['woodchop', 'wood chopper', 'cable chop']),
  ('Decline Sit-up', 'Core', 'isolation', 'bodyweight', array['decline situp', 'decline crunches']),
  ('Toe Touch', 'Core', 'isolation', 'bodyweight', array['toe touches', 'lying toe touch']),
  ('V-up', 'Core', 'isolation', 'bodyweight', array['v ups', 'jackknife']),
  ('Hollow Hold', 'Core', 'isolation', 'bodyweight', array['hollow body hold', 'hollow rocks']),
  ('L-Sit', 'Core', 'isolation', 'bodyweight', array['l sit', 'l-sits']),
  ('Windshield Wiper', 'Core', 'isolation', 'bodyweight', array['windshield wipers', 'hanging windshield wiper']),
  ('Dragon Flag', 'Core', 'compound', 'bodyweight', array['dragon flags']),
  ('Leg Raise', 'Core', 'isolation', 'bodyweight', array['leg raises', 'lying leg raise']),

  -- FOREARMS
  ('Wrist Curl', 'Forearms', 'isolation', 'barbell', array['wrist curls', 'barbell wrist curl', 'forearm curl']),
  ('Reverse Wrist Curl', 'Forearms', 'isolation', 'barbell', array['reverse wrist curls', 'reverse forearm curl']),
  ('Farmer Walk', 'Forearms', 'compound', 'dumbbell', array['farmers walk', 'farmers carry', 'farmer carry']),
  ('Dead Hang', 'Forearms', 'isolation', 'bodyweight', array['dead hangs', 'bar hang']),
  ('Plate Pinch', 'Forearms', 'isolation', 'equipment', array['plate pinch hold', 'pinch grip']),
  ('Dumbbell Wrist Curl', 'Forearms', 'isolation', 'dumbbell', array['db wrist curl', 'db wrist curls']),

  -- OLYMPIC / FULL BODY
  ('Clean', 'Full Body', 'compound', 'barbell', array['barbell clean', 'full clean']),
  ('Clean and Jerk', 'Full Body', 'compound', 'barbell', array['clean & jerk', 'clean jerk']),
  ('Snatch', 'Full Body', 'compound', 'barbell', array['barbell snatch', 'full snatch']),
  ('Power Clean', 'Full Body', 'compound', 'barbell', array['powerclean', 'power cleans']),
  ('Hang Clean', 'Full Body', 'compound', 'barbell', array['hang cleans', 'hanging clean']),
  ('Thruster', 'Full Body', 'compound', 'barbell', array['thrusters', 'squat press']),
  ('Burpee', 'Full Body', 'compound', 'bodyweight', array['burpees', 'burpee jump']),
  ('Box Jump', 'Full Body', 'compound', 'bodyweight', array['box jumps', 'jump box']),
  ('Jump Squat', 'Full Body', 'compound', 'bodyweight', array['jump squats', 'squat jump']),
  ('Kettlebell Swing', 'Full Body', 'compound', 'kettlebell', array['kb swing', 'russian swing', 'kettlebell swings']),
  ('Turkish Get-up', 'Full Body', 'compound', 'kettlebell', array['tgu', 'turkish getup', 'get up']),
  ('Man Maker', 'Full Body', 'compound', 'dumbbell', array['manmaker', 'man makers']),
  ('Wall Ball', 'Full Body', 'compound', 'medicine ball', array['wall balls', 'wallball']),
  ('Sled Push', 'Full Body', 'compound', 'equipment', array['prowler push', 'sled pushes']),
  ('Sled Pull', 'Full Body', 'compound', 'equipment', array['prowler pull', 'sled pulls']),
  ('Battle Rope', 'Full Body', 'compound', 'equipment', array['battle ropes', 'rope waves']),

  -- CARDIO
  ('Running', 'Cardio', 'cardio', 'bodyweight', array['run', 'jog', 'jogging', 'treadmill']),
  ('Cycling', 'Cardio', 'cardio', 'equipment', array['bike', 'biking', 'stationary bike', 'spin']),
  ('Rowing', 'Cardio', 'cardio', 'machine', array['row machine', 'erg', 'concept 2', 'rower']),
  ('Elliptical', 'Cardio', 'cardio', 'machine', array['elliptical machine']),
  ('Stairmaster', 'Cardio', 'cardio', 'machine', array['stair master', 'stair climber', 'stepmill']),
  ('Jump Rope', 'Cardio', 'cardio', 'equipment', array['jump rope', 'skipping', 'skipping rope', 'double unders']),
  ('Swimming', 'Cardio', 'cardio', 'bodyweight', array['swim', 'swimming laps']),
  ('Assault Bike', 'Cardio', 'cardio', 'machine', array['air bike', 'assault air bike', 'echo bike']),
  ('Ski Erg', 'Cardio', 'cardio', 'machine', array['ski machine', 'ski erg machine']),
  ('Incline Walk', 'Cardio', 'cardio', 'machine', array['incline walking', 'treadmill incline walk', 'incline treadmill'])
on conflict (name) do nothing;

