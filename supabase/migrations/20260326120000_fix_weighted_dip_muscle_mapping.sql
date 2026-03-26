-- Correct Weighted Dip to be chest-primary and align metadata/instructions with a chest dip pattern.

update public.exercises
set
  muscle_group = 'Chest',
  aliases = array[
    'Weighted Dips',
    'Weighted Dip',
    'Weighted Dip (Bodyweight)',
    'Weighted Chest Dip',
    'Chest Dip (Weighted)'
  ],
  target_muscles = array['Chest'],
  body_parts = array['Chest'],
  secondary_muscles = array['shoulders', 'triceps'],
  instructions = array[
    'Step:1 Secure the weight with a dip belt or hold it safely, then support yourself on parallel bars with arms locked out.',
    'Step:2 Lean your torso slightly forward and keep your chest up to bias the pecs.',
    'Step:3 Lower under control by bending your elbows until your shoulders dip just below elbow height.',
    'Step:4 Drive back up by pressing through the bars until your elbows are extended.',
    'Step:5 Repeat for the desired number of repetitions while maintaining a forward torso angle.'
  ]
where id = 'f18faaa7-0cb5-4d5f-9474-a1f822c4ed84'
   or name = 'Weighted Dip';
