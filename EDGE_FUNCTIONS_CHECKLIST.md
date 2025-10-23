# Edge Functions Deployment Checklist

Use this checklist to verify everything is ready for deployment.

## Pre-Deployment Checks

### 1. Environment & Setup
- [ ] Supabase CLI installed (`supabase --version`)
- [ ] Docker running (for local testing)
- [ ] Logged in to Supabase (`supabase status` shows project)
- [ ] Project linked (`supabase link --project-ref YOUR_PROJECT_ID`)
- [ ] OpenAI API key available from https://platform.openai.com/api-keys

### 2. Edge Functions Structure
- [ ] All functions exist in `supabase/functions/`:
  - [ ] `transcribe/index.ts` ✓
  - [ ] `parse-workout/index.ts` ✓
  - [ ] `extract-image/index.ts` ✓
  - [ ] `body-log-analyze/index.ts` ✓
  - [ ] `chat/index.ts` ✓
- [ ] All functions have `deno.json`:
  - [ ] `transcribe/deno.json` ✓
  - [ ] `parse-workout/deno.json` ✓
  - [ ] `extract-image/deno.json` ✓
  - [ ] `body-log-analyze/deno.json` ✓
  - [ ] `chat/deno.json` ✓
- [ ] Shared utilities in `_shared/`:
  - [ ] `openai.ts` ✓
  - [ ] `supabase.ts` ✓
  - [ ] `cors.ts` ✓
  - [ ] `body-log-analysis.ts` ✓
  - [ ] `body-log-context.ts` ✓

### 3. Function Implementation Quality
- [ ] All functions use `serve()` from Deno std
- [ ] All functions handle CORS with `handleCors()`
- [ ] All functions validate input with Zod
- [ ] All functions have proper error handling
- [ ] All functions log important events (console.log/error)
- [ ] All functions return proper JSON responses

### 4. Client Code Updates
- [ ] `lib/supabase-functions-client.ts` created ✓
- [ ] `hooks/useAudioTranscription.ts` updated ✓
- [ ] `hooks/useImageTranscription.ts` updated ✓
- [ ] `app/body-log/processing.tsx` updated ✓
- [ ] `app/(tabs)/create-speech.tsx` updated ✓
- [ ] `app/(tabs)/index.tsx` updated ✓
- [ ] `components/workout-chat.tsx` updated ✓

### 5. Configuration
- [ ] `EXPO_PUBLIC_SUPABASE_URL` set in `.env`
- [ ] `EXPO_PUBLIC_SUPABASE_KEY` set in `.env`
- [ ] `.env` is in `.gitignore` (for security)

## Local Testing (Optional)

### 1. Start Services
```bash
supabase start
# In new terminal:
supabase functions serve
```
- [ ] Services start without errors
- [ ] Functions serve at http://localhost:54321/functions/v1/

### 2. Test Each Function
```bash
# Get anon key
LOCAL_KEY=$(supabase status | grep "anon key" | awk '{print $NF}')

# Test transcribe (need audio file)
curl -X POST http://localhost:54321/functions/v1/transcribe \
  -H "Authorization: Bearer $LOCAL_KEY" \
  -F "audio=@test-audio.m4a"
- [ ] Returns 200 with `{"text": "..."}`

# Test parse-workout
curl -X POST http://localhost:54321/functions/v1/parse-workout \
  -H "Content-Type: application/json" \
  -d '{"notes":"Bench 3x10x185lbs"}'
- [ ] Returns 200 with parsed workout

# Test extract-image (need image file)
curl -X POST http://localhost:54321/functions/v1/extract-image \
  -H "Authorization: Bearer $LOCAL_KEY" \
  -F "image=@workout-photo.jpg"
- [ ] Returns 200 with extracted content

# Test body-log-analyze (need image ID in database)
curl -X POST http://localhost:54321/functions/v1/body-log-analyze \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LOCAL_KEY" \
  -d '{"imageId":"test-id"}'
- [ ] Returns 200 or proper error (401 for bad auth is expected)

# Test chat
curl -X POST http://localhost:54321/functions/v1/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LOCAL_KEY" \
  -d '{"messages":[{"role":"user","content":"Hi"}]}'
- [ ] Returns 200 with streaming response
```

### 3. Stop Services
```bash
supabase stop
```
- [ ] Services stop gracefully

## Production Deployment

### 1. Set Secrets in Supabase
Go to Supabase Dashboard → Project Settings → Secrets

- [ ] `OPENAI_API_KEY` set to your OpenAI API key
  - Can verify with: `supabase secrets list`

### 2. Deploy Functions
```bash
supabase functions deploy
```
- [ ] All 5 functions deploy successfully
- [ ] No errors in deployment output
- [ ] Can see functions in Supabase Dashboard → Edge Functions

