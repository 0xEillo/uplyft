#!/usr/bin/env node

/**
 * Complete script to:
 * 1. Show migration SQL (needs to be run manually)
 * 2. Verify migration was run
 * 3. Populate exercises from JSON
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const PROJECT_REF = 'lpptsqwojplyxevtvkyr';
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || `https://${PROJECT_REF}.supabase.co`;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: Missing SUPABASE_SERVICE_ROLE_KEY');
  console.error('\nPlease create .env.local with:');
  console.error(`EXPO_PUBLIC_SUPABASE_URL=${SUPABASE_URL}`);
  console.error('SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const migrationPath = path.join(__dirname, '../supabase/migrations/20251212120000_add_exercise_metadata_fields.sql');

async function checkMigrationStatus() {
  console.log('Checking if migration has been run...\n');
  
  // Try to query one of the new columns
  const { data, error } = await supabase
    .from('exercises')
    .select('exercise_id, gif_url, target_muscles')
    .limit(1);
  
  if (error) {
    // Check if error is because column doesn't exist
    if (error.message.includes('column') && error.message.includes('does not exist')) {
      return false;
    }
    // Other error - might be RLS or connection issue
    console.warn(`⚠️  Could not verify migration status: ${error.message}`);
    return null;
  }
  
  // If we got data, columns exist
  return true;
}

async function main() {
  console.log('='.repeat(60));
  console.log('Test DB Exercise Migration & Population');
  console.log('='.repeat(60));
  console.log(`Project: ${PROJECT_REF}`);
  console.log(`URL: ${SUPABASE_URL}`);
  console.log('');
  
  // Step 1: Check migration status
  const migrationRun = await checkMigrationStatus();
  
  if (migrationRun === false) {
    console.log('❌ Migration has NOT been run yet.');
    console.log('');
    console.log('Please run the migration first:');
    console.log('');
    console.log('Option 1 - Supabase Dashboard (Recommended):');
    console.log(`  1. Go to: https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new`);
    console.log(`  2. Copy and paste the SQL below:`);
    console.log('');
    console.log('─'.repeat(60));
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log(migrationSQL);
    console.log('─'.repeat(60));
    console.log('');
    console.log('  3. Click "Run"');
    console.log('');
    console.log('Option 2 - psql:');
    console.log(`  psql "postgresql://postgres:[PASSWORD]@db.${PROJECT_REF}.supabase.co:5432/postgres" -f ${migrationPath}`);
    console.log('');
    console.log('After running the migration, run this script again.');
    process.exit(1);
  } else if (migrationRun === true) {
    console.log('✅ Migration appears to be run (columns exist)');
  } else {
    console.log('⚠️  Could not verify migration status - proceeding anyway...');
  }
  
  console.log('');
  console.log('='.repeat(60));
  console.log('Step 2: Populating exercises from JSON');
  console.log('='.repeat(60));
  console.log('');
  
  // Now run the populate script
  const exercisesJsonPath = path.join(__dirname, '../assets/exercises/exercises.json');
  
  if (!fs.existsSync(exercisesJsonPath)) {
    console.error(`❌ Error: File not found at ${exercisesJsonPath}`);
    process.exit(1);
  }
  
  const fileContent = fs.readFileSync(exercisesJsonPath, 'utf8');
  const exercises = JSON.parse(fileContent);
  
  if (!Array.isArray(exercises)) {
    console.error('❌ Error: exercises.json should contain an array');
    process.exit(1);
  }
  
  console.log(`Found ${exercises.length} exercises\n`);
  console.log('Populating database...\n');
  
  // Import the populate functions
  function normalizeExerciseName(name) {
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
  
  function mapExerciseData(jsonExercise) {
    return {
      exercise_id: jsonExercise.exerciseId,
      gif_url: jsonExercise.gifUrl,
      target_muscles: jsonExercise.targetMuscles || [],
      body_parts: jsonExercise.bodyParts || [],
      equipments: jsonExercise.equipments || [],
      secondary_muscles: jsonExercise.secondaryMuscles || [],
      instructions: jsonExercise.instructions || [],
    };
  }
  
  async function upsertExercise(jsonExercise) {
    const normalizedName = normalizeExerciseName(jsonExercise.name);
    const exerciseData = mapExerciseData(jsonExercise);
    
    // First, try to find by exercise_id if it exists
    if (jsonExercise.exerciseId) {
      const { data: existingById, error: idError } = await supabase
        .from('exercises')
        .select('id, name')
        .eq('exercise_id', jsonExercise.exerciseId)
        .maybeSingle();
      
      if (existingById && !idError) {
        console.log(`  Found by exercise_id: ${jsonExercise.exerciseId}`);
        const { data, error } = await supabase
          .from('exercises')
          .update(exerciseData)
          .eq('id', existingById.id)
          .select()
          .single();
        
        if (error) {
          console.error(`  ❌ Error updating exercise: ${error.message}`);
          return null;
        }
        return data;
      }
    }
    
    // Try to find by name (case-insensitive)
    const { data: existingByName, error: nameError } = await supabase
      .from('exercises')
      .select('id, name')
      .ilike('name', normalizedName)
      .maybeSingle();
    
    if (existingByName && !nameError) {
      console.log(`  Found by name: ${existingByName.name}`);
      const { data, error } = await supabase
        .from('exercises')
        .update(exerciseData)
        .eq('id', existingByName.id)
        .select()
        .single();
      
      if (error) {
        console.error(`  ❌ Error updating exercise: ${error.message}`);
        return null;
      }
      return data;
    }
    
    // Create new exercise
    console.log(`  Creating new exercise: ${normalizedName}`);
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
      .single();
    
    if (error) {
      console.error(`  ❌ Error creating exercise: ${error.message}`);
      return null;
    }
    
    return data;
  }
  
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < exercises.length; i++) {
    const exercise = exercises[i];
    console.log(`[${i + 1}/${exercises.length}] Processing: ${exercise.name}`);
    
    try {
      const result = await upsertExercise(exercise);
      if (result) {
        successCount++;
        console.log(`  ✓ Success (ID: ${result.id})\n`);
      } else {
        errorCount++;
        console.log(`  ✗ Failed\n`);
      }
    } catch (error) {
      errorCount++;
      console.error(`  ❌ Exception: ${error.message}\n`);
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`✅ Completed: ${successCount} successful, ${errorCount} errors`);
  console.log('='.repeat(60));
}

main().catch(error => {
  console.error('\nFatal error:', error);
  process.exit(1);
});

