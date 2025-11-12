# Database Setup

## Running Migrations

### Production Migrations

The `migrations/` directory contains the exact migration files executed against production, preserved for audit purposes.

**To apply:**
1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of each migration file
3. Paste and execute in SQL Editor
4. Run migrations in chronological order (by filename timestamp)

### Test Database Migrations

`migrations/migrations-test/` contains consolidated migrations that mirror the production schema state.

**To apply:**
1. Go to Test Supabase Dashboard → SQL Editor
   - URL: https://supabase.com/dashboard/project/fmwakvonzplhypklnsak
2. Copy contents of each migration file
3. Paste and execute in SQL Editor
4. Run migrations in order: `20251112T0001_*` → `20251112T0011_*`

**Migration files:**
- `20251112T0001_initial_core_schema.sql` - Core tables and RLS
- `20251112T0002_profiles_and_context.sql` - User profiles and context fields
- `20251112T0003_exercise_seed_and_aliases.sql` - Exercise data and aliases
- `20251112T0004_account_and_avatar_policies.sql` - Account functions and storage
- `20251112T0005_schema_adjustments_and_rls.sql` - Schema updates
- `20251112T0006_body_log_schema_and_policies.sql` - Body log tables
- `20251112T0007_exercise_embeddings_and_search.sql` - Vector search
- `20251112T0008_exercise_percentiles_and_refresh.sql` - Percentile calculations
- `20251112T0009_cleanup.sql` - Cleanup operations
- `20251112T0010_workout_routines_and_rpc.sql` - Workout routines
- `20251112T0011_add_workout_session_image_url.sql` - Image URL field

For more commands and workflows, see [docs/COMMANDS.md](../docs/COMMANDS.md).

## Schema Overview

### Tables

1. **exercises** - Catalog of exercises (pre-seeded with 37 common exercises)
2. **workout_sessions** - Individual workout sessions
3. **workout_exercises** - Junction table linking exercises to sessions
4. **sets** - Individual sets with reps, weight, etc.

### Relationships

```
auth.users (Supabase Auth)
    ↓
workout_sessions
    ↓
workout_exercises ← exercises
    ↓
sets
```

### Row Level Security (RLS)

All tables have RLS enabled:

- Users can only access their own workout data
- Exercises are viewable by everyone but only modifiable by creators
- System exercises (created_by = NULL) are read-only

## Usage Examples

See `lib/database.ts` for helper functions:

```typescript
import { database } from '@/lib/database'

// Create a workout from parsed data
await database.workoutSessions.create(userId, parsedWorkout, rawText)

// Get recent workouts
const workouts = await database.workoutSessions.getRecent(userId, 10)

// Get exercise history
const history = await database.stats.getExerciseHistory(userId, 'Bench Press')
```
