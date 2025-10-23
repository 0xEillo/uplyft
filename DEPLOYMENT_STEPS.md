# Supabase Edge Functions Deployment Steps

Follow these steps to deploy your edge functions to production.

## Prerequisites

1. **Supabase CLI installed**
   ```bash
   brew install supabase/tap/supabase
   ```

2. **Docker running** (optional, for local testing)
   ```bash
   # On Mac with Docker Desktop
   open -a Docker
   ```

3. **Supabase project created**
   - Go to https://database.new to create a new project if you don't have one

## Step 1: Verify Local Project Setup

Your project already has the `supabase` directory with all functions. Verify the structure:

```bash
ls -la supabase/functions/
# Should show: _shared, body-log-analyze, chat, extract-image, parse-workout, transcribe
```

## Step 2: Login to Supabase CLI

Authenticate with Supabase (this opens a browser window):

```bash
supabase login
```

Follow the browser prompts to authenticate and return to the terminal.

## Step 3: Get Your Project ID

List your Supabase projects:

```bash
supabase projects list
```

Copy your project ID from the output. It looks like: `abcdefghijklmnop`

## Step 4: Link Your Local Project

Connect your local project to your remote Supabase project:

```bash
supabase link --project-ref YOUR_PROJECT_ID
```

Replace `YOUR_PROJECT_ID` with your actual project ID from Step 3.

Verify the link:
```bash
supabase status
```

You should see your project details and credentials.

## Step 5: Set Up Environment Secrets

You need to set the `OPENAI_API_KEY` in your Supabase project.

### Option A: Using Supabase Dashboard (Recommended)

