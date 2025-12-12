#!/usr/bin/env node

/**
 * Script to run the exercise metadata migration on test DB
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://lpptsqwojplyxevtvkyr.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: Missing SUPABASE_SERVICE_ROLE_KEY');
  console.error('Make sure .env.local exists with SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const migrationPath = path.join(__dirname, '../supabase/migrations/20251212120000_add_exercise_metadata_fields.sql');

async function runMigration() {
  console.log('Reading migration file...\n');
  
  if (!fs.existsSync(migrationPath)) {
    console.error(`❌ Error: Migration file not found at ${migrationPath}`);
    process.exit(1);
  }
  
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
  
  console.log('Running migration on test DB...\n');
  console.log('Migration SQL:');
  console.log('─'.repeat(50));
  console.log(migrationSQL);
  console.log('─'.repeat(50));
  console.log();
  
  // Split SQL into individual statements
  const statements = migrationSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));
  
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    if (!statement) continue;
    
    console.log(`Executing statement ${i + 1}/${statements.length}...`);
    
    try {
      // Use RPC to execute raw SQL (requires service role key)
      const { data, error } = await supabase.rpc('exec_sql', { 
        sql_query: statement + ';' 
      });
      
      if (error) {
        // Try direct query approach
        const { error: queryError } = await supabase
          .from('_migration_test')
          .select('*')
          .limit(0);
        
        // If that doesn't work, try using the REST API directly
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({ sql_query: statement + ';' }),
        });
        
        if (!response.ok) {
          // Fallback: use PostgREST query builder workaround
          console.log(`  ⚠️  Direct SQL execution not available, trying alternative approach...`);
          console.log(`  Statement: ${statement.substring(0, 50)}...`);
          
          // For ALTER TABLE statements, we might need to use psql or Supabase dashboard
          console.log(`  ⚠️  This migration needs to be run via Supabase Dashboard SQL Editor or psql`);
          console.log(`  ⚠️  Please run the SQL manually in Supabase Dashboard`);
          continue;
        }
      }
      
      console.log(`  ✓ Statement ${i + 1} executed successfully`);
    } catch (error) {
      console.error(`  ❌ Error executing statement ${i + 1}: ${error.message}`);
      console.log(`  ⚠️  You may need to run this migration manually via Supabase Dashboard SQL Editor`);
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('Migration execution attempt completed');
  console.log('='.repeat(50));
  console.log('\nNote: If migration failed, please run it manually via:');
  console.log('1. Go to Supabase Dashboard > SQL Editor');
  console.log('2. Copy the SQL from:', migrationPath);
  console.log('3. Execute it');
}

runMigration().catch(error => {
  console.error('Fatal error:', error);
  console.log('\n⚠️  Migration needs to be run manually via Supabase Dashboard SQL Editor');
  console.log('Migration file:', migrationPath);
  process.exit(1);
});

