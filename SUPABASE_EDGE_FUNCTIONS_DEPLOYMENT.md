# Supabase Edge Functions Deployment Guide

## Overview

This project uses **Supabase Edge Functions** (powered by Deno) to handle all AI-powered features instead of Expo Server Functions. This enables global distribution and eliminates the need for a local API server.

## Edge Functions Implemented

### 1. `transcribe`
- **Purpose**: Convert audio to text using OpenAI Whisper
- **Input**: FormData with audio file
- **Output**: JSON with `text` field
- **Auth**: Optional bearer token
- **Model**: `whisper-1`

### 2. `parse-workout`
- **Purpose**: Parse workout notes into structured exercise data
- **Input**: JSON with `notes`, `weightUnit`, optional `userId`, `workoutTitle`, `imageUrl`
- **Output**: JSON with parsed workout structure
- **Auth**: Optional bearer token
- **Features**: Can create workout in database if `userId` and `createWorkout: true`
- **Model**: `gpt-5-mini` with structured outputs

### 3. `extract-image`
- **Purpose**: Extract workout information from photos using vision
- **Input**: FormData with image file
- **Output**: JSON with extracted content
- **Auth**: Optional bearer token
- **Model**: `gpt-4.1-nano`

### 4. `body-log-analyze`
- **Purpose**: Analyze body composition from photos
- **Input**: JSON with `imageId`
- **Output**: JSON with body metrics (weight, body fat %, BMI, muscle mass)
- **Auth**: Required bearer token
- **Model**: `gpt-4o-mini`

### 5. `chat`
- **Purpose**: AI fitness copilot with user context and tools
- **Input**: JSON with `messages`, optional `userId`, `weightUnit`
- **Output**: Streaming text response
- **Auth**: Optional bearer token
- **Features**: Includes AI tools for fetching user data, workouts, body logs
- **Model**: `gpt-4.1-mini` with streaming

## Prerequisites

### Environment Variables (Supabase Dashboard)

Set these in your Supabase project settings:

```
OPENAI_API_KEY=sk-proj-... (your OpenAI API key)
SUPABASE_URL=https://YOUR_PROJECT.supabase.co (automatically set)
SUPABASE_ANON_KEY=... (automatically set)
SUPABASE_SERVICE_ROLE_KEY=... (automatically set)
```

### Local Development

1. Install Supabase CLI:
```bash
brew install supabase/tap/supabase
```

2. Link your Supabase project:
```bash
supabase link --project-ref YOUR_PROJECT_REF
```

3. Start local environment:
```bash
supabase start
supabase functions serve
```

## Directory Structure

```
supabase/
├── functions/
│   ├── _shared/                          # Shared utilities
│   │   ├── openai.ts                     # OpenAI client factory
│   │   ├── supabase.ts                   # Supabase client factories
│   │   ├── cors.ts                       # CORS helpers
│   │   ├── body-log-analysis.ts          # Body log parsing logic
│   │   ├── body-log-context.ts           # Body log context helpers
│   │   └── multipart.ts                  # Multipart form data parsing
│   │
│   ├── transcribe/
│   │   ├── index.ts                      # Main handler
│   │   └── deno.json                     # Dependencies
│   │
│   ├── parse-workout/
│   │   ├── index.ts                      # Main handler with workout creation
│   │   └── deno.json                     # Dependencies
│   │
│   ├── extract-image/
│   │   ├── index.ts                      # Main handler
│   │   └── deno.json                     # Dependencies
│   │
│   ├── body-log-analyze/
│   │   ├── index.ts                      # Main handler
│   │   └── deno.json                     # Dependencies
│   │
│   └── chat/
│       ├── index.ts                      # Main handler with streaming
│       ├── user-context.ts               # User context builder
│       └── deno.json                     # Dependencies
```

## Deployment Steps

### 1. Deploy Edge Functions

```bash
# From project root
supabase functions deploy transcribe
supabase functions deploy parse-workout
supabase functions deploy extract-image
supabase functions deploy body-log-analyze
supabase functions deploy chat
```

Or deploy all at once:
```bash
supabase functions deploy
```

### 2. Verify Deployment

Check Supabase Dashboard → Edge Functions to confirm all functions are deployed and active.

### 3. Test Edge Functions

