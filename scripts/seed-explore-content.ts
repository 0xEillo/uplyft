/**
 * Seed explore content into the database
 * Uses exercises from data/exercises-export.json
 *
 * Usage: npx ts-node scripts/seed-explore-content.ts
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import fs from 'fs'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: '.env.test' })

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error(
    'Missing env vars: EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
  )
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Load exercises
const exercisesPath = path.join(__dirname, '..', 'data', 'exercises-export.json')
const exercises = JSON.parse(fs.readFileSync(exercisesPath, 'utf8'))

// Helper to find exercise ID by fuzzy name matching
function findExerciseId(name: string): string {
  const normalizedSearch = name.toLowerCase().replace(/[^a-z0-9]/g, '')
  
  // 1. Exact match
  const exact = exercises.find((e: any) => e.name.toLowerCase() === name.toLowerCase())
  if (exact) return exact.id

  // 2. Normalized match including equipment
  const normalized = exercises.find((e: any) => 
    e.name.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedSearch
  )
  if (normalized) return normalized.id

  // 3. Try finding without equipment if specified
  const baseName = name.split('(')[0].trim()
  const baseMatch = exercises.find((e: any) => 
    e.name.toLowerCase().includes(baseName.toLowerCase())
  )
  
  if (baseMatch) return baseMatch.id
  
  // 4. Try checking for specific keywords map
  const KEYWORDS: Record<string, string> = {
    'skullcrusher': 'triceps extension',
    'overhead press': 'military press',
    'bicep curl': 'curl',
    'romanian': 'deadlift'
  }
  
  for (const [key, val] of Object.entries(KEYWORDS)) {
      if (name.toLowerCase().includes(key)) {
           const match = exercises.find((e: any) => e.name.toLowerCase().includes(val))
           if (match) return match.id
      }
  }

  console.warn(`⚠️ Could not find exercise: "${name}". Skipping.`)
  return ''
}

// --- DATA DEFINITIONS ---

// 1. PPL Program
const PPL_PROGRAM = {
  name: 'Push Pull Legs',
  description: 'A 3-day split (Push, Pull, Legs) focused on high intensity. Volume is lower to allow for maximum effort; each set should be performed near failure (0-2 reps in reserve).',
  level: 'beginner',
  goal: 'build_muscle',
  is_published: true,
  display_order: 1,
}

const PPL_ROUTINES = [
  {
    name: 'Push',
    description: 'Upper body pushing muscles. Maintain high intensity and push each set near failure.',
    level: 'beginner',
    duration_minutes: 45,
    equipment: ['Barbell', 'Dumbbell', 'Machine', 'Cable'],
    is_published: true,
    display_order: 1,
    image_url: 'Push.png', 
    exercises: [
      { name: 'Bench Press (Barbell)', sets: 3, reps_min: 6, reps_max: 8 },
      { name: 'Incline Bench Press (Dumbbell)', sets: 2, reps_min: 8, reps_max: 12 },
      { name: 'Shoulder Press (Dumbbell)', sets: 2, reps_min: 6, reps_max: 8 },
      { name: 'Lateral Raise (Dumbbell)', sets: 2, reps_min: 8, reps_max: 12 },
      { name: 'Cable Triceps Pushdown (v-Bar)', sets: 2, reps_min: 8, reps_max: 12 },
      { name: 'Skullcrusher (Barbell)', sets: 2, reps_min: 8, reps_max: 12 },
    ]
  },
  {
    name: 'Pull',
    description: 'Upper body pulling muscles. Low volume, high intensity is key—take every set to near failure.',
    level: 'beginner',
    duration_minutes: 45,
    equipment: ['Cable', 'Dumbbell'],
    is_published: true,
    display_order: 2,
    image_url: 'Pull.png',
    exercises: [
      { name: 'Lat Pulldown (Cable)', sets: 3, reps_min: 6, reps_max: 8 },
      { name: 'Bent Over Row (Barbell)', sets: 2, reps_min: 6, reps_max: 8 },
      { name: 'Low Seated Row (Cable)', sets: 2, reps_min: 8, reps_max: 12 },
      { name: 'Face Pull', sets: 2, reps_min: 10, reps_max: 15 },
      { name: 'Bicep Curl (Barbell)', sets: 2, reps_min: 8, reps_max: 12 },
      { name: 'Hammer Curl (Dumbbell)', sets: 2, reps_min: 8, reps_max: 12 },
    ]
  },
  {
    name: 'Legs',
    description: 'Lower body session. Focus on heavy compound movements and high intensity sets near failure.',
    level: 'beginner',
    duration_minutes: 45,
    equipment: ['Machine'],
    is_published: true,
    display_order: 3,
    image_url: 'Legs.png', 
    exercises: [
      { name: 'Squat (Barbell)', sets: 3, reps_min: 6, reps_max: 8 },
      { name: 'Leg Press (Machine)', sets: 2, reps_min: 8, reps_max: 12 },
      { name: 'Romanian Deadlift (Barbell)', sets: 3, reps_min: 6, reps_max: 8 },
      { name: 'Lying Leg Curl (Machine)', sets: 2, reps_min: 8, reps_max: 12 },
      { name: 'Standing Calf Raise (Machine)', sets: 2, reps_min: 8, reps_max: 12 },
    ]
  }
]

// 2. Upper/Lower Program
const UL_PROGRAM = {
  name: 'Upper / Lower Split',
  description: 'A 4-day split alternating between upper and lower body. Optimized for high intensity and lower volume; ensure every set is performed near failure for maximum growth.',
  level: 'intermediate',
  goal: 'build_muscle',
  is_published: true,
  display_order: 2,
}

const UL_ROUTINES = [
  {
    name: 'Upper Body',
    description: 'Focuses on compound upper body pushing and pulling movements.',
    level: 'intermediate',
    duration_minutes: 60,
    equipment: ['Barbell', 'Dumbbell'],
    is_published: true,
    display_order: 1,
    image_url: 'Upper Body A.png',
    exercises: [
        { name: 'Bench Press (Barbell)', sets: 3, reps_min: 6, reps_max: 8 },
        { name: 'Bent Over Row (Barbell)', sets: 3, reps_min: 6, reps_max: 8 },
        { name: 'Overhead Press (Barbell)', sets: 2, reps_min: 6, reps_max: 8 },
        { name: 'Lat Pulldown (Cable)', sets: 2, reps_min: 8, reps_max: 12 },
        { name: 'Skullcrusher (Barbell)', sets: 2, reps_min: 8, reps_max: 12 },
        { name: 'Bicep Curl (Barbell)', sets: 2, reps_min: 8, reps_max: 12 },
    ]
  },
  {
    name: 'Lower Body',
    description: 'Heavy lower body compound movements for leg development.',
    level: 'intermediate',
    duration_minutes: 60,
    equipment: ['Barbell', 'Machine'],
    is_published: true,
    display_order: 2,
    image_url: 'Lower Body A.png',
    exercises: [
        { name: 'Squat (Barbell)', sets: 3, reps_min: 6, reps_max: 8 },
        { name: 'Romanian Deadlift (Barbell)', sets: 3, reps_min: 6, reps_max: 8 },
        { name: 'Leg Press (Machine)', sets: 2, reps_min: 8, reps_max: 12 },
        { name: 'Lying Leg Curl (Machine)', sets: 2, reps_min: 8, reps_max: 12 },
        { name: 'Standing Calf Raise (Machine)', sets: 2, reps_min: 8, reps_max: 12 },
    ]
  }
]

// 3. Full Body Program
const FB_PROGRAM = {
  name: 'Full Body Foundation',
  description: 'A classic 3-day full body routine. Hits every major muscle group using high-intensity, low-volume sets. Aim for 0-2 reps in reserve on every exercise.',
  level: 'beginner',
  goal: 'build_muscle',
  is_published: true,
  display_order: 3,
}

const FB_ROUTINES = [
  {
    name: 'Full Body A',
    description: 'First full body session focusing on the "Big 3" compounds.',
    level: 'beginner',
    duration_minutes: 60,
    equipment: ['Barbell', 'Dumbbell', 'Cable'],
    is_published: true,
    display_order: 1,
    image_url: 'Full Body A.png',
    exercises: [
      { name: 'Squat (Barbell)', sets: 3, reps_min: 6, reps_max: 8 },
      { name: 'Bench Press (Barbell)', sets: 3, reps_min: 6, reps_max: 8 },
      { name: 'Bent Over Row (Barbell)', sets: 2, reps_min: 6, reps_max: 8 },
      { name: 'Overhead Press (Barbell)', sets: 2, reps_min: 6, reps_max: 8 },
      { name: 'Cable Triceps Pushdown (v-Bar)', sets: 2, reps_min: 8, reps_max: 12 },
      { name: 'Bicep Curl (Barbell)', sets: 2, reps_min: 8, reps_max: 12 },
    ]
  },
  {
    name: 'Full Body B',
    description: 'Second session introducing hinge movements and variety.',
    level: 'beginner',
    duration_minutes: 60,
    equipment: ['Barbell', 'Dumbbell', 'Machine'],
    is_published: true,
    display_order: 2,
    image_url: 'Full Body B.png',
    exercises: [
      { name: 'Deadlift (Barbell)', sets: 2, reps_min: 5, reps_max: 5 },
      { name: 'Leg Press (Machine)', sets: 2, reps_min: 8, reps_max: 12 },
      { name: 'Incline Bench Press (Dumbbell)', sets: 2, reps_min: 6, reps_max: 8 },
      { name: 'Lat Pulldown (Cable)', sets: 2, reps_min: 8, reps_max: 12 },
      { name: 'Lateral Raise (Dumbbell)', sets: 2, reps_min: 8, reps_max: 12 },
      { name: 'Face Pull', sets: 2, reps_min: 8, reps_max: 12 },
    ]
  },
  {
    name: 'Full Body C',
    description: 'Final session with unilateral work and endurance.',
    level: 'beginner',
    duration_minutes: 60,
    equipment: ['Barbell', 'Dumbbell', 'Machine'],
    is_published: true,
    display_order: 3,
    image_url: 'Full Body C.png',
    exercises: [
      { name: 'Lunge (Dumbbell)', sets: 2, reps_min: 8, reps_max: 10 },
      { name: 'Romanian Deadlift (Barbell)', sets: 2, reps_min: 6, reps_max: 8 },
      { name: 'Shoulder Press (Dumbbell)', sets: 2, reps_min: 6, reps_max: 8 },
      { name: 'Low Seated Row (Cable)', sets: 2, reps_min: 8, reps_max: 12 },
      { name: 'Leg Curl (Machine)', sets: 2, reps_min: 8, reps_max: 12 },
      { name: 'Standing Calf Raise (Machine)', sets: 2, reps_min: 8, reps_max: 12 },
    ]
  }
]

// 4. 5x5 Strength - Classic Strength Program
const STRENGTH_5X5_PROGRAM = {
  name: '5x5 Strength',
  description: 'The classic beginner strength program. Simple, effective, and time-tested. Alternating A/B workouts 3x per week with linear progression.',
  level: 'beginner',
  goal: 'get_stronger',
  is_published: true,
  display_order: 4,
}

const STRENGTH_5X5_ROUTINES = [
  {
    name: 'Bench & Row',
    description: 'Squat, Bench Press, Barbell Row. The foundation of building strength.',
    level: 'beginner',
    duration_minutes: 45,
    equipment: ['Barbell'],
    is_published: true,
    display_order: 1,
    image_url: 'Bench & Row.png',
    exercises: [
      { name: 'Squat (Barbell)', sets: 5, reps_min: 5, reps_max: 5 },
      { name: 'Bench Press (Barbell)', sets: 5, reps_min: 5, reps_max: 5 },
      { name: 'Bent Over Row (Barbell)', sets: 5, reps_min: 5, reps_max: 5 },
    ]
  },
  {
    name: 'Press & Deadlift',
    description: 'Squat, Overhead Press, Deadlift. Building raw power.',
    level: 'beginner',
    duration_minutes: 45,
    equipment: ['Barbell'],
    is_published: true,
    display_order: 2,
    image_url: 'Press & Deadlift.png',
    exercises: [
      { name: 'Squat (Barbell)', sets: 5, reps_min: 5, reps_max: 5 },
      { name: 'Overhead Press (Barbell)', sets: 5, reps_min: 5, reps_max: 5 },
      { name: 'Deadlift (Barbell)', sets: 1, reps_min: 5, reps_max: 5 },
    ]
  }
]

// 5. Arnold Split - Classic 6-Day Bodybuilding
const ARNOLD_PROGRAM = {
  name: 'Arnold Split',
  description: 'The legendary 6-day split used by Arnold Schwarzenegger. High volume training for serious muscle growth. Chest/Back, Shoulders/Arms, Legs repeated twice per week.',
  level: 'advanced',
  goal: 'build_muscle',
  is_published: true,
  display_order: 5,
}

const ARNOLD_ROUTINES = [
  {
    name: 'Chest & Back',
    description: 'High volume chest and back supersets for maximum pump.',
    level: 'advanced',
    duration_minutes: 75,
    equipment: ['Barbell', 'Dumbbell', 'Cable'],
    is_published: true,
    display_order: 1,
    image_url: 'Chest & Back.png',
    exercises: [
      { name: 'Bench Press (Barbell)', sets: 4, reps_min: 8, reps_max: 12 },
      { name: 'Incline Bench Press (Dumbbell)', sets: 4, reps_min: 8, reps_max: 12 },
      { name: 'Fly (Dumbbell)', sets: 3, reps_min: 10, reps_max: 15 },
      { name: 'Chin Up', sets: 4, reps_min: 8, reps_max: 12 },
      { name: 'Bent Over Row (Barbell)', sets: 4, reps_min: 8, reps_max: 12 },
      { name: 'Low Seated Row (Cable)', sets: 3, reps_min: 10, reps_max: 12 },
    ]
  },
  {
    name: 'Shoulders & Arms',
    description: 'Shoulder development and arm training for complete upper body aesthetics.',
    level: 'advanced',
    duration_minutes: 60,
    equipment: ['Barbell', 'Dumbbell', 'Cable'],
    is_published: true,
    display_order: 2,
    image_url: 'Shoulders & Arms.png',
    exercises: [
      { name: 'Overhead Press (Barbell)', sets: 4, reps_min: 8, reps_max: 10 },
      { name: 'Lateral Raise (Dumbbell)', sets: 4, reps_min: 10, reps_max: 15 },
      { name: 'Rear Delt Fly (Dumbbell)', sets: 3, reps_min: 12, reps_max: 15 },
      { name: 'Bicep Curl (Barbell)', sets: 4, reps_min: 8, reps_max: 12 },
      { name: 'Hammer Curl (Dumbbell)', sets: 3, reps_min: 10, reps_max: 12 },
      { name: 'Cable Triceps Pushdown (v-Bar)', sets: 4, reps_min: 10, reps_max: 12 },
      { name: 'Skullcrusher (Barbell)', sets: 3, reps_min: 8, reps_max: 12 },
    ]
  },
  {
    name: 'Arnold Legs',
    description: 'Complete leg development with heavy compounds and isolation work.',
    level: 'advanced',
    duration_minutes: 75,
    equipment: ['Barbell', 'Machine'],
    is_published: true,
    display_order: 3,
    image_url: 'Arnold Legs.png',
    exercises: [
      { name: 'Squat (Barbell)', sets: 5, reps_min: 6, reps_max: 10 },
      { name: 'Leg Press (Machine)', sets: 4, reps_min: 10, reps_max: 12 },
      { name: 'Leg Extension (Machine)', sets: 3, reps_min: 12, reps_max: 15 },
      { name: 'Romanian Deadlift (Barbell)', sets: 4, reps_min: 8, reps_max: 10 },
      { name: 'Lying Leg Curl (Machine)', sets: 4, reps_min: 10, reps_max: 12 },
      { name: 'Standing Calf Raise (Machine)', sets: 4, reps_min: 12, reps_max: 15 },
    ]
  }
]

// 6. Bodyweight Basics - Home/No Equipment
const BW_PROGRAM = {
  name: 'Bodyweight Basics',
  description: 'Build muscle and strength at home with zero equipment. A proven 3-day routine focusing on progressive bodyweight movements.',
  level: 'beginner',
  goal: 'build_muscle',
  is_published: true,
  display_order: 6,
}

const BW_ROUTINES = [
  {
    name: 'Push Day',
    description: 'Chest, shoulders, and triceps using only your bodyweight.',
    level: 'beginner',
    duration_minutes: 30,
    equipment: ['Bodyweight'],
    is_published: true,
    display_order: 1,
    image_url: 'Push Day.png',
    exercises: [
      { name: 'Push Up', sets: 4, reps_min: 8, reps_max: 15 },
      { name: 'Diamond Push Up', sets: 3, reps_min: 6, reps_max: 12 },
      { name: 'Decline Push Up', sets: 3, reps_min: 8, reps_max: 12 },
      { name: 'Triceps Dip', sets: 3, reps_min: 8, reps_max: 15 },
      { name: 'Handstand Push Up', sets: 3, reps_min: 3, reps_max: 8 },
    ]
  },
  {
    name: 'Pull Day',
    description: 'Back and biceps with bodyweight pulling movements.',
    level: 'beginner',
    duration_minutes: 30,
    equipment: ['Bodyweight'],
    is_published: true,
    display_order: 2,
    image_url: 'Pull Day.png',
    exercises: [
      { name: 'Chin Up', sets: 4, reps_min: 5, reps_max: 10 },
      { name: 'Wide Grip Pull Up', sets: 3, reps_min: 5, reps_max: 10 },
      { name: 'Inverted Row', sets: 3, reps_min: 8, reps_max: 12 },
      { name: 'Lumbar Superman', sets: 3, reps_min: 10, reps_max: 15 },
      { name: 'Hanging Leg Raise', sets: 3, reps_min: 8, reps_max: 12 },
    ]
  },
  {
    name: 'Legs (Bodyweight)',
    description: 'Legs and glutes using bodyweight movements at home.',
    level: 'beginner',
    duration_minutes: 30,
    equipment: ['Bodyweight'],
    is_published: true,
    display_order: 3,
    image_url: 'Lower Body.png',
    exercises: [
      { name: 'Bodyweight Squats', sets: 4, reps_min: 15, reps_max: 20 },
      { name: 'Walking Lunge', sets: 3, reps_min: 10, reps_max: 12 },
      { name: 'Glute Bridge March', sets: 3, reps_min: 12, reps_max: 15 },
      { name: 'Lunge With Jump', sets: 3, reps_min: 8, reps_max: 12 },
      { name: 'Mountain Climber', sets: 3, reps_min: 20, reps_max: 30 },
      { name: 'Crunches', sets: 3, reps_min: 15, reps_max: 20 },
    ]
  }
]

const ALL_PROGRAMS = [
  { meta: PPL_PROGRAM, routines: PPL_ROUTINES },
  { meta: UL_PROGRAM, routines: UL_ROUTINES },
  { meta: FB_PROGRAM, routines: FB_ROUTINES },
  { meta: STRENGTH_5X5_PROGRAM, routines: STRENGTH_5X5_ROUTINES },
  { meta: ARNOLD_PROGRAM, routines: ARNOLD_ROUTINES },
  { meta: BW_PROGRAM, routines: BW_ROUTINES }
]

async function seed() {
  console.log('🌱 Seeding Explore Content...')

  // 0. Cleanup existing data (to avoid duplicates)
  console.log('🧹 Cleaning up old data...')
  
  // Note: We delete in reverse dependency order just to be safe, 
  // though cascades might handle it.
  const { error: err1 } = await supabase.from('explore_routine_exercises').delete().neq('id', '00000000-0000-0000-0000-000000000000') // delete all
  const { error: err2 } = await supabase.from('explore_program_routines').delete().neq('program_id', '00000000-0000-0000-0000-000000000000') 
  const { error: err3 } = await supabase.from('explore_routines').delete().neq('id', '00000000-0000-0000-0000-000000000000') 
  const { error: err4 } = await supabase.from('explore_programs').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  if (err1 || err2 || err3 || err4) {
      console.warn('Warning during cleanup:', err1, err2, err3, err4)
  }

  for (const programData of ALL_PROGRAMS) {
    const { meta: programMeta, routines } = programData
    
    // 1. Create Program
    const { data: program, error: progError } = await supabase
      .from('explore_programs')
      .insert(programMeta) 
      .select()
      .single()

    if (progError) {
      console.error('Error creating program:', progError)
      continue
    }
    console.log(`✅ Created Program: ${program.name} (${program.id})`)

    // 2. Create Routines & Link to Program
    for (const [index, routineData] of routines.entries()) {
      const { exercises: routineExercises, ...routineMeta } = routineData

      // Insert Routine
      const { data: routine, error: routError } = await supabase
        .from('explore_routines')
        .insert(routineMeta)
        .select()
        .single()

      if (routError) {
        console.error(`Error creating routine ${routineMeta.name}:`, routError)
        continue
      }
      console.log(`  ✅ Created Routine: ${routine.name} (${routine.id})`)

      // Link Routine to Program
      const { error: linkError } = await supabase
        .from('explore_program_routines')
        .insert({
          program_id: program.id,
          routine_id: routine.id,
          display_order: index + 1,
          day_number: index + 1 // Simply day 1, 2, 3
        })

      if (linkError) {
        console.error(`Error linking routine to program:`, linkError)
      }

      // 3. Add Exercises to Routine
      for (const [exIndex, ex] of routineExercises.entries()) {
        const exerciseId = findExerciseId(ex.name)
        if (!exerciseId) {
             console.log(`    ⚠️ Skipping ${ex.name} (not found)`)
             continue
        }

        const { error: exError } = await supabase
          .from('explore_routine_exercises')
          .insert({
            routine_id: routine.id,
            exercise_id: exerciseId,
            order_index: exIndex,
            sets: ex.sets,
            reps_min: ex.reps_min,
            reps_max: ex.reps_max,
          })
        
        if (exError) {
          console.error(`    ❌ Failed to add ${ex.name}:`, exError.message)
        } else {
          console.log(`    Added exercise: ${ex.name}`)
        }
      }
    }
  }

  console.log('\n✨ Seeding Complete!')
}

seed().catch(console.error)
