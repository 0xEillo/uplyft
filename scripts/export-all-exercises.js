#!/usr/bin/env node
/**
 * Export all exercises from prod database to JSON
 * Excludes embedding vectors (too large)
 *
 * Usage: node scripts/export-all-exercises.js
 * Output: data/exercises-export.json
 */

require('dotenv').config()
require('cross-fetch/polyfill')
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error(
    'Missing env vars: EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY',
  )
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// All columns except 'embedding' (vector data is huge)
const COLUMNS = [
  'id',
  'name',
  'muscle_group',
  'type',
  'equipment',
  'created_by',
  'created_at',
  'aliases',
  'exercise_id',
  'gif_url',
  'target_muscles',
  'body_parts',
  'equipments',
  'secondary_muscles',
].join(',')

async function exportAllExercises() {
  console.log(`Connecting to: ${supabaseUrl}`)
  console.log('Fetching exercises...')

  const { data, error, count } = await supabase
    .from('exercises')
    .select(COLUMNS, { count: 'exact' })
    .order('name', { ascending: true })

  if (error) {
    console.error('Query failed:', error.message)
    process.exit(1)
  }

  if (!data?.length) {
    console.log('No exercises found')
    process.exit(0)
  }

  const outputPath = path.join(__dirname, '..', 'data', 'exercises-export.json')

  // Ensure data directory exists
  const dataDir = path.dirname(outputPath)
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }

  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2))

  console.log(`✅ Exported ${data.length} exercises to ${outputPath}`)

  // Print summary stats
  const withGif = data.filter((e) => e.gif_url).length
  const withAliases = data.filter((e) => e.aliases?.length).length
  const withInstructions = data.filter((e) => e.instructions?.length).length
  const globalExercises = data.filter((e) => !e.created_by).length
  const customExercises = data.filter((e) => e.created_by).length

  console.log('\nStats:')
  console.log(`  Global exercises: ${globalExercises}`)
  console.log(`  Custom exercises: ${customExercises}`)
  console.log(`  With GIF URL: ${withGif}`)
  console.log(`  With aliases: ${withAliases}`)
  console.log(`  With instructions: ${withInstructions}`)
}

exportAllExercises().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
