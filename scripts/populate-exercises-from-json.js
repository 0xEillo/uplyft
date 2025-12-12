#!/usr/bin/env node

/**
 * Script to populate exercises table with data from exercises.json
 *
 * This script:
 * 1. Reads exercises.json
 * 2. For each exercise, finds or creates the exercise in the database
 * 3. Updates it with all metadata fields from the JSON
 */

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

// Load environment variables from .env
require('dotenv').config({ path: path.join(__dirname, '../.env') })

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: Missing SUPABASE_SERVICE_ROLE_KEY')
  console.error('')
  console.error('You can provide it in one of these ways:')
  console.error(
    '  1. Create .env.local with: SUPABASE_SERVICE_ROLE_KEY=your-key',
  )
  console.error(
    '  2. Pass as env var: SUPABASE_SERVICE_ROLE_KEY=your-key node scripts/populate-exercises-from-json.js',
  )
  console.error('')
  console.error(`Target DB: ${SUPABASE_URL}`)
  process.exit(1)
}

console.log(`Using Supabase URL: ${SUPABASE_URL}`)

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const DRY_RUN = process.argv.includes('--dry-run')

const exercisesJsonPath = path.join(
  __dirname,
  '../assets/exercises/exercises.json',
)

/**
 * Normalize exercise name to match database format (Title Case)
 */
