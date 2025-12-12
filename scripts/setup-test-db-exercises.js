#!/usr/bin/env node

/**
 * Complete setup script for test DB exercises
 * 1. Provides migration instructions
 * 2. Runs the populate script
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_REF = 'lpptsqwojplyxevtvkyr';
const MIGRATION_FILE = path.join(__dirname, '../supabase/migrations/20251212120000_add_exercise_metadata_fields.sql');

console.log('='.repeat(60));
console.log('Test DB Exercise Setup');
console.log('='.repeat(60));
console.log(`Project: ${PROJECT_REF}`);
console.log('');

// Step 1: Migration
console.log('STEP 1: Run Migration');
console.log('-'.repeat(60));
console.log('The migration needs to be run manually via one of these methods:');
console.log('');
console.log('Option A - Supabase Dashboard (Recommended):');
console.log(`  1. Go to: https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new`);
console.log(`  2. Copy the SQL from: ${MIGRATION_FILE}`);
console.log('  3. Paste and execute');
console.log('');
console.log('Option B - psql (if you have DATABASE_URL):');
console.log(`  export DATABASE_URL='postgresql://postgres:[PASSWORD]@db.${PROJECT_REF}.supabase.co:5432/postgres'`);
console.log(`  psql "$DATABASE_URL" -f ${MIGRATION_FILE}`);
console.log('');
console.log('Press Enter after you have run the migration, or Ctrl+C to cancel...');
console.log('');

// Wait for user input (in a real scenario, you'd use readline)
// For now, we'll just proceed after a delay or check if migration was run
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Have you run the migration? (y/n): ', async (answer) => {
  if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
    console.log('\n⚠️  Please run the migration first, then run this script again.');
    rl.close();
    process.exit(0);
  }
  
  rl.close();
  
  // Step 2: Populate exercises
  console.log('');
  console.log('STEP 2: Populate Exercises');
  console.log('-'.repeat(60));
  console.log('Running populate script...');
  console.log('');
  
  try {
    execSync('node scripts/populate-exercises-from-json.js', {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    console.log('');
    console.log('='.repeat(60));
    console.log('✅ Setup completed successfully!');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('');
    console.error('❌ Error running populate script');
    console.error('Make sure:');
    console.error('  1. Migration has been run');
    console.error('  2. .env.local has SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
});