1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to **Settings** → **Secrets**
4. Click **New secret**
5. Add:
   - **Name**: `OPENAI_API_KEY`
   - **Value**: Your OpenAI API key (from https://platform.openai.com/api-keys)
6. Click **Save**

### Option B: Using CLI

```bash
supabase secrets set OPENAI_API_KEY=YOUR_OPENAI_API_KEY
```

Replace `YOUR_OPENAI_API_KEY` with your actual OpenAI API key.

Verify secrets are set:
```bash
supabase secrets list
```

## Step 6: Test Locally (Optional but Recommended)

### Start Local Services

```bash
# Start Supabase services
supabase start

# In a new terminal, serve functions
supabase functions serve
```

### Test a Function

```bash
# Test transcribe (requires an audio file)
curl -X POST http://localhost:54321/functions/v1/transcribe \
  -H "Content-Type: multipart/form-data" \
  -F "audio=@path/to/test-audio.m4a"

# Test parse-workout
curl -X POST http://localhost:54321/functions/v1/parse-workout \
  -H "Content-Type: application/json" \
  -d '{"notes":"Bench press 3x10x185lbs"}'

# Test chat
LOCAL_ANON_KEY=$(supabase status | grep "anon key" | awk '{print $NF}')
curl -X POST http://localhost:54321/functions/v1/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LOCAL_ANON_KEY" \
  -d '{"messages":[{"role":"user","content":"Hello"}]}'
```

Stop local services when done:
```bash
supabase stop
```

## Step 7: Deploy All Functions to Production

Deploy all your edge functions to Supabase's global network:

```bash
supabase functions deploy
```

This will deploy:
- `transcribe`
- `parse-workout`
- `extract-image`
- `body-log-analyze`
- `chat`

The deployment output will show:
```
✓ Function "transcribe" deployed with ID: abc123def456
✓ Function "parse-workout" deployed with ID: ghi789jkl012
✓ Function "extract-image" deployed with ID: mno345pqr678
✓ Function "body-log-analyze" deployed with ID: stu901vwx234
✓ Function "chat" deployed with ID: yz5678abc901
```

If deployment fails, try with API deployment:
```bash
supabase functions deploy --use-api
```

## Step 8: Get Your Production URLs

Your functions are now deployed at:

```
https://YOUR_PROJECT_ID.supabase.co/functions/v1/transcribe
https://YOUR_PROJECT_ID.supabase.co/functions/v1/parse-workout
https://YOUR_PROJECT_ID.supabase.co/functions/v1/extract-image
https://YOUR_PROJECT_ID.supabase.co/functions/v1/body-log-analyze
https://YOUR_PROJECT_ID.supabase.co/functions/v1/chat
```

Get your project ID:
```bash
supabase status | grep "project_id"
```

## Step 9: Get Your Anon Key

You'll need this for testing from the app:

```bash
supabase status | grep "anon key"
```

Or find it in Supabase Dashboard → Settings → API → anon (public)

## Step 10: Test Your Production Functions

Test that functions are live and working:

```bash
# Test parse-workout (simple, no auth needed)
curl -X POST 'https://YOUR_PROJECT_ID.supabase.co/functions/v1/parse-workout' \
  -H 'Content-Type: application/json' \
  -d '{"notes":"Squat 3x5x225lbs"}'

# Test chat (requires auth)
curl -X POST 'https://YOUR_PROJECT_ID.supabase.co/functions/v1/chat' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -d '{"messages":[{"role":"user","content":"Hi"}]}'
```

## Step 11: Build and Test Your App

Now build your app with the edge functions properly configured:

```bash
# Clean build
npm run build
# or
npm run prebuild

# Start local dev server (if using Expo)
npx expo start
```

The app will automatically call the Supabase edge functions because it uses `getSupabaseFunctionBaseUrl()` from `lib/supabase-functions-client.ts`.

## Step 12: Test in Development Build

### For iOS TestFlight:

```bash
eas build --platform ios --profile production
```

Then upload to TestFlight and test:
1. Try voice logging (should call `/transcribe` and `/parse-workout`)
2. Try body scanning (should call `/body-log-analyze`)
3. Try chat (should call `/chat`)
4. Try image extraction (should call `/extract-image`)

### For Android Internal Sharing:

```bash
eas build --platform android --profile production
```

## Troubleshooting

### Function Not Found (404)

**Solution**: Verify the function is deployed:
```bash
supabase functions list
```

Re-deploy if missing:
```bash
supabase functions deploy FUNCTION_NAME
```

### OpenAI API Key Error

**Solution**: Verify the secret is set:
```bash
supabase secrets list
```

If missing, set it:
```bash
supabase secrets set OPENAI_API_KEY=YOUR_KEY
```

### CORS Errors

**Solution**: All functions have CORS headers configured. If you see CORS errors:
1. Check that requests include proper headers
2. Verify the origin is correct
3. Check function logs in Supabase Dashboard

### Timeout Errors

**Solution**: Edge functions have a timeout limit. If functions timeout:
1. Check Supabase Dashboard → Edge Functions → Logs
2. Optimize the function (reduce API calls, etc.)
3. For long operations, consider breaking into smaller functions

### Cold Start Performance

**Solution**: Supabase Edge Functions have fast cold starts. If performance is an issue:
1. Monitor Supabase Dashboard → Metrics
2. Consider caching frequently used data
3. Reduce dependencies per function

## View Logs

Monitor your deployed functions:

```bash
# View live logs
supabase functions logs --follow

# View specific function logs
supabase functions logs transcribe --follow

# View logs from Supabase Dashboard
# Project → Edge Functions → Select Function → Logs
```

## Monitoring

Track performance and errors in Supabase Dashboard:

1. **Edge Functions** → View each function's status
2. **Metrics** → Monitor invocations and performance
3. **Logs** → Debug any issues

## What's Next?

1. ✅ Functions deployed
2. ✅ Secrets configured
3. ✅ App pointing to edge functions
4. ✅ TestFlight build working
5. ⏭️ Monitor production usage
6. ⏭️ Optimize functions based on logs
7. ⏭️ Scale if needed (Supabase handles auto-scaling)

## Rollback Plan

If you need to revert to Expo Server Functions:

1. Keep old Expo Server Functions code
2. Update `lib/supabase-functions-client.ts` to point to old endpoints
3. Rebuild and redeploy app
4. Edge functions remain deployed but unused (can delete later)

---

**Project ID**: (get from `supabase status`)
**Anon Key**: (get from Supabase Dashboard → Settings → API)
**OPENAI_API_KEY**: Set in Supabase Secrets
