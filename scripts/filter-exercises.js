#!/usr/bin/env node
/**
 * Exercise Filtering Script
 *
 * Filters exercises.json to remove:
 * - Stretches and flexibility exercises
 * - Yoga poses
 * - Physio-type movements (pelvic tilts, roller stretches)
 * - Exercises on stability/exercise/bosu balls
 * - Duplicate variations (V. 2, V. 3, - Variation, Style)
 * - Gender-specific duplicates (Male)
 * - Uncommon/specialized exercises
 *
 * Keeps:
 * - Barbell, dumbbell, cable, machine exercises
 * - Common bodyweight exercises
 * - Kettlebell exercises
 * - Common band/resistance exercises
 *
 * Usage:
 *   node scripts/filter-exercises.js --dry-run   # Preview what will be removed
 *   node scripts/filter-exercises.js             # Apply the filter
 */

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// =============================================================================
// FILTER RULES
// =============================================================================

// Names containing these patterns will be REMOVED (case-insensitive)
const REMOVE_NAME_PATTERNS = [
  // Stretches (but keep "stretch lunge" type exercises)
  /\bstretch\b(?!.*lunge)/i,

  // Yoga and poses
  /yoga/i,
  /\bpose\b/i,
  /\bsphinx\b/i,

  // Physio-type movements
  /\bpelvic tilt\b/i,
  /\bpiriformis\b/i,
  /\bflexor\b.*\bstretch/i,
  /\broller\b.*\b(stretch|hip|lat|back)\b/i,
  /\b(foam )?roller\b(?!out)/i, // Keep rollerout exercises

  // Stability/Exercise ball exercises (too specialized)
  /\b(stability|exercise|bosu)\s*ball\b/i,
  /\bon\s*(stability|exercise)\s*ball\b/i,

  // Gender-specific duplicates
  /\(male\)/i,
  /\(female\)/i,

  // Variation duplicates (keep base versions)
  /\bv\.\s*[2-9]\b/i, // V. 2, V. 3, etc.
  /\s+-\s+\w+\s+variation\b/i, // " - Gentle Variation", etc.
  /\b(gentle|intense|controlled|fierce|micro|macro|pure|traditional|advanced|intermediate|basic|elite|targeted|isolation|tough|pointed|flexible|squared|inverted|rough|balance|stability|endurance|precision|single|triple|horizontal|deep|linear)\s+style\b/i,

  // Uncommon warm-up/physio movements
  /\btoe\s*touch\b/i,
  /\bneck\s*(rotation|side)\b/i,
  /\barm\s*circle/i,
  /\bshoulder\s*circle/i,
  /\bbreath/i,
  /\bmeditat/i,

  // Side lying physio exercises (not common gym exercises)
  /\bside\s+lying\s+(floor\s+)?stretch/i,
  /\bassisted\s+(lying|prone|seated).*stretch/i,

  // Wrist-focused physio exercises
  /\bwrist\s*(pull|roller)/i,

  // Obscure/specialized
  /\bperoneals\b/i,
  /\bposterior\s+tibialis\b/i,
  /\biron\s+cross\b(?!.*fly)/i, // Keep iron cross fly
  /\bspine\s+stretch\b/i,
  /\bcat\s*cow\b/i,
  /\bchild('s)?\s*pose\b/i,

  // Equipment we're not tracking
  /\bupper\s*body\s*ergometer\b/i,
  /\bstepmill\b/i,
  /\bskierg\b/i,
  /\btire\b/i,
  /\bbattle\s*rope/i,
]

// Exercise names that should be KEPT even if they match a remove pattern
const KEEP_EXCEPTIONS = [
  /\brollerout\b/i, // Barbell rollout, wheel rollout
  /\broll\s*out\b/i,
  /\bstretch\s*lunge\b/i, // Stretch lunge is a real exercise
  /\bweighted\s*stretch\s*lunge\b/i,
  /\bstability\s*ball\s*crunch\b/i, // Very common
]

// Equipment that indicates gym-worthy exercises (will keep these)
const GYM_EQUIPMENT = [
  'barbell',
  'dumbbell',
  'cable',
  'leverage machine',
  'sled machine',
  'ez barbell',
  'olympic barbell',
  'kettlebell',
  'smith machine',
  'trap bar',
]

// =============================================================================
// FILTER LOGIC
// =============================================================================

function shouldRemoveExercise(exercise) {
  const name = exercise.name || ''
  const equipments = exercise.equipments || []

  // Check if it matches a keep exception first
  for (const pattern of KEEP_EXCEPTIONS) {
    if (pattern.test(name)) {
      return { remove: false, reason: null }
    }
  }

  // Check remove patterns
  for (const pattern of REMOVE_NAME_PATTERNS) {
    if (pattern.test(name)) {
      return { remove: true, reason: `Matches pattern: ${pattern}` }
    }
  }

  return { remove: false, reason: null }
}

function categorizeExercise(exercise) {
  const name = (exercise.name || '').toLowerCase()
  const equipments = (exercise.equipments || []).map((e) => e.toLowerCase())

  if (equipments.some((e) => e.includes('barbell') || e.includes('olympic')))
    return 'barbell'
  if (equipments.some((e) => e.includes('dumbbell'))) return 'dumbbell'
  if (equipments.some((e) => e.includes('cable'))) return 'cable'
  if (
    equipments.some(
      (e) => e.includes('machine') || e.includes('lever') || e.includes('sled'),
    )
  )
    return 'machine'
  if (equipments.some((e) => e.includes('kettlebell'))) return 'kettlebell'
  if (equipments.some((e) => e.includes('band') || e.includes('resistance')))
    return 'band'
  if (equipments.some((e) => e.includes('body weight'))) return 'bodyweight'
  return 'other'
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const verbose = process.argv.includes('--verbose')

  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  EXERCISE FILTER SCRIPT')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(
    `  Mode: ${
      dryRun ? '🔍 DRY RUN (no changes)' : '⚠️  LIVE RUN (will modify file)'
    }`,
  )
  console.log('')

  // Load exercises
  const exercisesPath = path.join(
    __dirname,
    '..',
    'assets',
    'exercises',
    'exercises.json',
  )
  const exercises = JSON.parse(await fs.readFile(exercisesPath, 'utf8'))
  console.log(`📦 Loaded ${exercises.length} exercises`)
  console.log('')

  // Categorize and filter
  const kept = []
  const removed = []
  const removedByCategory = {}
  const keptByCategory = {}

  for (const exercise of exercises) {
    const { remove, reason } = shouldRemoveExercise(exercise)
    const category = categorizeExercise(exercise)

    if (remove) {
      removed.push({ exercise, reason, category })
      removedByCategory[category] = (removedByCategory[category] || 0) + 1
    } else {
      kept.push(exercise)
      keptByCategory[category] = (keptByCategory[category] || 0) + 1
    }
  }

  // Summary
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  FILTER RESULTS')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(`  ✅ Keeping: ${kept.length} exercises`)
  console.log(`  🗑️  Removing: ${removed.length} exercises`)
  console.log('')

  // Breakdown by category - kept
  console.log('  📊 Kept by category:')
  for (const [cat, count] of Object.entries(keptByCategory).sort(
    (a, b) => b[1] - a[1],
  )) {
    console.log(`     ${cat}: ${count}`)
  }
  console.log('')

  // Breakdown by category - removed
  console.log('  🗑️  Removed by category:')
  for (const [cat, count] of Object.entries(removedByCategory).sort(
    (a, b) => b[1] - a[1],
  )) {
    console.log(`     ${cat}: ${count}`)
  }
  console.log('')

  // Group removed by reason pattern
  const removedByReason = {}
  for (const { reason } of removed) {
    const key = reason.replace(/Matches pattern: \//, '').replace(/\/i$/, '')
    removedByReason[key] = (removedByReason[key] || 0) + 1
  }

  console.log('  📋 Removed by pattern:')
  for (const [pattern, count] of Object.entries(removedByReason).sort(
    (a, b) => b[1] - a[1],
  )) {
    console.log(`     ${pattern.substring(0, 50).padEnd(50)}: ${count}`)
  }
  console.log('')

  // Show sample of removed exercises
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  SAMPLE OF REMOVED EXERCISES (first 50)')
  console.log('═══════════════════════════════════════════════════════════════')
  for (const { exercise, reason } of removed.slice(0, 50)) {
    console.log(`  • ${exercise.name}`)
    if (verbose) {
      console.log(`    Reason: ${reason}`)
    }
  }
  if (removed.length > 50) {
    console.log(`  ... and ${removed.length - 50} more`)
  }
  console.log('')

  // Apply changes if not dry run
  if (!dryRun) {
    // Backup original
    const backupPath = exercisesPath.replace('.json', '.backup.json')
    await fs.writeFile(backupPath, JSON.stringify(exercises, null, 2))
    console.log(`  💾 Backup saved to: ${backupPath}`)

    // Write filtered exercises
    await fs.writeFile(exercisesPath, JSON.stringify(kept, null, 2))
    console.log(`  ✅ Filtered exercises saved to: ${exercisesPath}`)
  } else {
    console.log('  ⚠️  This was a DRY RUN. No changes were made.')
    console.log('  Run without --dry-run to apply the filter.')
  }

  console.log('═══════════════════════════════════════════════════════════════')
}

main().catch(console.error)