function normalizeExerciseName(name) {
  return name
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

/**
 * Map JSON exercise data to database format
 */
function mapExerciseData(jsonExercise) {
  return {
    exercise_id: jsonExercise.exerciseId,
    gif_url: jsonExercise.gifUrl,
    target_muscles: jsonExercise.targetMuscles || [],
    body_parts: jsonExercise.bodyParts || [],
    equipments: jsonExercise.equipments || [],
    secondary_muscles: jsonExercise.secondaryMuscles || [],
    instructions: jsonExercise.instructions || [],
  }
}

/**
 * Update or create exercise in database
 */
async function upsertExercise(jsonExercise) {
  const normalizedName = normalizeExerciseName(jsonExercise.name)
  const exerciseData = mapExerciseData(jsonExercise)

  // First, try to find by exercise_id if it exists
  if (jsonExercise.exerciseId) {
    const { data: existingById, error: idError } = await supabase
      .from('exercises')
      .select('id, name')
      .eq('exercise_id', jsonExercise.exerciseId)
      .maybeSingle()

    if (existingById && !idError) {
      console.log(`  Found by exercise_id: ${jsonExercise.exerciseId} → would UPDATE`)
      if (DRY_RUN) return { id: existingById.id, dryRun: true }
      
      const { data, error } = await supabase
        .from('exercises')
        .update(exerciseData)
        .eq('id', existingById.id)
        .select()
        .single()

      if (error) {
        console.error(`  ❌ Error updating exercise: ${error.message}`)
        return null
      }
      return data
    }
  }

  // Try to find by name (case-insensitive)
  const { data: existingByName, error: nameError } = await supabase
    .from('exercises')
    .select('id, name')
    .ilike('name', normalizedName)
    .maybeSingle()

  if (existingByName && !nameError) {
    console.log(`  Found by name: ${existingByName.name} → would UPDATE`)
    if (DRY_RUN) return { id: existingByName.id, dryRun: true }
    
    const { data, error } = await supabase
      .from('exercises')
      .update({
        ...exerciseData,
        // Preserve existing muscle_group, type, equipment if they exist
      })
      .eq('id', existingByName.id)
      .select()
      .single()

    if (error) {
      console.error(`  ❌ Error updating exercise: ${error.message}`)
      return null
    }
    return data
  }

  // Create new exercise
  console.log(`  Would CREATE new exercise: ${normalizedName}`)
  if (DRY_RUN) return { id: 'new', dryRun: true }
  
  const { data, error } = await supabase
    .from('exercises')
    .insert({
      name: normalizedName,
      ...exerciseData,
      // Set primary muscle_group from first targetMuscle if available
      muscle_group: jsonExercise.targetMuscles?.[0] || null,
      created_by: null, // System exercise
    })
    .select()
    .single()

  if (error) {
    console.error(`  ❌ Error creating exercise: ${error.message}`)
    return null
  }

  return data
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  EXERCISE POPULATION SCRIPT')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(`  Mode: ${DRY_RUN ? '🔍 DRY RUN (no changes)' : '⚠️  LIVE RUN (will modify database)'}`)
  console.log(`  Database: ${SUPABASE_URL}`)
  console.log('')
  console.log('Reading exercises.json...\n')

  if (!fs.existsSync(exercisesJsonPath)) {
    console.error(`❌ Error: File not found at ${exercisesJsonPath}`)
    process.exit(1)
  }

  const fileContent = fs.readFileSync(exercisesJsonPath, 'utf8')
  const exercises = JSON.parse(fileContent)

  if (!Array.isArray(exercises)) {
    console.error('❌ Error: exercises.json should contain an array')
    process.exit(1)
  }

  console.log(`Found ${exercises.length} exercises\n`)
  console.log('Populating database...\n')

  // Collect all exercise_ids from JSON
  const jsonExerciseIds = exercises
    .map((ex) => ex.exerciseId)
    .filter((id) => id != null)

  let successCount = 0
  let errorCount = 0

  for (let i = 0; i < exercises.length; i++) {
    const exercise = exercises[i]
    console.log(`[${i + 1}/${exercises.length}] Processing: ${exercise.name}`)

    try {
      const result = await upsertExercise(exercise)
      if (result) {
        successCount++
        console.log(`  ✓ Success (ID: ${result.id})\n`)
      } else {
        errorCount++
        console.log(`  ✗ Failed\n`)
      }
    } catch (error) {
      errorCount++
      console.error(`  ❌ Exception: ${error.message}\n`)
    }

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 50))
  }

  console.log('\n' + '='.repeat(50))
  console.log(`✅ Upserted: ${successCount} successful, ${errorCount} errors`)
  console.log('='.repeat(50))

  // Step 2: Delete exercises with NULL exercise_id (old exercises not from JSON)
  console.log('\nCleaning up old exercises...\n')
  console.log('Looking for exercises with exercise_id = NULL')

  // Find all exercises where exercise_id is NULL
  const { data: exercisesWithNullId, error: fetchError } = await supabase
    .from('exercises')
    .select('id, name, exercise_id')
    .is('exercise_id', null)

  if (fetchError) {
    console.error(`❌ Error fetching exercises: ${fetchError.message}`)
  } else if (exercisesWithNullId && exercisesWithNullId.length > 0) {
    console.log(
      `Found ${exercisesWithNullId.length} exercises with NULL exercise_id`,
    )

    // Check which ones are referenced by workout_exercises OR workout_routine_exercises
    const idsToCheck = exercisesWithNullId.map((ex) => ex.id)
    
    // Check workout_exercises (actual workout logs)
    const { data: referencedInWorkouts } = await supabase
      .from('workout_exercises')
      .select('exercise_id')
      .in('exercise_id', idsToCheck)
    
    // Check workout_routine_exercises (routine templates)
    const { data: referencedInRoutines } = await supabase
      .from('workout_routine_exercises')
      .select('exercise_id')
      .in('exercise_id', idsToCheck)

    const referencedIds = new Set([
      ...(referencedInWorkouts?.map((ref) => ref.exercise_id) || []),
      ...(referencedInRoutines?.map((ref) => ref.exercise_id) || []),
    ])

    // Filter out exercises that are referenced
    const exercisesToDelete = exercisesWithNullId.filter(
      (ex) => !referencedIds.has(ex.id),
    )
    const skippedExercises = exercisesWithNullId.filter((ex) =>
      referencedIds.has(ex.id),
    )

    if (skippedExercises.length > 0) {
      console.log(
        `\n⚠️  Skipping ${skippedExercises.length} exercises that are referenced by workout routines:`,
      )
      skippedExercises.forEach((ex) => {
        console.log(`  - ${ex.name} (ID: ${ex.id})`)
      })
    }

    if (exercisesToDelete.length > 0) {
      console.log(
        `\n${DRY_RUN ? 'Would delete' : 'Deleting'} ${exercisesToDelete.length} exercises with NULL exercise_id:`,
      )
      exercisesToDelete.forEach((ex) => {
        console.log(`  - ${ex.name} (ID: ${ex.id})`)
      })
      console.log('')

      if (!DRY_RUN) {
        const idsToDelete = exercisesToDelete.map((ex) => ex.id)
        const { error: deleteError } = await supabase
          .from('exercises')
          .delete()
          .in('id', idsToDelete)

        if (deleteError) {
          console.error(`❌ Error deleting exercises: ${deleteError.message}`)
        } else {
          console.log(`✅ Deleted ${exercisesToDelete.length} old exercises`)
        }
      }
    } else {
      console.log('\n✅ No deletable exercises found (all are referenced)')
    }
  } else {
    console.log('✅ No exercises with NULL exercise_id found')
  }

  console.log('\n' + '='.repeat(60))
  if (DRY_RUN) {
    console.log(`🔍 DRY RUN COMPLETE: Would process ${successCount} exercises`)
    console.log('')
    console.log('Run without --dry-run to apply changes.')
  } else {
    console.log(`✅ Completed: ${successCount} upserted, ${errorCount} errors`)
  }
  console.log('='.repeat(60))
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