### 3. Verify Deployment
```bash
# Get your project ID
PROJECT_ID=$(supabase status | grep "project_id" | awk '{print $NF}')

# Get anon key
ANON_KEY=$(supabase status | grep "anon key" | awk '{print $NF}')

# Test a simple function
curl -X POST "https://$PROJECT_ID.supabase.co/functions/v1/parse-workout" \
  -H "Content-Type: application/json" \
  -d '{"notes":"Squat 3x5x225lbs"}'
```
- [ ] Returns 200 with parsed workout
- [ ] No CORS errors
- [ ] Response time acceptable (usually < 2 seconds for first call)

## App Integration Testing

### 1. Build App
```bash
npm run build
# or
npm run prebuild
```
- [ ] Build completes without errors
- [ ] No TypeScript errors
- [ ] App runs on local dev server

### 2. Test in Development
```bash
npx expo start
# Scan QR code with Expo Go app
```
- [ ] App opens without crashing
- [ ] Can navigate to features
- [ ] No API errors in console

### 3. Test Each AI Feature

**Voice Logging**
- [ ] Record audio ✓
- [ ] App calls `/transcribe` edge function ✓
- [ ] Audio is transcribed correctly ✓
- [ ] App calls `/parse-workout` edge function ✓
- [ ] Workout is parsed correctly ✓
- [ ] Workout is saved to database ✓

**Body Scanning**
- [ ] Take photo ✓
- [ ] Photo uploads to Supabase Storage ✓
- [ ] App calls `/body-log-analyze` edge function ✓
- [ ] Metrics are extracted (weight, body fat, etc.) ✓
- [ ] Metrics are saved to database ✓
- [ ] Results display correctly ✓

**Image Text Extraction**
- [ ] Take/select photo with workout notes ✓
- [ ] App calls `/extract-image` edge function ✓
- [ ] Text is extracted from image ✓
- [ ] Extracted text appears in notes ✓

**AI Chat**
- [ ] Open chat ✓
- [ ] Send message ✓
- [ ] App calls `/chat` edge function ✓
- [ ] Response streams and displays ✓
- [ ] Chat tools work (fetching user data, workouts, etc.) ✓

### 4. Test in TestFlight/Production Build

**iOS TestFlight**
```bash
eas build --platform ios --profile production
```
- [ ] Build completes
- [ ] Upload to TestFlight
- [ ] Install on test device
- [ ] Test all features (voice, body scan, chat, extraction)
- [ ] No crashes
- [ ] API calls work from real device (not just simulator)

**Android Internal Sharing**
```bash
eas build --platform android --profile production
```
- [ ] Build completes
- [ ] Install on test device
- [ ] Test all features
- [ ] No crashes
- [ ] API calls work

## Performance & Monitoring

### 1. Check Function Performance
Supabase Dashboard → Edge Functions → Metrics
- [ ] Invocation count looks reasonable
- [ ] Average response time < 2s for first call
- [ ] Average response time < 500ms for cached calls
- [ ] No unusual error rates

### 2. Review Logs
Supabase Dashboard → Edge Functions → Logs
- [ ] No persistent errors
- [ ] No timeout issues
- [ ] OpenAI API calls are working
- [ ] Database queries are working

### 3. Monitor Usage
- [ ] OpenAI API usage within budget
- [ ] Supabase Storage usage reasonable
- [ ] Database queries performing well

## Post-Deployment

### 1. Document Deployment
- [ ] Note the deployment date
- [ ] Document any issues and solutions
- [ ] Update team on the new setup

### 2. Monitor for 24 Hours
- [ ] Check logs regularly
- [ ] Monitor performance metrics
- [ ] Verify no regressions in app

### 3. Clean Up (Optional)
- [ ] Remove old Expo Server Functions if confident
- [ ] Archive or delete development functions
- [ ] Clean up any test data

## Success Criteria

All of the following must be true:

✅ **All 5 edge functions deployed to production**
✅ **OpenAI API key configured as secret**
✅ **App successfully calls all edge functions**
✅ **Voice logging works end-to-end**
✅ **Body scanning works end-to-end**
✅ **Chat works with streaming**
✅ **Image extraction works**
✅ **TestFlight build works**
✅ **No CORS errors**
✅ **No authentication errors**
✅ **Response times acceptable**
✅ **No persistent errors in logs**

---

## Emergency Rollback

If something goes critically wrong:

1. Revert app code to use old Expo Server Functions
2. Keep old servers running temporarily
3. Investigate edge function logs
4. Fix the issue
5. Redeploy edge functions
6. Test again

Edge functions can remain deployed but unused during this process.

---

**Status**: Ready for deployment ✓
**Last Updated**: [DATE]
**Deployed By**: [YOUR NAME]
**Deployment Date**: [DATE]
