#!/usr/bin/env node

/**
 * Fetch exercises that have been used by at least one user
 * Run this from the project root: node scripts/fetch-used-exercises.js
 *
 * Required environment variables:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY)
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

// Load environment variables from .env file
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
config({ path: join(__dirname, '../.env') })

async function main() {
  // Check environment variables
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing required environment variables:')
    if (!supabaseUrl)
      console.error('   - SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL')
    if (!supabaseKey)
      console.error('   - SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY')
    process.exit(1)
  }

  // Initialize Supabase client
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  console.log('🔄 Fetching exercises used by at least one user...')
  console.log(`📍 Supabase URL: ${supabaseUrl}`)
  console.log('')

  try {
    // Step 1: Get all exercise_ids from workout_exercises (exercises that have been used)
    console.log('Fetching used exercise IDs...')
    const { data: usedExerciseIds, error: idsError } = await supabase
      .from('workout_exercises')
      .select('exercise_id')
      .limit(100000)

    if (idsError) throw idsError

    if (!usedExerciseIds || usedExerciseIds.length === 0) {
      console.log('✅ No exercises have been used yet')
      process.exit(0)
    }

    // Step 2: Get unique exercise IDs
    const uniqueExerciseIds = [
      ...new Set(usedExerciseIds.map((we) => we.exercise_id)),
    ]
    console.log(
      `Found ${uniqueExerciseIds.length} unique exercises that have been used`,
    )
    console.log('')

    // Step 3: Fetch full exercise details (batch if > 1000 due to Supabase limit)
    console.log('Fetching exercise details...')
    const BATCH_SIZE = 1000
    let allExercises = []

    for (let i = 0; i < uniqueExerciseIds.length; i += BATCH_SIZE) {
      const batch = uniqueExerciseIds.slice(i, i + BATCH_SIZE)
      const {
        data: exercisesBatch,
        error: exercisesError,
      } = await supabase.from('exercises').select('*').in('id', batch)

      if (exercisesError) throw exercisesError
      if (exercisesBatch) {
        allExercises = allExercises.concat(exercisesBatch)
      }
    }

    // Sort by name
    const exercises = allExercises.sort((a, b) => a.name.localeCompare(b.name))

    if (!exercises || exercises.length === 0) {
      console.log('✅ No exercises have been used yet')
      process.exit(0)
    }

    console.log(`✅ Found ${exercises.length} exercises that have been used`)
    console.log('')
    console.log('════════════════════════════════════════')
    console.log('📊 Used Exercises')
    console.log('════════════════════════════════════════')
    console.log('')

    // Display exercises
    exercises.forEach((exercise, index) => {
      console.log(`${index + 1}. ${exercise.name}`)
      if (exercise.muscle_group)
        console.log(`   Muscle Group: ${exercise.muscle_group}`)
      if (exercise.equipment) console.log(`   Equipment: ${exercise.equipment}`)
      if (exercise.type) console.log(`   Type: ${exercise.type}`)
      console.log(`   ID: ${exercise.id}`)
      console.log('')
    })

    console.log('════════════════════════════════════════')
    console.log(`Total: ${exercises.length} exercises`)
    console.log('════════════════════════════════════════')

    // Optionally save to JSON file
    if (process.argv.includes('--json')) {
      const fs = await import('fs/promises')
      await fs.writeFile(
        'used-exercises.json',
        JSON.stringify(exercises, null, 2),
      )
      console.log('')
      console.log('💾 Saved to used-exercises.json')
    }

    process.exit(0)
  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error)
    process.exit(1)
  }
}

main()
