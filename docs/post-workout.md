# Complete Backend Process for Posting a Workout - Uplyft

         ## Overview
         The workout posting process is a sophisticated, multi-stage pipeline that involves frontend validation, cloud function processing with AI
         enrichment, and database persistence with row-level security. The system is designed for reliability with draft auto-save, pending post queuing,
         and placeholder workouts for immediate UI feedback.

         ---

         ## 1. API ENDPOINTS & ENTRY POINTS

         ### Primary Endpoint: POST /functions/v1/parse-workout
         **File**: `/Users/oliver/github/uplyft/supabase/functions/parse-workout/index.ts`
         **Lines**: 94-283 (main entry point)

         **Request Structure** (Zod-validated):
         ```typescript
         {
           notes: string (required)           // Raw workout description
           weightUnit: 'kg' | 'lb' (optional, default: 'kg')
           createWorkout: boolean (optional)  // If true, saves to DB
           userId: string (optional)          // User ID for creation
           workoutTitle: string (optional)    // Custom workout title
           imageUrl: string | null (optional) // URL of attached workout image
         }
         ```

         **Response Structure**:
         ```typescript
         {
           workout: ParsedWorkout              // Structured workout data
           createdWorkout?: WorkoutSessionWithDetails // Full DB record if createWorkout=true
           _metrics?: {
             totalExercises: number
             matchedExercises: number
             createdExercises: number
             totalSets: number
           }
           error?: string
           details?: string
         }
         ```

         **HTTP Method**: POST
         **Authentication**: Bearer token in Authorization header (optional for parsing only, required for creation)
         **Timeout**: 90 seconds (client-side)

         ---

         ## 2. REQUEST & RESPONSE STRUCTURES

         ### Input Request Schema (`requestSchema` - Lines 44-51)
         ```typescript
         interface WorkoutRequest {
           notes: string                      // "Bench Press 135x8, 155x6, 165x4..."
           weightUnit?: 'kg' | 'lb'          // Determines weight unit interpretation
           createWorkout?: boolean            // Flag to persist to database
           userId?: string                    // Required if createWorkout=true
           workoutTitle?: string              // Manual workout title override
           imageUrl?: string | null           // Optional reference image URL
         }
         ```

         ### Parsed Workout Output Schema (`workoutSchema` - Lines 19-42)
         ```typescript
         interface ParsedWorkout {
           isWorkoutRelated: boolean          // AI validation: is this workout content?
           notes?: string                     // User's free-form notes about the workout
           type?: string                      // Inferred workout type (e.g., "Push Day")
           exercises: ParsedExercise[]        // Ordered list of exercises
         }

         interface ParsedExercise {
           name: string                       // "Bench Press", "Squat", etc.
           order_index: number                // Position in workout (0-based)
           notes?: string                     // Exercise-specific notes
           sets: ParsedSet[]                  // Set data for this exercise
           hasRepGaps?: boolean               // Flag if any sets lack rep data
         }

         interface ParsedSet {
           set_number: number                 // Set position (1-based)
           reps: number | null                // Reps (null for warm-ups)
           weight?: number                    // Weight in kg (normalized)
           rpe?: number                       // Rate of Perceived Exertion (1-10)
           notes?: string                     // Set-specific notes
         }
         ```

         ---

         ## 3. DATABASE MODELS & SCHEMA

         ### Core Tables

         **Table: `workout_sessions`**
         ```sql
         id UUID PRIMARY KEY
         user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
         date TIMESTAMPTZ DEFAULT NOW()
         raw_text TEXT                    -- Original user input
         notes TEXT                       -- Parsed workout notes
         type TEXT                        -- Workout type (e.g., "Push Day")
         image_url TEXT                   -- URL to attached image
         created_at TIMESTAMPTZ DEFAULT NOW()

         Indexes:
         - idx_workout_sessions_user_id
         - idx_workout_sessions_date
         ```

         **Table: `exercises`**
         ```sql
         id UUID PRIMARY KEY
         name TEXT UNIQUE
         muscle_group TEXT               -- 'Chest', 'Back', 'Shoulders', etc.
         type TEXT                       -- 'compound' or 'isolation'
         equipment TEXT                  -- 'barbell', 'dumbbell', 'bodyweight', etc.
         created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
         created_at TIMESTAMPTZ
         aliases TEXT[]                  -- Alternative names for fuzzy matching
         embedding VECTOR(1536)          -- OpenAI embedding for similarity search

         Indexes:
         - idx_exercises_name
         - idx_exercises_aliases (GIN)
         - Vector index for embedding search
         ```

         **Table: `workout_exercises`** (Junction table)
         ```sql
         id UUID PRIMARY KEY
         session_id UUID NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE
         exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE
         order_index INTEGER NOT NULL    -- Position in workout (0-based)
         notes TEXT                      -- Exercise-specific notes
         created_at TIMESTAMPTZ

         Indexes:
         - idx_workout_exercises_session_id
         - idx_workout_exercises_exercise_id
         ```

         **Table: `sets`**
         ```sql
         id UUID PRIMARY KEY
         workout_exercise_id UUID NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE
         set_number INTEGER NOT NULL     -- Set position (1-based)
         reps INTEGER                    -- Repetitions (can be NULL for warm-ups)
         weight FLOAT                    -- Weight in kg
         rpe FLOAT                       -- Rate of Perceived Exertion
         notes TEXT                      -- Set-specific notes
         created_at TIMESTAMPTZ

         Index:
         - idx_sets_workout_exercise_id
         ```

         ### Type Definitions
         **File**: `/Users/oliver/github/uplyft/types/database.types.ts`

         ```typescript
         export interface WorkoutSession {
           id: string
           user_id: string
           date: string
           raw_text: string | null
           notes: string | null
           type: string | null
           image_url: string | null
           created_at: string
         }

         export interface Exercise {
           id: string
           name: string
           muscle_group: string | null
           type: string | null
           equipment: string | null
           created_by: string | null
           created_at: string
           aliases?: string[] | null
           embedding?: number[] | null
         }

         export interface WorkoutExercise {
           id: string
           session_id: string
           exercise_id: string
           order_index: number
           notes: string | null
           created_at: string
         }

         export interface Set {
           id: string
           workout_exercise_id: string
           set_number: number
           reps: number | null
           weight: number | null
           rpe: number | null
           notes: string | null
           created_at: string
         }
         ```

         ---

         ## 4. SERVICE/BUSINESS LOGIC - WORKOUT CREATION

         ### Main Creation Flow (Lines 311-460)
         **Function**: `async function createWorkoutSession()`

         **Process Steps**:

         1. **Session Creation** (Lines 318-330)
            - Insert into `workout_sessions` with user_id, raw_text, notes, type
            - Returns: session ID and metadata

         2. **Exercise Resolution** (Lines 336-355)
            - Parse exercise names from parsed workout
            - Call `resolveExercisesWithAgent()` for AI-powered matching
            - Returns: Map of exercise names to exercise IDs (matched or created)

         3. **Workout Exercise Insertion** (Lines 357-380)
            - Create records linking session → exercises
            - Preserve order_index from parsed data
            - Attach exercise-specific notes

         4. **Set Insertion** (Lines 382-442)
            - Normalize numeric data (reps, weight, RPE)
            - Insert all sets for all exercises in batch
            - Handle null values for warm-up sets

         5. **Metrics Calculation** (Lines 448-459)
            - Count matched vs. created exercises
            - Count total sets created
            - Return metrics for analytics

         ### Database Operations Module
         **File**: `/Users/oliver/github/uplyft/lib/database.ts`

         #### `database.workoutSessions.create()` (Lines 335-418)

         **Algorithm**:
         1. Validate exercises array structure
         2. Get or create each exercise (using AI metadata if new)
         3. Map parsed exercises to Exercise records
         4. Batch insert workout_exercises
         5. Batch insert sets with normalization
         6. Return created session

         **Error Handling**:
         - Throws on invalid exercise data
         - Throws on database constraints
         - Unique constraint violations handled at exercise level

         ---

         ## 5. VALIDATION, TRANSFORMATION, & PROCESSING STEPS

         ### A. AI Parsing (Lines 113-196)
         **Tool**: OpenAI GPT-4.1-mini via `generateObject()`

         **Validation & Transformation**:
         1. **Content Validation** (Lines 121-126)
            - Checks `isWorkoutRelated` flag
            - Rejects non-fitness content

         2. **Exercises Array Validation** (Lines 128-138)
            - Validates array structure
            - Requires at least 1 exercise
            - Throws on invalid format

         3. **Data Normalization** (Lines 172-196)
            ```typescript
            - Reps: Must be valid number >= 1, otherwise null
            - Weight: Normalized to kg based on user's weightUnit preference
            - RPE: Converted to number, null if invalid
            - Sets: Preserved in original order with normalized data
            ```

         4. **Weight Conversion** (Lines 74-87)
            ```typescript
            function normalizeWeightToKg(weight: unknown, sourceUnit: 'kg' | 'lb'): number | null

            If sourceUnit === 'lb':
              return weight / 2.20462 (KG_TO_LB constant)
            ```

         ### B. Exercise Resolution with AI Agent (Lines 468-725)
         **Function**: `async function resolveExercisesWithAgent()`

         **Process**:
         1. **Initial Search** (Lines 239-266)
            - Try trigram-based search first (SQL function: `match_exercises_trgm`)
            - Uses exercise names + aliases with GIN index
            - Similarity threshold: 0.35

         2. **Vector Search Fallback** (Lines 269-294)
            - If trigram similarity < 0.5, fall back to embeddings
            - Compute query embedding: OpenAI text-embedding-3-small
            - Call SQL function: `match_exercises()`
            - Returns top matches by cosine similarity

         3. **AI Agent Loop** (Lines 521-706)
            - System: Fitness expert database assistant
            - Tools: `searchExercises`, `createExercise`
            - Agent iterates until all exercises resolved
            - Max iterations: 20 (safety limit)

         4. **Resolution Parsing** (Lines 627-666)
            - Parse agent's final response with regex
            - Extract format: `N. [name] -> [uuid] (matched|created)`
            - Track wasCreated flag for metrics

         5. **Fallback Search** (Lines 669-704)
            - For any unresolved exercises, attempt:
              - Direct search with >= 0.5 similarity threshold
              - If no match found, create as new exercise
            - Ensures all exercises are resolved

         ### C. Exercise Matching & Creation (Lines 192-316, `/tools.ts`)
         **Function**: `handleSearchExercises()`

         **Search Strategy**:
         1. **Trigram Search** (SQL function: `match_exercises_trgm`)
            - Fast string similarity on name + aliases
            - Uses PostgreSQL trigram extension
            - Returns best_similarity score

         2. **Vector Search** (SQL function: `match_exercises()`)
            - Semantic similarity via embeddings
            - Query embedding: OpenAI text-embedding-3-small (1536-dim)
            - Cosine similarity computation

         3. **Candidate Deduplication** (Lines 202-220)
            - Merge results from both search methods
            - Keep highest similarity score for each exercise
            - Sort by similarity descending

         **Function**: `handleCreateExercise()` (Lines 318-410, `/tools.ts`)

         **Validation**:
         ```typescript
         - Name must be 1-100 characters
         - Name trimmed of whitespace
         - XSS prevention: rejects <script>, javascript:, on* patterns
         - Unique constraint: only creates if not already in DB
         ```

         **Metadata Inference**:
         - AI-generated via `generateExerciseMetadata()`
         - Infers: muscle_group, type (compound/isolation), equipment
         - Based on exercise name analysis

         ### D. Numeric Normalization (Lines 382-435)
         **In `createWorkoutSession()`**:

         ```typescript
         For each set:
           reps = Number.isFinite(parsed_reps) && parsed_reps >= 1 ? parsed_reps : null
           weight = Number.isFinite(parsed_weight) ? parsed_weight : null
           rpe = Number.isFinite(parsed_rpe) ? parsed_rpe : null
         ```

         Handles:
         - String-to-number conversion (e.g., "8" → 8)
         - Regex cleaning: removes non-numeric chars except "." and "-"
         - NaN/Infinity rejection
         - Null propagation for missing data

         ---

         ## 6. AUTHENTICATION & AUTHORIZATION

         ### A. API-Level Authorization (Lines 199-216)
         **File**: `/Users/oliver/github/uplyft/supabase/functions/parse-workout/index.ts`

         ```typescript
         // Extract bearer token from request headers
         const bearer = req.headers.get('Authorization')
         const accessToken = bearer?.startsWith('Bearer ')
           ? bearer.slice('Bearer '.length).trim()
           : undefined

         // Create user client with token
         const supabase = createUserClient(accessToken)

         // Verify user exists and is authorized
         const { data: profile, error: profileError } = await supabase
           .from('profiles')
           .select('id')
           .eq('id', payload.userId)
           .single()

         if (profileError || !profile) {
           return errorResponse(401, 'Unauthorized')
         }
         ```

         **Clients Used**:
         - `createUserClient(accessToken)`: Limited access using user's token
         - `createServiceClient()`: Service role for AI processing (tool calls)

         ### B. Row-Level Security (RLS) Policies
         **File**: `/Users/oliver/github/uplyft/supabase/migrations/20251003120100_initial_schema.sql`
         **Lines**: 78-204

         **Policies Enforced**:

         1. **workout_sessions**
            - SELECT: `auth.uid() = user_id` (users can only view their own)
            - INSERT: `auth.uid() = user_id` (users can only create their own)
            - UPDATE: `auth.uid() = user_id` (users can only update their own)
            - DELETE: `auth.uid() = user_id` (users can only delete their own)

         2. **workout_exercises**
            - SELECT/INSERT/UPDATE/DELETE: via subquery check
            ```sql
            EXISTS (
              SELECT 1 FROM workout_sessions
              WHERE workout_sessions.id = workout_exercises.session_id
              AND workout_sessions.user_id = auth.uid()
            )
            ```

         3. **sets**
            - SELECT/INSERT/UPDATE/DELETE: via nested join check
            ```sql
            EXISTS (
              SELECT 1 FROM workout_exercises
              JOIN workout_sessions ON workout_sessions.id = workout_exercises.session_id
              WHERE workout_exercises.id = sets.workout_exercise_id
              AND workout_sessions.user_id = auth.uid()
            )
            ```

         4. **exercises**
            - SELECT: public (all users can view)
            - INSERT/UPDATE/DELETE: Only user who created can modify
            ```sql
            auth.uid() = created_by
            ```

         ---

         ## 7. ERROR HANDLING

         ### A. Parse-Workout Endpoint Error Handling (Lines 261-282)

         **Zod Validation Errors**:
         ```typescript
         if (error instanceof z.ZodError) {
           return errorResponse(400, 'Invalid request', error.errors)
         }
         ```

         **AI Refusal Errors**:
         ```typescript
         if (error?.cause?.refusal) {
           return errorResponse(
             400,
             'AI refused to process this content for safety reasons'
           )
         }
         ```

         **Content Validation Errors**:
         - Not workout-related: HTTP 400
         - No exercises detected: HTTP 400
         - Invalid exercises format: HTTP 500

         **Database Creation Errors** (Lines 250-257):
         ```typescript
         try {
           const { session, metrics } = await createWorkoutSession(...)
         } catch (dbError) {
           return jsonResponse({
             workout: finalWorkout,
             error: 'Workout parsed but failed to save to database',
             details: dbError.message
           })
         }
         ```

         ### B. Database Operation Error Handling
         **File**: `/Users/oliver/github/uplyft/lib/database.ts`

         **General Pattern**:
         ```typescript
         const { data, error } = await supabase.from('table').operation()
         if (error) throw error
         return data
         ```

         **Specific Handling**:

         1. **Exercise Creation** (Lines 271-330)
            - Name validation with security checks
            - Duplicate detection via unique constraint
            - AI metadata generation fallback

         2. **Workout Session Creation** (Lines 335-418)
            - Validate exercises array structure
            - Throws if exercises not array
            - Batch operations catch and rethrow

         ### C. Frontend Error Handling
         **File**: `/Users/oliver/github/uplyft/app/(tabs)/index.tsx`
         **Lines**: 142-295 (`handlePendingPost`)

         **Network Errors**:
         - HTTP 500: Generic parse failure
         - Timeout (AbortError): Suggests retry with slow connection message

         **Data Errors**:
         ```typescript
         if (!response.ok) {
           const errorData = await response.json().catch(() => ({}))
           const errorMessage = errorData.error || 'Failed to parse workout'

           // Restore draft for retry
           await AsyncStorage.setItem(DRAFT_KEY, notes)

           Alert.alert('Unable to Parse Workout', errorMessage, [
             { text: 'Edit & Try Again', onPress: () => router.push('/(tabs)/create-post') }
           ])
         }
         ```

         **Database Errors**:
         ```typescript
         if (data.error) {
           throw new Error(data.details || data.error)
         }
         ```

         ---

         ## 8. STORAGE & PERSISTENCE LOGIC

         ### A. Workout Image Upload
         **File**: `/Users/oliver/github/uplyft/lib/utils/image-upload.ts`

         **Function**: `uploadWorkoutImage(uri: string, userId: string)`

         **Process**:
         1. Fetch image from local URI to ArrayBuffer
         2. Create unique filename: `{userId}-{timestamp}.{ext}`
         3. Upload to Supabase Storage bucket: `workout-images`
         4. Return public URL via `getPublicUrl()`

         **Error Handling**:
         - Fetch fails: throws descriptive error
         - Upload fails: throws Supabase error
         - Called with context-aware messaging (user can continue without image)

         ### B. Database Persistence
         **Operation**: Batch inserts for performance

         **Transaction-like Behavior** (not true ACID transactions):
         1. Insert `workout_sessions` (1 record)
         2. Get/Create exercises via AI agent (N records)
         3. Insert `workout_exercises` (N records)
         4. Insert `sets` (M records)

         **Failure Points**:
         - Session creation fails → abort
         - Exercise resolution fails → abort
         - Workout exercise insert fails → abort (session remains)
         - Set insert fails → abort (exercises remain orphaned)

         **Cleanup**:
         - RLS policies + cascading deletes ensure orphaned records cleaned up
         - User cannot query orphaned sessions (RLS policy)

         ### C. Draft Auto-Save (Frontend)
         **File**: `/Users/oliver/github/uplyft/app/(tabs)/create-post.tsx`
         **Lines**: 374-428

         **Draft Storage Keys**:
         ```typescript
         const DRAFT_KEY = '@workout_draft'              // Main workout notes
         const TITLE_DRAFT_KEY = '@workout_title_draft'  // Workout title
         const PENDING_POST_KEY = '@pending_workout_post' // Data awaiting parsing
         const PLACEHOLDER_WORKOUT_KEY = '@placeholder_workout' // Optimistic UI
         ```

         **Auto-Save Debouncing**:
         ```typescript
         // Notes: 2500ms debounce after user stops typing
         // Title: 1200ms debounce after user stops typing
         ```

         **Pending Post Queue**:
         - Saves to `@pending_workout_post` when user taps submit
         - Feed checks on focus via `handlePendingPost()`
         - Creates placeholder workout for immediate feedback
         - Morph animation: placeholder → real workout

         ---

         ## 9. COMPLETE REQUEST-TO-PERSISTENCE FLOW

         ### Frontend Initiation (create-post.tsx)
         ```
         User taps "Post" button
           ↓
         Validation (title, notes, user auth)
           ↓
         Upload image if attached → get URL
           ↓
         Save to @pending_workout_post (AsyncStorage)
           ↓
         Save placeholder to @placeholder_workout
           ↓
         Navigate to feed
           ↓
         Show success overlay
         ```

         ### Feed Processing (index.tsx - handlePendingPost)
         ```
         Feed loads
           ↓
         Check for @pending_workout_post
           ↓
         Call parse-workout endpoint (90s timeout)
           ↓
         Wait for AI parsing + DB creation
           ↓
         Replace placeholder with real workout
           ↓
         Clear @pending_workout_post, drafts
         ```

         ### API Processing (parse-workout endpoint)
         ```
         Receive request {notes, weightUnit, userId, ...}
           ↓
         Validate input (Zod schema)
           ↓
         Authorize user via token + profile check
           ↓
         AI parsing with GPT-4.1-mini
           ↓
         Validate parsed structure
           ↓
         Generate workout title if needed
           ↓
         If createWorkout=true:
           ├─ Create workout_session
           ├─ Resolve exercises via agent
           ├─ Insert workout_exercises
           ├─ Insert sets (batch)
           └─ Return complete workout object
           ↓
         Return JSON response
         ```

         ### Database Operations (database.ts)
         ```
         Insert workout_session
           ↓
         For each exercise:
           ├─ Search with trigram + vector methods
           ├─ Match to existing OR create new
           └─ Store in exerciseMap
           ↓
         Insert workout_exercises (batch)
           ↓
         Insert sets (batch, normalized)
           ↓
         RLS policies enforce user_id access
         ```

         ---

         ## 10. KEY INTEGRATION POINTS

         ### A. Supabase Edge Functions
         - **URL**: `{SUPABASE_URL}/functions/v1/parse-workout`
         - **Authentication**: Bearer token (user auth) + service role (internal)
         - **Timeout**: 90 seconds (AbortController client-side)
         - **Environment Variables**:
           - `SUPABASE_URL`
           - `SUPABASE_SERVICE_ROLE_KEY`
           - `SUPABASE_ANON_KEY`
           - `OPENAI_API_KEY`

         ### B. AI Services
         - **Parser**: OpenAI GPT-4.1-mini (`generateObject`)
         - **Title Generation**: OpenAI GPT-4.1-nano
         - **Exercise Search**: OpenAI text-embedding-3-small (semantic search)
         - **Metadata Inference**: Exercise metadata generation (AI-based)

         ### C. Database Features
         - **Vector Search**: `match_exercises()` SQL function with embeddings
         - **Trigram Search**: `match_exercises_trgm()` SQL function with GIN index
         - **Cascading Deletes**: workout_exercises/sets cascade when session deleted
         - **RLS Policies**: Enforce user ownership at database level

         ### D. Storage
         - **Bucket**: `workout-images`
         - **Access**: Public URLs via `getPublicUrl()`
         - **Cleanup**: Manual deletion via `deleteWorkoutImage()`

         ---

         ## 11. IMPORTANT BUSINESS LOGIC

         ### Exercise Resolution Strategy
         The system uses a multi-pronged approach:
         1. **Trigram matching** for fast exact/near-exact matches
         2. **Vector embeddings** for semantic similarity
         3. **AI agent** to reason about ambiguous cases
         4. **Fallback creation** if no good match found

         This ensures exercises are always resolved (matched or created) while minimizing spurious duplicates.

         ### Weight Unit Handling
         - Client specifies unit preference: 'kg' or 'lb'
         - AI parser interprets weights in that unit
         - Normalization converts all to kg for database storage
         - Frontend displays in user's preferred unit

         ### Set Data Flexibility
         - Reps can be null (warm-up sets, distance running)
         - Weight can be null (bodyweight exercises)
         - RPE can be null (not mentioned by user)
         - System stores all nulls correctly and queries handle gracefully

         ### Placeholder Workout Pattern
         - Immediate visual feedback while backend processes
         - Stored in AsyncStorage + displayed in feed
         - Animated morph when real workout arrives from server
         - Provides perceived performance improvement

         ---

         ## 12. METRICS & OBSERVABILITY

         **Console Logging**:
         ```typescript
         [Agent] Starting exercise resolution for N exercises
         [Agent] Resolved N exercises (M created, K matched)
         [Tool: searchExercises] query="...", similarity=0.XX
         [Tool: createExercise] name="..."
         [Workout Parser] Metrics: {...}
         ```

         **Returned Metrics**:
         ```typescript
         {
           totalExercises: number,
           matchedExercises: number,
           createdExercises: number,
           totalSets: number
         }
         ```

         **Error Tracking**:
         - All errors logged to console
         - Error messages passed to frontend
         - User can see specific failure reason
         - Drafts auto-restored on failure

         ---

         ## Summary

         The Uplyft workout posting system is a sophisticated, multi-layer architecture:

         1. **Frontend** validates, uploads images, queues pending posts, shows placeholders
         2. **API** authenticates users, parses workouts with AI, resolves exercises via agent
         3. **Database** persists structured data with RLS policies and cascading deletes
         4. **Storage** manages workout images with public URLs
         5. **AI** handles parsing, matching, and metadata inference

         The system prioritizes:
         - **Reliability**: Draft auto-save, pending queue, error recovery
         - **Performance**: Batch operations, vector search, placeholder UI
         - **Security**: RLS policies, XSS prevention, token validation
         - **User Experience**: Immediate feedback, graceful degradation, clear errors

         ---

         ## Refactor Snapshot (Nov 2025)
         - Edge function now delegates to modular files in `supabase/functions/parse-workout/` (`schemas.ts`, `parser.ts`, `auth.ts`, `persistence.ts`, `resolver/agent.ts`, `errors.ts`, `metrics.ts`, `transform.ts`, `constants.ts`, `deps.ts`).
         - HTTP handling lives in `handler.ts`; `index.ts` simply calls `serve(handleRequest)`.
         - Response and error payloads include a `correlationId` plus structured error codes (`ZOD_INVALID`, `CONTENT_REFUSED`, `PARSE_FAILED`, `DB_FAILED`, `UNAUTHORIZED`, `UNKNOWN`).
         - Frontend submission flow lives in `hooks/useSubmitWorkout.ts` with typed API access under `lib/api/post-workout.ts` and storage helpers in `lib/utils/workout-draft.ts`.
         - `app/(tabs)/create-post.tsx` and `app/(tabs)/index.tsx` consume the hook/utilities for queuing, drafts, and pending-post processing, eliminating direct AsyncStorage key juggling.
