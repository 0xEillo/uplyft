# AI Exercise Metadata Enrichment

## Overview

When users submit workouts with exercises that don't exist in the database, those exercises are automatically created with AI-generated metadata including:
- **Muscle Group**: Chest, Back, Legs, Shoulders, Biceps, Triceps, Core, Glutes, Cardio, Full Body
- **Type**: Compound or Isolation
- **Equipment**: Barbell, Dumbbell, Bodyweight, Cable, Machine, Kettlebell, Resistance Band, Other

This ensures all exercises have consistent metadata for features like muscle group distribution tracking and exercise filtering.

## Architecture

### Client Side
- User submits workout through `/create-post` screen
- Workout data is stored in AsyncStorage and processed on next feed load

### Server Side (API Route)
- `/api/parse-workout` handles both parsing AND database creation
- When `createWorkout=true` is passed, it creates the workout with enriched exercises
- Uses server-side database operations that include AI enrichment

### Database Layer
- **Client-side** (`lib/database.ts`): Basic exercise creation without metadata
- **Server-side** (`lib/database-server.ts`): Enhanced exercise creation with AI metadata
- AI metadata generation (`lib/exercise-metadata.ts`): Standalone module for inferring exercise properties

## Workflow

```
User submits workout
  ↓
Stored in AsyncStorage
  ↓
Feed screen loads → handlePendingPost()
  ↓
Call /api/parse-workout with createWorkout=true
  ↓
Parse workout text → structured data
  ↓
For each exercise:
  - Check if exists by name or alias
  - If not found: Generate metadata with AI
  - Create exercise with metadata
  ↓
Create workout session → exercises → sets
  ↓
Return complete workout to client
  ↓
Display in feed
```

## Key Files

### Core Implementation
- `lib/exercise-metadata.ts` - AI metadata generation (server-only)
- `lib/database-server.ts` - Server-side DB operations with AI enrichment
- `app/api/parse-workout+api.ts` - API endpoint for parsing and creating workouts

### Client Integration
- `app/(tabs)/index.tsx` - Feed screen that processes pending workouts
- `app/(tabs)/create-post.tsx` - Workout submission screen

## Error Handling

- If AI metadata generation fails, defaults to sensible values:
  - muscle_group: "Full Body"
  - type: "compound"
  - equipment: "other"
- If database creation fails, workout parsing still succeeds (graceful degradation)
- User can retry if workout creation fails, with draft restored

## Future Improvements

- Cache AI-generated metadata for common exercise variations
- Allow users to manually edit exercise metadata
- Batch metadata generation for multiple new exercises
- Add exercise similarity matching to suggest existing exercises before creating new ones
