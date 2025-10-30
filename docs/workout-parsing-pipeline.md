# Workout Parsing Pipeline

## Flow Overview

- **Draft & submit:** the create-post screen captures raw workout notes, saves a pending payload in AsyncStorage, and drops a placeholder card into the feed so the UI stays responsive.
- **Background processing:** once the feed screen resumes, it pops the pending payload, calls the `parse-workout` Supabase function with the user’s preferred weight unit, and waits for a structured response.
- **Result handling:** successful responses replace the placeholder with the enriched workout; failures restore the draft so the athlete can fix it.
- **Voice flow:** the voice logger follows the same server contract: raw text transcription feeds into the same parser, then persists via the local database abstraction.

## Client Entry Points

`app/(tabs)/index.tsx`

```170:249:app/(tabs)/index.tsx
      const response = await callSupabaseFunction(
        'parse-workout',
        'POST',
        {
          notes,
          weightUnit,
          createWorkout: true,
          userId: user.id,
          workoutTitle: title,
          imageUrl,
        },
        {},
        accessToken,
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error || 'Failed to parse workout'

        // Restore draft + surface retry affordance
```

- We hand the athlete’s preferred unit straight through to the edge function; the parser is always the single source of truth for normalization.
- A 90s timeout guards against pathological AI latency, after which we abort, reinstate the draft, and prompt the user to retry.

`app/(tabs)/create-speech.tsx`

```120:167:app/(tabs)/create-speech.tsx
      const parseResponse = await callSupabaseFunction(
        'parse-workout',
        'POST',
        { notes: text, weightUnit, userId: user?.id },
        {},
        token,
      )

      if (!parseResponse.ok) {
        const errorData = await parseResponse.json().catch(() => ({}))
        const errorMessage = errorData.error || 'Failed to parse workout'
        setIsProcessing(false)
        Alert.alert('Unable to Parse Workout', errorMessage, [{ text: 'Try Again' }])
        return
      }

      const { workout } = await parseResponse.json()
      await database.workoutSessions.create(user.id, workout, text)
```

## Edge Function Responsibilities

`supabase/functions/parse-workout/index.ts`

```44:183:supabase/functions/parse-workout/index.ts
const requestSchema = z.object({
  notes: z.string(),
  weightUnit: z.enum(['kg', 'lb']).optional().default('kg'),
  createWorkout: z.boolean().optional(),
  userId: z.string().optional(),
  workoutTitle: z.string().optional(),
  imageUrl: z.string().nullable().optional(),
})

const KG_TO_LB = 2.20462

function coerceNumber(value: unknown): number | null { /* trims and parses */ }

function normalizeWeightToKg(weight: unknown, sourceUnit: 'kg' | 'lb'): number | null {
  const numeric = coerceNumber(weight)
  if (numeric === null) return null
  return sourceUnit === 'kg' ? numeric : numeric / KG_TO_LB
}

const structured = await generateObject({
  model: openaiClient,
  schema: workoutSchema,
  prompt: buildParsePrompt(payload.notes, payload.weightUnit),
})

const finalWorkout = {
  ...workoutData,
  type: workoutType,
  exercises: workoutData.exercises.map((ex) => ({
    ...ex,
    sets: Array.isArray(ex.sets)
      ? ex.sets.map((set) => ({
          ...set,
          reps: typeof set.reps === 'number' && Number.isFinite(set.reps) && set.reps >= 1 ? set.reps : null,
          weight: normalizeWeightToKg(set.weight, payload.weightUnit) ?? undefined,
          rpe: set.rpe ?? undefined,
        }))
      : [],
  })),
}
```

- We enforce a contract up front with Zod so malformed requests are rejected before we touch the LLM.
- The `generateObject` call uses the shared schema, so hallucinated fields are stripped and per-set objects stay predictable.
- **Unit fix:** every set passes through `normalizeWeightToKg`, so the database always stores kilograms. Downstream formatters (`kgToPreferred`) can reconvert without double-multiplying.
- The prompt still tells the model to convert into the caller’s unit (legacy behavior). Normalization on our side makes that instruction harmless, but we could drop it later to save tokens.

### Workout Title Enrichment

- If the user doesn’t specify a title, we feed the exercise list into a tiny LLM call (`gpt-4.1-nano`) to synthesize a split-friendly title.
- This stays optional; we only record a title when we can infer one confidently.

### Optional Persistence Flow

```311:399:supabase/functions/parse-workout/index.ts
const { data: session } = await supabase
  .from('workout_sessions')
  .insert({
    user_id: userId,
    raw_text: rawText,
    notes: parsedWorkout.notes,
    type: parsedWorkout.type,
    image_url: imageUrl || null,
  })
  .select()
  .single()

const exerciseResolutions = await resolveExercisesWithAgent(
  exercises.map((ex: any) => ex.name),
  userId,
)

const workoutExercisesToInsert = exercises.map((parsedEx: any) => ({
  session_id: session.id,
  exercise_id: resolution.exerciseId,
  order_index: parsedEx.order_index,
  notes: parsedEx.notes,
}))

const allSetsToInsert = exercises.flatMap((parsedEx: any, index: number) => ({
  workout_exercise_id: workoutExercise.id,
  set_number: set.set_number,
  reps: set.reps ?? null,
  weight: set.weight ?? null,
  rpe: set.rpe ?? null,
  notes: set.notes ?? null,
}))
```

- When `createWorkout` is true we persist immediately, resolving each exercise through an agent that can search or create metadata-backed entries. This keeps the exercise catalog tidy while still supporting novel movements.
- Set insertion happens after the workout exercises are stored so we can reference the generated IDs.
- Any failure during persistence surfaces as a structured JSON error while still returning the parsed payload, so the client can retry without re-running the LLM.

### Exercise Resolution Agent

- Iteratively calls `searchExercises` and `createExercise` tools until every parsed name maps to a canonical exercise ID.
- Falls back to a direct Supabase query or creation if the agent response is incomplete, guaranteeing we never return partially resolved workouts.
- Metrics (`totalExercises`, `createdExercises`, etc.) are logged to `console` and returned in `_metrics` to help us monitor how often we create new exercises.

## Error Handling & Edge Cases

- **Validation errors:** Zod violations return 400 with per-field details; the client surfaces a generic alert but keeps the draft intact.
- **LLM refusals:** if OpenAI refuses for policy reasons we translate that into a 400 so users aren’t left guessing.
- **Timeouts / aborts:** the client aborts after 90s, restores drafts, and removes the placeholder workout to avoid stale UI.
- **Unit conversion regression:** fixed by forcing kilograms at the edge; clients must always reconvert from kg rather than trusting model output.
- **Image upload failures:** handled locally before we hit the parser; athletes can choose to continue without an image.

## Future Improvements (speculative)

- Drop the prompt’s bidirectional conversion instructions to reduce token waste now that we normalize on the server. Flag: speculative.
- Record the original unit alongside the normalized value for analytics.
- Cache successful exercise resolutions per user to avoid repeatedly calling the agent for common templates.
