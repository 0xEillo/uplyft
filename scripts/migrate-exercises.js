#!/usr/bin/env node
/**
 * Exercise Migration Script
 *
 * This script migrates exercises from the old database to the new exercises.json.
 * It:
 * 1. Uploads all new exercises from exercises.json to Supabase
 * 2. Maps used exercises to their new equivalents (preserving user workout data)
 * 3. Deletes unused exercises from the database
 *
 * IMPORTANT: Run with --dry-run first to see what will happen without making changes.
 *
 * Usage:
 *   node scripts/migrate-exercises.js --dry-run   # Preview changes
 *   node scripts/migrate-exercises.js             # Execute migration
 */

import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// =============================================================================
// EXERCISE MAPPING: Old UUID → New exerciseId from exercises.json
// This mapping was manually created by analyzing exercise names and matching
// semantically equivalent exercises between the old and new lists.
// =============================================================================
const EXERCISE_MAPPING = {
  // Barbell Hack Squat → Barbell Hack Squat
  '6ec4bbb9-f81b-42e5-9d1a-eb6b0a3f7885': '5VCj6iH',
  // Barbell Row → Barbell Bent Over Row
  'c01f7bc1-7afe-4fa3-85b6-73587f5df0f7': 'eZyBC3j',
  // Bench Press → Barbell Bench Press
  '9eba2e0a-0061-4ecc-9e48-26121ba395a6': 'EIeI8Vf',
  // Chin-Up → Chin-Up
  'fea6c98e-37e1-42dc-9189-ce4b3e38caeb': 'T2mxWqc',
  // Crunch → Crunch Floor
  '6d948336-3f48-4b0f-96fc-6aa47954b049': 'TFqbd8t',
  // Deadlift → Barbell Deadlift
  'ab541c30-b598-48bb-8f85-c851b05d92f1': 'ila4NZS',
  // Decline Push-Up → Decline Push-Up
  '2a407388-2053-4ee3-a5ca-a2e3ddf3d1e4': 'i5cEhka',
  // Dips → Chest Dip
  '837f8f13-d3f6-47bf-871d-c6861b9b0f59': '9WTm7dq',
  // Dumbbell Alternate Bicep Curl → Dumbbell Alternate Biceps Curl
  '1bd9353e-cbf8-4ebb-a27a-29d1180f104e': 'BU15nH4',
  // Dumbbell Bench Press → Dumbbell Bench Press
  '7927cf04-6d4b-4f01-9cd2-441ad398f214': 'SpYC0Kp',
  // Dumbbell Fly → Dumbbell Fly
  '80a44d4f-fe01-477a-837d-de22d82e4d4a': 'yz9nUhF',
  // Dumbbell Row → Dumbbell One Arm Bent-Over Row
  '4eee8aab-1e3d-4d1f-9222-0f43424824e7': 'C0MA9bC',
  // Dumbbell Shoulder Press → Dumbbell Seated Shoulder Press
  '74c54074-ee4f-471c-a515-b9389125931b': 'znQUdHY',
  // Hammer Curl → Dumbbell Hammer Curl
  '95e9ff59-9c9f-4120-8f52-412e5e7f4e7e': 'slDvUAU',
  // Handstand Push-Up → Handstand Push-Up
  'ee34660b-9e58-4038-9bc9-bc38339ede77': 'rQxwMxO',
  // Hanging Leg Raise → Hanging Leg Raise
  '00fbaaa6-b29b-4e7c-982e-78978d2f1d3d': 'I3tsCnC',
  // Incline Bench Press → Barbell Incline Bench Press
  'dc3991dc-8c71-4300-a14e-ed1cf2d52554': '3TZduzM',
  // Incline Dumbbell Press → Dumbbell Incline Bench Press
  '3317751b-e46e-474b-8c9c-179e62b54548': 'ns0SIbU',
  // Kettlebell Swings → Kettlebell Swing
  '3d05e8a8-0eb7-4e52-807c-901f47adfabc': 'UHJlbu3',
  // Lat Pulldown → Cable Pulldown
  '0ea0eae2-ba03-4fb4-8428-187068160e29': 'RVwzP10',
  // Lateral Raise → Dumbbell Lateral Raise
  'f5dc623f-60f1-4d68-9a0f-c6c2046c9d3e': 'DsgkuIt',
  // Leg Curl → Lever Lying Leg Curl
  '8ee7237a-18d4-4505-8761-0efa3546087a': '17lJ1kr',
  // Leg Extension → Lever Leg Extension
  '1999e854-6a1b-48d1-be3f-31a3f45a1730': 'my33uHU',
  // Leg Press → Sled 45° Leg Press
  'eec00b49-9a27-49b8-b009-e2cf9ff46c96': '10Z2DXU',
  // One-Arm Dumbbell Row → Dumbbell One Arm Bent-Over Row
  '4390deab-d9b8-4454-80da-8cddc9b10053': 'C0MA9bC',
  // Overhead Press → Barbell Seated Overhead Press
  'b735c556-ef67-472a-ad15-8e63bad4ef32': 'kTbSH9h',
  // Power Clean → Power Clean
  '91e09691-aa8a-4fc3-b052-a90cd3e9c7fd': 'SiWCcTN',
  // Pull-Up → Pull-Up
  'd0d0adf0-19f0-4fc1-83cf-2fe7819d1803': 'lBDjFxJ',
  // Push-Up → Push-Up
  '8db85092-d4b8-49f6-8258-4e6b75abcd34': 'I4hDWkc',
  // Rear Delt Fly → Dumbbell Rear Lateral Raise
  '04fc241a-f92b-4817-88de-f157bf0b8c55': 'v1qBec9',
  // Romanian Deadlift → Dumbbell Romanian Deadlift
  '44ba2a50-a1c9-4cbe-a935-6d837d809188': 'rR0LJzx',
  // Run (Cardio) → Run
  'b78ec052-abfc-4f76-b521-61ea27c8fc5f': 'oLrKqDH',
  // Run (Quads) → Run
  'a3637e6a-d735-4381-8bc0-b9e18e4d3d36': 'oLrKqDH',
  // Russian Twist → Russian Twist
  '445cbebe-faa7-46cb-8fe9-a3c7d937c1c3': 'XVDdcoj',
  // Squat → Barbell Full Squat
  '18d2ea04-fa91-47bd-a511-9ac95807883c': 'qXTaZnJ',
  // Split Squats → Split Squats
  'ae689663-9023-4e0d-a29b-1aad3173bba6': '9E25EOx',
  // Standing Dumbbell Upright Row → Dumbbell Upright Row
  '33eb8afd-2749-4ef8-9eb8-fd0fe1b380b0': 'ainizkb',
  // Tricep Dips → Triceps Dip
  '31e641c8-a061-4b07-8d31-bfbd0c2992ee': 'X6C6i5Y',
  // Tricep Pushdown → Cable Pushdown
  '30993054-3375-41b4-aafa-a0e741ea8703': '3ZflifB',
  // Weighted Dips → Weighted Tricep Dips
  'c5239c09-e3d2-4b07-9438-10ba0828691d': 'bZq4bwK',
  // Weighted Pull-Ups → Weighted Pull-Up
  '5110b0d4-4952-45aa-a57f-6a03c8105090': 'HMzLjXx',
  // Weighted Sissy Squat → Weighted Sissy Squat
  'fa06400d-c06c-48c6-925a-63ba899c2cc7': '0lQnxMZ',
  // Weighted Squat → Weighted Squat
  'd02cb936-c723-4593-a709-27b73e683780': 'JZuApnB',
  // Cable Row → Cable Seated Row
  '1f545906-18ef-4b59-b1f8-93f3efdb7e1e': 'fUBheHs',
  // Calf Raise → Lever Standing Calf Raise
  'a95f6b29-8939-49bd-8aa4-85fb04cc51a7': 'ykUOVze',
  // Ez Bar Curl → Ez Barbell Close-Grip Curl
  '422e9bc5-35c4-4692-94f9-0c6d17242a18': 'V4ryaZa',
  // Close Grip Pulldown → Band Close-Grip Pulldown (closest match)
  '4a05c8f6-adbb-46ad-9899-20fa987a01c0': 'DptumMx',
  // Skullcrusher → Barbell Lying Triceps Extension Skull Crusher
  '1755c4e2-3b77-404b-8f77-650569d2d53f': 'h8LFzo9',
  // Seated Dumbbell Press → Dumbbell Seated Shoulder Press
  'f520e0b0-cdbc-487d-ae9b-425d4a33334c': 'znQUdHY',
  // Dumbbell Curl → Dumbbell Standing Biceps Curl
  '5bbdbc61-8228-407d-9d51-24629768da40': '3s4NnTh',
  // Bulgarian Split Squat → Suspended Split Squat (closest match, or create custom)
  '52186041-0ad0-4e57-8ca7-aa6d286a69bb': null, // Keep as user-created
  // Bulgarian Split Squat (Db) → Keep as user-created
  'f709f0a1-f934-4b25-8b30-115035bf53a3': null,
  // Barbell Romanian Deadlift (the used one has dumbbell equipment, map to dumbbell version)
  // Already mapped Romanian Deadlift above
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function mapTargetMusclesToMuscleGroup(targetMuscles) {
  if (
    !targetMuscles ||
    !Array.isArray(targetMuscles) ||
    targetMuscles.length === 0
  ) {
    return 'Full Body'
  }
  const primary = targetMuscles[0].toLowerCase()
  if (primary.includes('quad')) return 'Quads'
  if (primary.includes('hamstring')) return 'Hamstrings'
  if (primary.includes('glute')) return 'Glutes'
  if (primary.includes('calf') || primary.includes('calves')) return 'Calves'
  if (primary.includes('chest') || primary.includes('pec')) return 'Chest'
  if (
    primary.includes('back') ||
    primary.includes('lat') ||
    primary.includes('trap') ||
    primary.includes('rhomboid')
  )
    return 'Back'
  if (primary.includes('shoulder') || primary.includes('delt'))
    return 'Shoulders'
  if (primary.includes('bicep')) return 'Biceps'
  if (primary.includes('tricep')) return 'Triceps'
  if (primary.includes('forearm')) return 'Forearms'
  if (
    primary.includes('ab') ||
    primary.includes('core') ||
    primary.includes('oblique')
  )
    return 'Core'
  if (primary.includes('cardio')) return 'Cardio'
  return 'Full Body'
}

function mapEquipmentToType(equipments) {
  if (!equipments || !Array.isArray(equipments) || equipments.length === 0) {
    return 'bodyweight'
  }
  const primary = equipments[0].toLowerCase()
  if (
    primary.includes('barbell') ||
    primary.includes('ez bar') ||
    primary.includes('olympic')
  )
    return 'barbell'
  if (primary.includes('dumbbell')) return 'dumbbell'
  if (primary.includes('cable')) return 'cable'
  if (
    primary.includes('machine') ||
    primary.includes('lever') ||
    primary.includes('sled')
  )
    return 'machine'
  if (primary.includes('kettlebell')) return 'kettlebell'
  if (primary.includes('band') || primary.includes('resistance'))
    return 'resistance band'
  if (primary.includes('body weight') || primary === 'body weight')
    return 'bodyweight'
  return 'other'
}

function determineExerciseType(name, targetMuscles, secondaryMuscles) {
  // Compound exercises work multiple joints/muscle groups
  const compoundKeywords = [
    'squat',
    'deadlift',
    'press',
    'row',
    'pull-up',
    'chin-up',
    'dip',
    'clean',
    'snatch',
    'lunge',
    'thruster',
  ]
  const lowerName = name.toLowerCase()

  if (compoundKeywords.some((kw) => lowerName.includes(kw))) {
    return 'compound'
  }

  // If has multiple target muscles or secondary muscles, likely compound
  if (
    (targetMuscles && targetMuscles.length > 1) ||
    (secondaryMuscles && secondaryMuscles.length > 2)
  ) {
    return 'compound'
  }

  return 'isolation'
}

// =============================================================================
// MAIN MIGRATION
// =============================================================================

async function main() {
  const dryRun = process.argv.includes('--dry-run')

  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  EXERCISE MIGRATION SCRIPT')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(
    `  Mode: ${
      dryRun
        ? '🔍 DRY RUN (no changes will be made)'
        : '⚠️  LIVE RUN (database will be modified)'
    }`,
  )
  console.log('')

  // Setup Supabase client
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

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  console.log(`📍 Supabase URL: ${supabaseUrl}`)
  console.log('')

  // Load new exercises from exercises.json
  const exercisesPath = path.join(
    __dirname,
    '..',
    'assets',
    'exercises',
    'exercises.json',
  )
  const newExercises = JSON.parse(await fs.readFile(exercisesPath, 'utf8'))
  console.log(`📦 Loaded ${newExercises.length} exercises from exercises.json`)

  // Create a lookup map for new exercises by exerciseId
  const newExercisesById = new Map()
  for (const ex of newExercises) {
    newExercisesById.set(ex.exerciseId, ex)
  }

  // Get all used exercise IDs from workout_exercises
  console.log('📊 Fetching used exercise IDs from workout_exercises...')
  const { data: usedExerciseIdsData, error: usedError } = await supabase
    .from('workout_exercises')
    .select('exercise_id')
    .limit(100000)

  if (usedError) {
    console.error('❌ Error fetching used exercises:', usedError.message)
    process.exit(1)
  }

  const usedExerciseIds = [
    ...new Set(usedExerciseIdsData.map((we) => we.exercise_id)),
  ]
  console.log(
    `   Found ${usedExerciseIds.length} unique exercises used in workouts`,
  )

  // Get all current exercises from the database
  console.log('📊 Fetching all exercises from database...')
  const { data: currentExercises, error: currentError } = await supabase
    .from('exercises')
    .select('*')
    .limit(10000)

  if (currentError) {
    console.error('❌ Error fetching current exercises:', currentError.message)
    process.exit(1)
  }

  const currentExercisesById = new Map()
  for (const ex of currentExercises) {
    currentExercisesById.set(ex.id, ex)
  }
  console.log(`   Found ${currentExercises.length} exercises in database`)
  console.log('')

  // ==========================================================================
  // STEP 1: Determine which exercises to keep, update, or delete
  // ==========================================================================
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  STEP 1: Analyze exercise mappings')
  console.log('═══════════════════════════════════════════════════════════════')

  const exercisesToMigrate = [] // Old exercises that map to new ones
  const exercisesToKeep = [] // User-created exercises with no mapping (but used)
  const exercisesToDelete = [] // Exercises not used by anyone

  for (const oldExercise of currentExercises) {
    const isUsed = usedExerciseIds.includes(oldExercise.id)
    const newExerciseId = EXERCISE_MAPPING[oldExercise.id]

    if (!isUsed) {
      exercisesToDelete.push(oldExercise)
    } else if (newExerciseId && newExercisesById.has(newExerciseId)) {
      const newExercise = newExercisesById.get(newExerciseId)
      exercisesToMigrate.push({
        old: oldExercise,
        new: newExercise,
        newExerciseId,
      })
    } else {
      // Used but no mapping → keep as custom exercise
      exercisesToKeep.push(oldExercise)
    }
  }

  console.log(
    `   📝 Exercises to migrate (map old → new): ${exercisesToMigrate.length}`,
  )
  console.log(
    `   ✅ Exercises to keep (user-created, used): ${exercisesToKeep.length}`,
  )
  console.log(
    `   🗑️  Exercises to delete (never used): ${exercisesToDelete.length}`,
  )
  console.log('')

  // Show migrations
  if (exercisesToMigrate.length > 0) {
    console.log('  Migrations:')
    for (const { old, new: newEx } of exercisesToMigrate) {
      console.log(`   • "${old.name}" → "${newEx.name}"`)
    }
    console.log('')
  }

  // Show kept exercises
  if (exercisesToKeep.length > 0) {
    console.log('  Keeping (user-created):')
    for (const ex of exercisesToKeep.slice(0, 20)) {
      console.log(`   • ${ex.name}`)
    }
    if (exercisesToKeep.length > 20) {
      console.log(`   ... and ${exercisesToKeep.length - 20} more`)
    }
    console.log('')
  }

  // Show deletions (first 20)
  if (exercisesToDelete.length > 0) {
    console.log('  Deleting (never used):')
    for (const ex of exercisesToDelete.slice(0, 20)) {
      console.log(`   • ${ex.name}`)
    }
    if (exercisesToDelete.length > 20) {
      console.log(`   ... and ${exercisesToDelete.length - 20} more`)
    }
    console.log('')
  }

  // ==========================================================================
  // STEP 2: Upload new exercises to database
  // ==========================================================================
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  STEP 2: Upload new exercises to database')
  console.log('═══════════════════════════════════════════════════════════════')

  // Get names of exercises we're keeping to avoid duplicates
  const keptExerciseNames = new Set(
    exercisesToKeep.map((ex) => ex.name.toLowerCase()),
  )

  // Build exercises to insert (without ID - let Supabase generate UUIDs)
  // Skip exercises whose names conflict with ones we're keeping
  const exercisesToInsertData = newExercises
    .filter((ex) => !keptExerciseNames.has(ex.name.toLowerCase()))
    .map((ex) => ({
      name: ex.name,
      muscle_group: mapTargetMusclesToMuscleGroup(ex.targetMuscles),
      type: determineExerciseType(
        ex.name,
        ex.targetMuscles,
        ex.secondaryMuscles,
      ),
      equipment: mapEquipmentToType(ex.equipments),
      created_by: null,
      aliases: [ex.exerciseId], // Store original exerciseId in aliases for reference
      _temp_exercise_id: ex.exerciseId, // Temporary field for mapping
    }))

  const skippedDueToConflict =
    newExercises.length - exercisesToInsertData.length
  if (skippedDueToConflict > 0) {
    console.log(
      `   ⚠️  Skipping ${skippedDueToConflict} exercises due to name conflicts with kept exercises`,
    )
  }

  console.log(
    `   📤 Preparing to insert ${exercisesToInsertData.length} new exercises`,
  )

  // Map from old exerciseId (string) to new UUID
  const newExerciseIdToUUID = new Map()

  if (!dryRun) {
    // Insert new exercises in batches and capture the generated UUIDs
    const BATCH_SIZE = 50
    let inserted = 0

    for (let i = 0; i < exercisesToInsertData.length; i += BATCH_SIZE) {
      const batch = exercisesToInsertData.slice(i, i + BATCH_SIZE)

      // Remove temp field before insert
      const cleanBatch = batch.map(({ _temp_exercise_id, ...rest }) => rest)

      const { data: insertedData, error: insertError } = await supabase
        .from('exercises')
        .insert(cleanBatch)
        .select('id, name')

      if (insertError) {
        console.error(
          `   ❌ Error inserting batch ${i / BATCH_SIZE + 1}:`,
          insertError.message,
        )
        // Continue with next batch
      } else if (insertedData) {
        // Map the inserted exercises back to their exerciseIds
        for (let j = 0; j < insertedData.length; j++) {
          const originalExId = batch[j]._temp_exercise_id
          newExerciseIdToUUID.set(originalExId, insertedData[j].id)
        }
        inserted += insertedData.length
        process.stdout.write(
          `\r   ✅ Inserted ${inserted}/${exercisesToInsertData.length} exercises`,
        )
      }
    }
    console.log('')
    console.log(
      `   📋 Created mapping for ${newExerciseIdToUUID.size} exercises`,
    )
  } else {
    console.log('   🔍 [DRY RUN] Would insert exercises')
    // For dry run, just use the exerciseId as placeholder
    for (const ex of newExercises) {
      newExerciseIdToUUID.set(ex.exerciseId, `NEW-UUID-FOR-${ex.exerciseId}`)
    }
  }

  // ==========================================================================
  // STEP 3: Update workout_exercises to point to new exercise IDs
  // ==========================================================================
  console.log('')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  STEP 3: Update workout_exercises references')
  console.log('═══════════════════════════════════════════════════════════════')

  let updatedCount = 0
  for (const { old, newExerciseId } of exercisesToMigrate) {
    // Get the actual new UUID from our mapping
    const newUUID = newExerciseIdToUUID.get(newExerciseId)

    if (!newUUID) {
      console.log(
        `   ⚠️  No mapping found for "${old.name}" → ${newExerciseId}`,
      )
      continue
    }

    console.log(
      `   • Updating "${old.name}" → new UUID: ${newUUID.substring(0, 8)}...`,
    )

    if (!dryRun) {
      const { error: updateError } = await supabase
        .from('workout_exercises')
        .update({ exercise_id: newUUID })
        .eq('exercise_id', old.id)

      if (updateError) {
        console.error(`     ❌ Error updating:`, updateError.message)
      } else {
        updatedCount++
      }
    }
  }

  if (dryRun) {
    console.log(
      `   🔍 [DRY RUN] Would update ${exercisesToMigrate.length} workout_exercises references`,
    )
  } else {
    console.log(`   ✅ Updated ${updatedCount} exercise references`)
  }

  // ==========================================================================
  // STEP 4: Delete unused exercises
  // ==========================================================================
  console.log('')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  STEP 4: Delete old/unused exercises')
  console.log('═══════════════════════════════════════════════════════════════')

  // Delete migrated exercises (they've been replaced) and unused exercises
  const idsToDelete = [
    ...exercisesToMigrate.map((m) => m.old.id),
    ...exercisesToDelete.map((ex) => ex.id),
  ]

  console.log(`   🗑️  ${idsToDelete.length} exercises to delete`)

  if (!dryRun && idsToDelete.length > 0) {
    const BATCH_SIZE = 100
    for (let i = 0; i < idsToDelete.length; i += BATCH_SIZE) {
      const batch = idsToDelete.slice(i, i + BATCH_SIZE)
      const { error: deleteError } = await supabase
        .from('exercises')
        .delete()
        .in('id', batch)

      if (deleteError) {
        console.error(`   ❌ Error deleting batch:`, deleteError.message)
      }
    }
    console.log('   ✅ Deleted old exercises')
  } else if (dryRun) {
    console.log('   🔍 [DRY RUN] Would delete old exercises')
  }

  // ==========================================================================
  // SUMMARY
  // ==========================================================================
  console.log('')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  MIGRATION SUMMARY')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(`   ✅ New exercises added: ${exercisesToInsertData.length}`)
  console.log(`   🔄 Exercises migrated: ${exercisesToMigrate.length}`)
  console.log(`   📌 User exercises kept: ${exercisesToKeep.length}`)
  console.log(`   🗑️  Exercises deleted: ${idsToDelete.length}`)
  console.log('')

  if (dryRun) {
    console.log('  ⚠️  This was a DRY RUN. No changes were made.')
    console.log('  Run without --dry-run to execute the migration.')
  } else {
    console.log('  ✅ Migration complete!')
  }
  console.log('═══════════════════════════════════════════════════════════════')
}

main().catch(console.error)
