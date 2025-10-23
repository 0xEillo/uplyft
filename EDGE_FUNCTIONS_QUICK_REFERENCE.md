# Supabase Edge Functions - Quick Reference

## Deploy Functions (First Time)

```bash
# Login
supabase login

# Link project
supabase link --project-ref YOUR_PROJECT_ID

# Deploy
supabase functions deploy
```

## Set OpenAI API Key

**Supabase Dashboard** → Project Settings → Secrets
- Add: `OPENAI_API_KEY` = `sk-proj-...`

## Test Locally

```bash
# Start services
supabase start

# In new terminal
supabase functions serve

# Test parse-workout
curl -X POST http://localhost:54321/functions/v1/parse-workout \
  -H "Content-Type: application/json" \
  -d '{"notes":"Squat 3x5x225lbs"}'

# Stop services
supabase stop
```

## View Logs

```bash
# Development
supabase functions logs --follow

# Production (Dashboard)
Project → Edge Functions → Logs
```

## Function URLs

```
https://YOUR_PROJECT_ID.supabase.co/functions/v1/transcribe
https://YOUR_PROJECT_ID.supabase.co/functions/v1/parse-workout
https://YOUR_PROJECT_ID.supabase.co/functions/v1/extract-image
https://YOUR_PROJECT_ID.supabase.co/functions/v1/body-log-analyze
https://YOUR_PROJECT_ID.supabase.co/functions/v1/chat
```

## Common Commands

| Command | Purpose |
|---------|---------|
| `supabase functions deploy` | Deploy all functions |
| `supabase functions deploy FUNC` | Deploy specific function |
| `supabase functions list` | List deployed functions |
| `supabase functions logs FUNC` | View function logs |
| `supabase secrets list` | View secrets |
| `supabase secrets set KEY=VAL` | Set secret |
| `supabase status` | Check project status |

## App Integration

```typescript
// In app code
import { callSupabaseFunction } from '@/lib/supabase-functions-client'

const response = await callSupabaseFunction(
  'function-name',
  'POST',
  { payload },
  {},
  accessToken // optional
)
```

## Environment Variables

**`.env`** (for local app development)
```
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=YOUR_ANON_KEY
```

**Supabase Secrets** (for edge functions in production)
```
OPENAI_API_KEY=sk-proj-...
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Function not found | `supabase functions list` → re-deploy |
| OpenAI error | Check `OPENAI_API_KEY` in Supabase Secrets |
| CORS error | Check function has `corsHeaders` |
| Timeout | Check Supabase logs for details |
| Auth error | Verify bearer token is valid |

## Get Project Info

```bash
# Get project ID
supabase status | grep "project_id"

# Get anon key (dev)
supabase status | grep "anon key"

# Get anon key (prod)
# Supabase Dashboard → Settings → API → anon (public)
```

## Files to Know

| File | Purpose |
|------|---------|
| `lib/supabase-functions-client.ts` | Client for calling functions |
| `supabase/functions/*/index.ts` | Function implementations |
| `supabase/functions/*/deno.json` | Function dependencies |
| `supabase/functions/_shared/*.ts` | Shared utilities |

## Test Each Function

```bash
# Get anon key
ANON_KEY=$(supabase status | grep "anon key" | awk '{print $NF}')
PROJECT=$(supabase status | grep "project_id" | awk '{print $NF}')

# Test transcribe
curl -X POST "https://$PROJECT.supabase.co/functions/v1/transcribe" \
  -H "Authorization: Bearer $ANON_KEY" \
  -F "audio=@test.m4a"

# Test parse-workout
curl -X POST "https://$PROJECT.supabase.co/functions/v1/parse-workout" \
  -H "Content-Type: application/json" \
  -d '{"notes":"Bench 3x10x185lbs"}'

# Test extract-image
curl -X POST "https://$PROJECT.supabase.co/functions/v1/extract-image" \
  -H "Authorization: Bearer $ANON_KEY" \
  -F "image=@photo.jpg"

# Test body-log-analyze
curl -X POST "https://$PROJECT.supabase.co/functions/v1/body-log-analyze" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ANON_KEY" \
  -d '{"imageId":"test-id"}'

# Test chat
curl -X POST "https://$PROJECT.supabase.co/functions/v1/chat" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ANON_KEY" \
  -d '{"messages":[{"role":"user","content":"Hi"}]}'
```

## Build & Deploy App

```bash
# Local dev
npx expo start

# Build for TestFlight
eas build --platform ios --profile production

# Build for Android
eas build --platform android --profile production
```

## Monitoring

**Supabase Dashboard**
- Project → Edge Functions → Metrics
- Check: Invocations, response times, error rates
- Project → Edge Functions → Logs
- Review: Errors, performance, API calls

## Key Concepts

- **Edge Functions** run globally on Deno Deploy
- **Supabase Secrets** store sensitive values (OPENAI_API_KEY)
- **Bearer tokens** authenticate requests (user session tokens)
- **CORS** headers allow cross-origin requests from app
- **Streaming** enabled for chat (real-time responses)

## Help

```bash
# CLI help
supabase functions --help

# CLI version
supabase --version

# Docs
https://supabase.com/docs/guides/functions
```

---

**Deployment Status**: Ready ✅
**Last Updated**: October 23, 2025
