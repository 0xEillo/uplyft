# Chat Edge Function

Ported from `app/api/chat+api.ts` to Supabase Edge Functions. This function streams responses using the `ai` SDK with OpenAI.

Environment variables required:
- `OPENAI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY` (for user-scoped client)
