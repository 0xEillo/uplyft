require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

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

async function exportExercises() {
  try {
    console.log('Fetching exercises from database...')

    const { data, error } = await supabase
      .from('exercises')
      .select('name, equipment, muscle_group, type')
      .order('name', { ascending: true })

    if (error) {
      throw error
    }

    if (!data || data.length === 0) {
      console.log('No exercises found in database')
      return
    }

    const outputPath = path.join(__dirname, '..', 'exercises.json')
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2))

    console.log(`✅ Exported ${data.length} exercises to ${outputPath}`)
  } catch (err) {
    console.error('Error exporting exercises:', err.message)
    process.exit(1)
  }
}

exportExercises()
