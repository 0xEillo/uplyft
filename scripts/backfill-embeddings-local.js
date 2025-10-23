#!/usr/bin/env node

/**
 * Local backfill script for exercise embeddings
 * Run this from the project root: node scripts/backfill-embeddings-local.js
 *
 * Required environment variables:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_KEY (note: SERVICE key, not anon key)
 * - OPENAI_API_KEY
 */

import { createClient } from '@supabase/supabase-js'
import { openai } from '@ai-sdk/openai'
import { embed } from 'ai'

const EMBEDDING_MODEL = 'text-embedding-3-small'
const EMBEDDING_DIMENSION = 1536
const BATCH_SIZE = 10 // Smaller batch size for local execution

function sanitizeExerciseName(text) {
  return text
    .normalize('NFKD')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

async function computeEmbedding(name) {
  const normalized = sanitizeExerciseName(name)
  if (!normalized) {
    throw new Error('Cannot embed empty exercise name')
  }

  const result = await embed({
    model: openai.embedding(EMBEDDING_MODEL),
    value: normalized,
  })

  if (!result.embedding || result.embedding.length !== EMBEDDING_DIMENSION) {
    throw new Error(`Invalid embedding result for "${name}"`)
  }

  return result.embedding
}

async function main() {
  // Check environment variables (support multiple naming conventions)
  const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  const openaiKey = process.env.OPENAI_API_KEY

  if (!supabaseUrl || !supabaseKey || !openaiKey) {
    console.error('❌ Missing required environment variables:')
    if (!supabaseUrl) console.error('   - SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL')
    if (!supabaseKey) console.error('   - SUPABASE_SERVICE_KEY or SUPABASE_SERVICE_ROLE_KEY')
    if (!openaiKey) console.error('   - OPENAI_API_KEY')
    process.exit(1)
  }

  // Initialize Supabase client
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  console.log('🔄 Starting exercise embedding backfill...')
  console.log(`📍 Supabase URL: ${supabaseUrl}`)
  console.log('')

  try {
    // Get all exercises without embeddings
    const { data: exercisesWithoutEmbeddings, error: fetchError } = await supabase
      .from('exercises')
      .select('id, name')
      .is('embedding', null)
      .order('created_at', { ascending: true })

    if (fetchError) throw fetchError

    if (!exercisesWithoutEmbeddings || exercisesWithoutEmbeddings.length === 0) {
      console.log('✅ No exercises without embeddings found')
      process.exit(0)
    }

    console.log(`Found ${exercisesWithoutEmbeddings.length} exercises without embeddings`)
    console.log('')

    let processed = 0
    let failed = 0
    const failedExercises = []

    // Process in batches
    for (let i = 0; i < exercisesWithoutEmbeddings.length; i += BATCH_SIZE) {
      const batch = exercisesWithoutEmbeddings.slice(i, i + BATCH_SIZE)
      const batchNum = Math.floor(i / BATCH_SIZE) + 1
      const totalBatches = Math.ceil(exercisesWithoutEmbeddings.length / BATCH_SIZE)

      process.stdout.write(`[${batchNum}/${totalBatches}] Processing ${batch.length} exercises... `)

      const updates = []

      // Compute embeddings for the batch
      for (const exercise of batch) {
        try {
          const embedding = await computeEmbedding(exercise.name)
          updates.push({
            id: exercise.id,
            embedding,
          })
          processed++
        } catch (error) {
          console.error(
            `\n  ❌ Failed to compute embedding for "${exercise.name}" (${exercise.id}):`,
            error.message,
          )
          failed++
          failedExercises.push({
            id: exercise.id,
            name: exercise.name,
            error: error.message,
          })
        }
      }

      // Update exercises with their embeddings
      if (updates.length > 0) {
        for (const { id, embedding } of updates) {
          const { error: updateError } = await supabase
            .from('exercises')
            .update({ embedding })
            .eq('id', id)

          if (updateError) {
            console.error(`\n  ❌ Failed to update exercise ${id}:`, updateError.message)
            failed++
            const exercise = batch.find((e) => e.id === id)
            if (exercise) {
              failedExercises.push({
                id,
                name: exercise.name,
                error: updateError.message,
              })
            }
            processed--
          }
        }
      }

      console.log(`✅ (${processed}/${exercisesWithoutEmbeddings.length} total)`)

      // Add delay between batches to avoid rate limits
      if (i + BATCH_SIZE < exercisesWithoutEmbeddings.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }

    // Print summary
    console.log('')
    console.log('════════════════════════════════════════')
    console.log('📊 Backfill Summary')
    console.log('════════════════════════════════════════')
    console.log(`Total exercises: ${exercisesWithoutEmbeddings.length}`)
    console.log(`Successfully processed: ${processed}`)
    console.log(`Failed: ${failed}`)

    if (failedExercises.length > 0) {
      console.log('')
      console.log('Failed exercises:')
      failedExercises.forEach((ex) => {
        console.log(`  - ${ex.name} (${ex.id}): ${ex.error}`)
      })
    }

    console.log('════════════════════════════════════════')

    if (failed === 0) {
      console.log('✅ Backfill complete!')
      process.exit(0)
    } else {
      console.log(`⚠️  Backfill complete with ${failed} failures`)
      process.exit(1)
    }
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

main()
