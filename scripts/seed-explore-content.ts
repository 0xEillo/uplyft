/**
 * Seed explore content into the database
 * Uses exercises from data/exercises-export.json
 *
 * Usage: npx ts-node scripts/seed-explore-content.ts
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

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
  description: 'This beginner program has three weekly workouts: push (chest, shoulders, and triceps), pull (back and biceps), and legs (quads, hamstrings, glutes, and calves).',
  level: 'beginner',
  goal: 'build_muscle',
  is_published: true,
  display_order: 1,
}

const PPL_ROUTINES = [
  {
    name: 'Push',
    description: 'The first workout of the week focuses on the push muscles of the upper body: the chest, shoulders, and triceps.',
    level: 'beginner',
    duration_minutes: 45,
    equipment: ['Barbell', 'Dumbbell', 'Machine', 'Cable'],
    is_published: true,
    display_order: 1,
    image_url: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&q=80&w=3540', 
    exercises: [
      { name: 'Bench Press (Barbell)', sets: 5, reps_min: 4, reps_max: 15 },
      { name: 'Shoulder Press (Dumbbell)', sets: 3, reps_min: 12, reps_max: 15 },
      { name: 'Butterfly (Pec Deck)', sets: 3, reps_min: 15, reps_max: 20 },
      { name: 'Lateral Raise (Dumbbell)', sets: 3, reps_min: 15, reps_max: 20 },
      { name: 'Cable Triceps Pushdown (v-Bar)', sets: 3, reps_min: 15, reps_max: 20 },
    ]
  },
  {
    name: 'Pull',
    description: 'This workout focuses on the upper body muscles involved in pulling motions—the entire back and biceps.',
    level: 'beginner',
    duration_minutes: 45,
    equipment: ['Cable', 'Dumbbell'],
    is_published: true,
    display_order: 2,
    image_url: 'https://images.unsplash.com/photo-1521804906057-1df8fdb718b7?auto=format&fit=crop&q=80&w=3540',
    exercises: [
      { name: 'Lat Pulldown (Cable)', sets: 3, reps_min: 10, reps_max: 12 },
      { name: 'Low Seated Row (Cable)', sets: 3, reps_min: 12, reps_max: 15 },
      { name: 'Shrug (Dumbbell)', sets: 3, reps_min: 12, reps_max: 15 },
      { name: 'Hammer Curl (Dumbbell)', sets: 3, reps_min: 12, reps_max: 15 },
      { name: 'Face Pull', sets: 3, reps_min: 15, reps_max: 20 },
    ]
  },
  {
    name: 'Legs',
    description: 'The final workout of the week focuses exclusively on the lower body muscles.',
    level: 'beginner',
    duration_minutes: 45,
    equipment: ['Machine'],
    is_published: true,
    display_order: 3,
    image_url: 'https://images.unsplash.com/photo-1574680396902-84912ca9b032?auto=format&fit=crop&q=80&w=3540', 
    exercises: [
      { name: 'Leg Press (Machine)', sets: 5, reps_min: 5, reps_max: 12 },
      { name: 'Lying Leg Curl (Machine)', sets: 3, reps_min: 12, reps_max: 15 },
      { name: 'Leg Extension (Machine)', sets: 3, reps_min: 12, reps_max: 15 },
      { name: 'Standing Calf Raise (Machine)', sets: 3, reps_min: 15, reps_max: 20 },
    ]
  }
]

// 2. Upper/Lower Program
const UL_PROGRAM = {
  name: 'Upper / Lower Split',
  description: 'A 4-day split program focusing on compound movements to build strength and muscle. Alternates between upper body and lower body workouts.',
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
    image_url: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?q=80&w=2940&auto=format&fit=crop', // Gym upper body
    exercises: [
        { name: 'Bench Press (Barbell)', sets: 3, reps_min: 8, reps_max: 10 },
        { name: 'Bent Over Row (Barbell)', sets: 3, reps_min: 8, reps_max: 10 },
        { name: 'Overhead Press (Barbell)', sets: 3, reps_min: 8, reps_max: 10 },
        { name: 'Lat Pulldown (Cable)', sets: 3, reps_min: 8, reps_max: 10 },
        { name: 'Skullcrusher (Barbell)', sets: 3, reps_min: 8, reps_max: 10 },
        { name: 'Bicep Curl (Barbell)', sets: 3, reps_min: 8, reps_max: 10 },
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
    image_url: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?q=80&w=2938&auto=format&fit=crop', // Squat/Legs
    exercises: [
        { name: 'Squat (Barbell)', sets: 3, reps_min: 8, reps_max: 10 },
        { name: 'Romanian Deadlift (Barbell)', sets: 3, reps_min: 8, reps_max: 10 },
        { name: 'Leg Press (Machine)', sets: 3, reps_min: 8, reps_max: 10 },
        { name: 'Lying Leg Curl (Machine)', sets: 3, reps_min: 8, reps_max: 10 },
        { name: 'Standing Calf Raise (Machine)', sets: 3, reps_min: 8, reps_max: 10 },
    ]
  }
]

// 3. Full Body Program
const FB_PROGRAM = {
  name: 'Full Body Foundation',
  description: 'A classic 3-day full body routine. Hits every major muscle group 3 times a week using compound movements. Ideal for building a solid strength foundation.',
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
    image_url: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=2940&auto=format&fit=crop',
    exercises: [
      { name: 'Squat (Barbell)', sets: 3, reps_min: 8, reps_max: 10 },
      { name: 'Bench Press (Barbell)', sets: 3, reps_min: 8, reps_max: 10 },
      { name: 'Bent Over Row (Barbell)', sets: 3, reps_min: 8, reps_max: 10 },
      { name: 'Overhead Press (Barbell)', sets: 3, reps_min: 8, reps_max: 10 },
      { name: 'Cable Triceps Pushdown (v-Bar)', sets: 3, reps_min: 10, reps_max: 12 },
      { name: 'Bicep Curl (Barbell)', sets: 3, reps_min: 10, reps_max: 12 },
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
    image_url: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?q=80&w=2940&auto=format&fit=crop',
    exercises: [
      { name: 'Deadlift (Barbell)', sets: 3, reps_min: 5, reps_max: 5 }, // Deadlift usually lower reps intensity
      { name: 'Leg Press (Machine)', sets: 3, reps_min: 10, reps_max: 12 },
      { name: 'Incline Bench Press (Dumbbell)', sets: 3, reps_min: 8, reps_max: 10 },
      { name: 'Lat Pulldown (Cable)', sets: 3, reps_min: 10, reps_max: 12 },
      { name: 'Lateral Raise (Dumbbell)', sets: 3, reps_min: 12, reps_max: 15 },
      { name: 'Face Pull', sets: 3, reps_min: 12, reps_max: 15 },
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
    image_url: 'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?q=80&w=2938&auto=format&fit=crop',
    exercises: [
      { name: 'Lunge (Dumbbell)', sets: 3, reps_min: 10, reps_max: 12 },
      { name: 'Romanian Deadlift (Barbell)', sets: 3, reps_min: 8, reps_max: 10 },
      { name: 'Shoulder Press (Dumbbell)', sets: 3, reps_min: 10, reps_max: 12 },
      { name: 'Low Seated Row (Cable)', sets: 3, reps_min: 10, reps_max: 12 },
      { name: 'Leg Curl (Machine)', sets: 3, reps_min: 12, reps_max: 15 }, // Generic Leg Curl
      { name: 'Standing Calf Raise (Machine)', sets: 3, reps_min: 15, reps_max: 20 },
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
