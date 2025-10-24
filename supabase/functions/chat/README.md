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
  - Top lifts (estimated 1RM + best singles)
  - Strength score trend and muscle balance snapshot
  - Latest body log and 90-day changes
  - Leaderboard highlights (best/worst percentile vs. other users)
- Available agent tools:
  - `getWorkoutSlice`: recent sessions with optional filters
  - `getPersonalRecords`: strongest sets per exercise
  - `getBodyLogSnapshots`: body scan metrics (paginate or filter)
  - `getStrengthProgress`: estimated 1RM over time for key lifts
  - `getStrengthScoreProgress`: cumulative estimated 1RM sum
  - `getMuscleBalance`: training volume share per muscle group
  - `getLeaderboardPercentile`: percentile rank for a lift (requires exercise name)

All tool schemas use Zod for validation; inputs are clamped (limits, date ranges) to keep responses tight.
