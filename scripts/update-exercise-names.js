require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error(
    'Missing Supabase credentials. Make sure EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or EXPO_PUBLIC_SUPABASE_KEY) are set in .env',
  )
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

function titleCase(str) {
  if (!str) return str

  // Capitalize every word - split by spaces and hyphens
  return str
    .split(/\s+/)
    .map((word) => {
      // Handle hyphenated words - capitalize each part
      if (word.includes('-')) {
        return word
          .split('-')
          .map((part) => {
            // Handle parentheses in parts
            if (part.includes('(')) {
              return part
                .replace(/\(([^)]+)\)/g, (match, content) => {
                  const capContent =
                    content.charAt(0).toUpperCase() +
                    content.slice(1).toLowerCase()
                  return '(' + capContent + ')'
                })
                .replace(/^([^(]+)/, (match) => {
                  return (
                    match.charAt(0).toUpperCase() + match.slice(1).toLowerCase()
                  )
                })
            }
            // Capitalize the part
            return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
          })
          .join('-')
      }

      // Handle parentheses
      if (word.includes('(')) {
        return word
          .replace(/\(([^)]+)\)/g, (match, content) => {
            const capContent =
              content.charAt(0).toUpperCase() + content.slice(1).toLowerCase()
            return '(' + capContent + ')'
          })
          .replace(/^([^(]+)/, (match) => {
            return match.charAt(0).toUpperCase() + match.slice(1).toLowerCase()
          })
      }

      // Handle slashes
      if (word.includes('/')) {
        return word
          .split('/')
          .map((w) => {
            const trimmed = w.trim()
            return (
              trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase()
            )
          })
          .join('/')
      }

      // Regular word - capitalize first letter
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join(' ')
    .trim()
}

/**
 * Updates exercise names to Title Case in the database.
 *
 * SAFE TO RUN: This only updates the `name` field in the `exercises` table.
 * All relationships (workout_exercises, sets, etc.) use UUID foreign keys,
 * so updating names won't break any user data or workout history.
 */
async function updateExerciseNames() {
  try {
    console.log('Fetching exercises from database...')

    // Fetch all exercises from database
    const { data: dbExercises, error: fetchError } = await supabase
      .from('exercises')
      .select('id, name')
      .order('name', { ascending: true })

    if (fetchError) {
      throw fetchError
    }

    console.log(`Found ${dbExercises.length} exercises in database\n`)

    let updated = 0
    let unchanged = 0
    const errors = []

    // Update each exercise
    for (const dbEx of dbExercises) {
      const originalName = dbEx.name
      const cleanedName = titleCase(originalName)

      // Check if name needs updating
      if (originalName === cleanedName) {
        unchanged++
        continue
      }

      // Update the exercise name
      const { error: updateError } = await supabase
        .from('exercises')
        .update({ name: cleanedName })
        .eq('id', dbEx.id)

      if (updateError) {
        console.error(
          `❌ Error updating "${originalName}":`,
          updateError.message,
        )
        errors.push({ name: originalName, error: updateError.message })
        continue
      }

      console.log(`✅ Updated: "${originalName}" → "${cleanedName}"`)
      updated++
    }

    console.log('\n📊 Summary:')
    console.log(`  ✅ Updated: ${updated}`)
    console.log(`  ⏭️  Unchanged: ${unchanged}`)
    console.log(`  ❌ Errors: ${errors.length}`)

    if (errors.length > 0) {
      console.log('\n❌ Errors:')
      errors.forEach((e) => {
        console.log(`  - ${e.name}: ${e.error}`)
      })
    }
  } catch (err) {
    console.error('Error updating exercise names:', err.message)
    process.exit(1)
  }
}

updateExerciseNames()
