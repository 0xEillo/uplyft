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
    name: 'Upper Body A',
    description: 'Focuses on compound upper body pushing and pulling movements.',
    level: 'intermediate',
    duration_minutes: 60,
    equipment: ['Barbell', 'Dumbbell'],
    is_published: true,
    display_order: 1,
    image_url: 'Upper Body A.png', // Gym upper body
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
    name: 'Lower Body A',
    description: 'Heavy lower body compound movements for leg development.',
    level: 'intermediate',
    duration_minutes: 60,
    equipment: ['Barbell', 'Machine'],
    is_published: true,
    display_order: 2,
    image_url: 'Lower Body A.png', // Squat/Legs
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

const ALL_PROGRAMS = [
  { meta: PPL_PROGRAM, routines: PPL_ROUTINES },
  { meta: UL_PROGRAM, routines: UL_ROUTINES },
  { meta: FB_PROGRAM, routines: FB_ROUTINES }
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
