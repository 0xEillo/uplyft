# Database Setup

## Running Migrations

### Option 1: Supabase Dashboard (Easiest)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Create a new query
4. Copy the contents of `migrations/20251003_initial_schema.sql`
5. Run the query
6. Create another new query
7. Copy the contents of `migrations/20251003_seed_exercises.sql`
8. Run the query

### Option 2: Supabase CLI

If you have the Supabase CLI installed:

```bash
# Link your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

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
