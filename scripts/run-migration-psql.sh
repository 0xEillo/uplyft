#!/bin/bash

# Script to run migration on test DB via psql
# Usage: ./scripts/run-migration-psql.sh

set -e

PROJECT_REF="lpptsqwojplyxevtvkyr"
MIGRATION_FILE="supabase/migrations/20251212120000_add_exercise_metadata_fields.sql"

echo "Running migration on test DB: ${PROJECT_REF}"
echo ""

# Check if DB connection string is provided
if [ -z "$DATABASE_URL" ]; then
  echo "⚠️  DATABASE_URL not set. You can:"
  echo "   1. Set DATABASE_URL environment variable:"
  echo "      export DATABASE_URL='postgresql://postgres:[PASSWORD]@db.${PROJECT_REF}.supabase.co:5432/postgres'"
  echo ""
  echo "   2. Or run the SQL manually in Supabase Dashboard:"
  echo "      - Go to https://supabase.com/dashboard/project/${PROJECT_REF}/sql"
  echo "      - Copy SQL from: ${MIGRATION_FILE}"
  echo "      - Execute it"
  echo ""
  exit 1
fi

echo "Executing migration..."
psql "$DATABASE_URL" -f "$MIGRATION_FILE"

echo ""
echo "✅ Migration completed successfully!"

