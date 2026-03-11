# Chat Edge Function

Ported from `app/api/chat+api.ts` to Supabase Edge Functions. This function streams responses using the `ai` SDK with OpenAI.

Environment variables required:

- `OPENAI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY` (for user-scoped client)

## User summary + tooling

- The function builds a user summary on demand for each request (no database cache).
- Summary includes:
  - Profile basics, training volume, session range
  - Recent training-style snapshot with exercises/session, working sets, rep-range distribution, and per-muscle session volume
  - Recent workout snapshot with exercises, sets, reps, and loads from the last few sessions
  - Top lifts (estimated 1RM + best singles)
  - Muscle balance snapshot
  - Strength standards snapshot (overall level + closest exercise upgrades)
  - Latest body log and 90-day changes
- Available agent tools:
  - `getWorkoutSlice`: recent sessions with optional filters
  - `getTrainingPatterns`: recent training structure, rep ranges, and per-muscle session volume
  - `getPersonalRecords`: strongest sets per exercise
  - `getBodyLogSnapshots`: body scan metrics (paginate or filter)
  - `getBodyCompositionProgress`: lean mass, fat mass, muscle mass, physique scores, and scan-to-scan trend context
  - `getStrengthProgress`: estimated 1RM over time for key lifts
  - `getMuscleBalance`: training volume share per muscle group
  - `getExerciseStandards`: full standards ladder and exact target values for a lift
  - `getLifterLevel`: overall lifter level, points, next-level progress, weak-point breakdown
  - `getExerciseRanks`: per-exercise rank, next-level target, gap to level up, and exercise score points
  - `getRecoveryStatus`: muscle-by-muscle recovery/readiness snapshot
  - `getConsistencyAdherence`: streak, weekly target, recent workout calendar, and cadence status

All tool schemas use Zod for validation; inputs are clamped (limits, date ranges) to keep responses tight.