```bash
# Test transcribe
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/transcribe \
  -H "Content-Type: multipart/form-data" \
  -F "audio=@test-audio.m4a"

# Test parse-workout
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/parse-workout \
  -H "Content-Type: application/json" \
  -d '{"notes":"Bench press 3x10x185lbs"}'

# Test chat
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -d '{"messages":[{"role":"user","content":"What'\''s my 1RM for squat?"}],"userId":"USER_ID"}'
```

## App Configuration

### API Calls

The app uses `lib/supabase-functions-client.ts` to call edge functions:

```typescript
// For JSON requests
const response = await callSupabaseFunction(
  'parse-workout',
  'POST',
  { notes: text, weightUnit },
  {},
  accessToken
)

// For FormData requests
const response = await callSupabaseFunctionWithFormData(
  'transcribe',
  formData,
  accessToken
)
```

### Updated Files

These files have been updated to use Supabase Edge Functions instead of Expo Server Functions:

- `hooks/useAudioTranscription.ts` - Uses `/transcribe` edge function
- `hooks/useImageTranscription.ts` - Uses `/extract-image` edge function
- `app/body-log/processing.tsx` - Uses `/body-log-analyze` edge function
- `app/(tabs)/create-speech.tsx` - Uses `/transcribe` and `/parse-workout` edge functions
- `app/(tabs)/index.tsx` - Uses `/parse-workout` edge function
- `components/workout-chat.tsx` - Uses `/chat` edge function

## Authentication

### Bearer Token Flow

Most edge functions require a user's authentication token:

1. User logs in via Supabase Auth
2. App gets session token: `session.access_token`
3. Token passed in `Authorization: Bearer <token>` header
4. Edge function validates token and verifies user ownership

### Function-Specific Auth

| Function | Auth Required | Purpose |
|----------|---------------|---------|
| `transcribe` | Optional | Can work without auth |
| `parse-workout` | Optional | Required if `createWorkout: true` |
| `extract-image` | Optional | Can work without auth |
| `body-log-analyze` | Required | Validates user owns the image |
| `chat` | Optional | Needed to fetch user context |

## Environment & Secrets Management

### For Development

Secrets are read from `Deno.env.get()` which respects local `.env.local` files when using `supabase functions serve`.

### For Production

Set secrets in Supabase Dashboard → Project Settings → Secrets:

1. Go to Supabase Dashboard
2. Navigate to Project Settings → Secrets
3. Add `OPENAI_API_KEY` with your OpenAI API key
4. Other variables (SUPABASE_URL, keys) are automatically available

## Error Handling & Logging

All edge functions follow these patterns:

1. **CORS Handling**: Automatic via `handleCors()` helper
2. **Input Validation**: Zod schema validation with detailed error messages
3. **Logging**: Console.error/warn for debugging (visible in Dashboard logs)
4. **Error Responses**: JSON error objects with status codes
5. **Timeout Handling**: Long-running operations have appropriate timeouts

## Monitoring & Debugging

### View Logs

```bash
# View real-time logs
supabase functions logs --follow

# View specific function logs
supabase functions logs transcribe --follow
```

Or in Supabase Dashboard → Edge Functions → Function Logs

### Common Issues

| Issue | Solution |
|-------|----------|
| CORS errors | Ensure `corsHeaders` includes correct origins |
| Timeout errors | Increase timeout or optimize AI model calls |
| OpenAI API errors | Verify `OPENAI_API_KEY` is set correctly |
| Auth errors | Ensure valid bearer token is passed |
| Module not found | Check deno.json imports match URLs |

## Best Practices Implemented

✅ **Distributed at the Edge**: Functions run globally, near users
✅ **Type-Safe**: Full TypeScript with Zod validation
✅ **Secure**: Bearer token validation, CORS protection
✅ **Error Handling**: Comprehensive error messages and logging
✅ **Scalable**: Auto-scaling handled by Deno Deploy
✅ **No Infrastructure**: No servers to manage
✅ **Fast Cold Starts**: Deno's lightweight runtime
✅ **Shared Utilities**: Common logic in `_shared/` directory

## Rollback Plan

If issues occur with edge functions:

1. Keep old Expo Server Functions deployed temporarily
2. Update client code to use old endpoints
3. Investigate edge function logs
4. Redeploy fixed edge functions
5. Switch back to edge functions

## Next Steps

1. Deploy all edge functions to production
2. Monitor logs for 24 hours
3. Run load tests if high traffic expected
4. Update monitoring/alerting if needed
5. Deprecate old Expo Server Functions once stable
