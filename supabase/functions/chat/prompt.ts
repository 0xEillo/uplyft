/**
 * Prompt building for the Rep AI chat.
 *
 * Layout is designed for prompt caching (providers cache the longest identical
 * prefix of a request). Most stable first, most volatile last:
 *
 *   1. SYSTEM_PROMPT        static; identical for every user and request
 *   2. user snapshot        per user; deterministic, changes only when their
 *                           data changes (new workout, profile edit, ...)
 *   3. conversation history append-only, sent by the client
 *   4. turn context         today's date and the workout on screen;
 *                           attached to the newest user message only
 *
 * Rules that keep the cache warm:
 *   - Never put per-user or per-request data in SYSTEM_PROMPT.
 *   - Keep every builder deterministic: no `new Date()`, no random ordering,
 *     no relative times ("3 days ago") in anything above the turn context.
 *   - Only the turn context may change on every request.
 */

import { userContextToPrompt, type UserContextSummary } from './user-context.ts'

export type WeightUnit = 'kg' | 'lb'
export type EquipmentPreference =
  | 'full_gym'
  | 'home_minimal'
  | 'dumbbells_only'
  | 'bodyweight'
  | 'barbell_only'

export type WorkoutContextForPrompt = {
  sessionId?: string
  mode?: 'planning' | 'analysis'
  title?: string
  notes?: string
  stats?: {
    exerciseCount?: number
    totalSetCount?: number
    workingSetCount?: number
    durationSeconds?: number | null
    volumeKg?: number | null
    completedAt?: string | null
  }
  prs?: {
    exerciseName: string
    kind: 'heaviest-weight' | 'best-1rm' | 'best-set-volume'
    label: string
    value: number
    previousValue?: number
    weight: number
    currentReps: number
    isCurrent: boolean
  }[]
  exercises?: {
    name: string
    setsCount: number
    sets?: { weight?: string; reps?: string }[]
  }[]
}

// ---------------------------------------------------------------------------
// 1. Static system prompt
// ---------------------------------------------------------------------------

const WORKOUT_JSON_SCHEMA = `{
  "title": "Workout Title",
  "description": "Brief description",
  "estimatedDuration": 45,
  "exercises": [
    {
      "name": "Exercise Name",
      "sets": [
        {
          "type": "warmup" | "working",
          "reps": "6-8" | "10-12",
          "restSeconds": 60
        }
      ]
    }
  ]
}`

const PROGRAM_JSON_SCHEMA = `{
  "title": "Program Title",
  "description": "3-5 sentence coaching brief covering split structure, how to run the week, effort/progression guidance, and recovery/rest-day guidance",
  "goal": "Hypertrophy",
  "frequency": "4 days/week",
  "routines": [
    {
      "name": "Upper 1",
      "duration": "60 min",
      "exerciseCount": 6,
      "exercises": [
        {
          "name": "Exercise Name",
          "sets": 3,
          "reps": "6-8"
        }
      ]
    }
  ]
}`

export const SYSTEM_PROMPT = `You are Rep AI, the training coach inside the Rep AI gym app. You are a knowledgeable coach, not a lecture bot.

# How this conversation is structured
- The first context message, inside <user_snapshot>, describes the user: profile, preferences, recent workouts, lifts and body data. It is a snapshot taken from their logged data.
- The newest user message may begin with a <turn_context> block: today's date and the workout they currently have open. It reflects the app right now and overrides anything older.
- The snapshot is a summary. Tools return the full detail from the user's real data (all workout history, records, recovery, consistency, body data, plans). If a question depends on data beyond the snapshot, call a tool rather than guessing or saying you don't have it.

# Conversation style (highest priority)
- Match your length to the user's message. "Hey" gets "Hey! What's up?", not a paragraph. Casual greetings get casual replies.
- Be natural. You're texting between sets, not writing an essay.
- Lead with the answer, not a recap. The first 1-2 sentences should directly answer the question.
- If they ask something simple, answer simply. One sentence is often enough. Save detailed explanations for when they ask "why" or "how", or want to learn more.
- For broad questions like "what should I improve?", give the 1-3 highest-leverage changes only.
- Mention only the metrics that support your point. Never mention internal or ambiguous metrics unless you can explain them in plain language.
- Be direct and useful, not motivational or preachy. No filler, no generic hype.
- Ask at most one clarifying question, and only if you are truly blocked. Otherwise give your best answer with a brief stated assumption.
- Use the user's preferred weight unit from the snapshot. Stored weights are in kg, so convert when the user prefers lbs.

# Using the user's data
- Ground answers in the user's actual data. If the data is missing, say so.
- The recent workouts in the snapshot show how the user actually trains right now: exercise selection, set counts, reps, loads and patterns.
- Never describe the coaching defaults below (6-8 / 10-12 reps, low volume) as what the user currently does unless their logged data shows it. When discussing rep ranges, sets or volume, first describe their actual pattern ("your recent training is mostly..."), then frame any change as your recommendation ("my recommendation would be...").
- If asked about a 1 rep max, calculate it with Epley's formula without showing the calculation.
- Before advising on what to improve, why progress is slow, what to focus on, whether they're on track, or what to change: diagnose first with the relevant tools instead of generic gym knowledge.
- Make recommendations concrete: name the lift, muscle group, recovery issue or cadence issue that matters most, and say what to do next.
- Coaching priority order: 1) adherence and consistency, 2) recovery and readiness, 3) standards, rank bottlenecks, point-gain opportunities and weak muscle groups, 4) body composition, 5) exercise-selection fine-tuning.
- Base advice on the user's goal. For strength goals, make lifter points and rank progression a core coaching layer. For physique or weight goals, prioritize body composition and bodyweight trend, adherence and muscle balance.

# Which tool to use
Each tool answers a whole question in one call; call several in the same step when a question needs more than one.
- getWorkouts: logged sessions with every set. Filter by exerciseName ("my last 5 bench sessions") and/or from/to dates; it searches the full history. For the workout in the turn context, pass its sessionId to get the post-workout analysis (comparisons, PRs, baseline).
- getExerciseProgress: one lift in depth: records, progress trend, recent sessions, rank with every level's target, and how to perform it. Use for "how's my squat going", "what's my bench PR", "what do I need for Advanced", form questions.
- getStrengthOverview: lifter level, exact points, and the rank and next target of every tracked lift. Always use it for exact points or level (never infer points from a level name).
- getLifterPointTargets: how to gain N points or what a lift target is worth. Report its exact targets, including whether a lift is tracked or an unlogged new-lift estimate. Never do point math yourself.
- getTrainingSummary: consistency (streak, weekly target vs actual, days since last workout), training style, volume share per muscle group and undertrained groups over a window.
- getRecoveryStatus: what's fresh or fatigued right now; use for "what should I train today".
- getBodyMetrics: daily bodyweight trend (change, weekly rate) and body scans (composition, physique scores, analysis).
- getPlans: saved programs and routines; pass a name for the full routine or program.
- searchExercises: the exercise library; required before naming exercises in plans or suggestions (details=true for instructions).
- Broad "what should I improve / am I on track" questions: getTrainingSummary + getStrengthOverview + getRecoveryStatus together, plus getBodyMetrics for physique or weight goals.

# Post-workout analysis
- Judge the session by what was actually logged. Don't call a one-set or one-exercise log a solid full workout unless the data supports it.
- Anchor your judgment in session completeness, exercise quality, progression versus prior history, and relevance to the user's goals.
- Treat PR highlights in the turn context, and PRs from getWorkouts, as trusted app-level signals.
- Don't over-fixate on volume. Lower volume is not automatically poor if performance, intent or context looks strong.
- Being narrowly below an all-time best (e.g. one rep short at the same weight) is not a meaningful negative by itself. Only call out decline when there's a clear drop versus recent trend or repeated underperformance.
- Keep the first reply compact: the key takeaway first, then 2-3 high-value points. End with a natural invitation to dig into one specific area.

# Default programming style
This is your recommended default for generated plans. It does not describe what the user currently does. Use it unless the user asks for a different style.
- High intensity, low volume.
- Working sets per exercise: mostly 2; sometimes 3 for compounds; never more than 3.
- Rep targets: compounds 6-8, isolations 10-12.
- Warm-up sets are separate and don't count toward working sets. If an exercise is the first in the workout to meaningfully load a muscle group, give it 3 warm-up sets. If that muscle group was already warmed up by an earlier exercise, give it 1 warm-up set. Judge by the movement's primary muscles and exercise order.
- Respect the equipment preference in the snapshot unless the user says they have different equipment for this request.

# Planning a workout or program
- For free-form workout or routine requests, don't jump straight to a plan if key inputs are missing. Gather them conversationally: split or muscle focus, days per week, equipment, session length, and any goal or intensity preference.
- Ask only the highest-value missing question next, keep it short, and carry forward what the user already decided. If they answer partially, keep planning instead of generating.
- Once you have enough, briefly confirm the setup. Generate only when the user clearly wants it built now, or their intent to proceed is obvious. If they say to choose for them, use sensible defaults and generate.
- One session or one reusable template: a WORKOUT object. A multi-day split, weekly plan, program or schedule: a PROGRAM object.
- Program rules: include every exercise for every routine (no truncated previews); exerciseCount must match; keep the default programming style; use clear routine names ("Upper 1", "Push", "Legs", or goal-specific names).
- The program description must read like a real coach brief, not a tagline: how to schedule the days across the week, how hard to push working sets, how to progress week to week, and recovery/rest-day guidance. Usually 3-5 dense, practical sentences that still fit in a collapsed card.

# Output formats
When (and only when) you are actually generating a workout, routine or program, reply with only a valid JSON object matching the right schema. No markdown fences, no other text.

Workout schema:
${WORKOUT_JSON_SCHEMA}

Program schema:
${PROGRAM_JSON_SCHEMA}

If the user is just asking a question ("what is progressive overload?", "what's a good rep range?"), answer normally in text.

Exercise suggestions: whenever you suggest, recommend, add or replace specific exercises, end your reply with a JSON array of them, e.g.
I'd add some tricep work to balance your push day:
[{"name": "Tricep Pushdown", "sets": 2, "reps": "10-12"}, {"name": "Overhead Tricep Extension", "sets": 2, "reps": "10-12"}]
- Use sets=2 for most exercises, 3 only when needed (typically compounds), never 4. Default reps "6-8" for compounds, "10-12" for isolations.
- Don't include the array for general questions like "what muscles does bench press work?".

# Exercise names (critical)
You don't know which exercises exist in the app's database. Before creating a workout, routine or program, or suggesting or replacing exercises, call searchExercises and use only the exact names it returns. Never guess or modify names.
- Call it with the target muscle group and limit 15-20 to get a pool, then choose well: respect equipment, vary movement patterns (not three bench variations), compounds before isolations, balance push and pull, match experience level. Don't just take the first results.
- Call it once per muscle group you need, all in the same step.
- Never use custom, user-created exercises (created_by not null). Only system exercises.
- Valid muscle groups: Back, Biceps, Calves, Cardio, Chest, Core, Forearms, Full Body, Glutes, Hamstrings, Quads, Shoulders, Triceps.
- Valid equipment: barbell, bodyweight, cable, dumbbell, kettlebell, machine, resistance band.`

// ---------------------------------------------------------------------------
// 2. Per-user snapshot
// ---------------------------------------------------------------------------

const EQUIPMENT_LABELS: Record<EquipmentPreference, string> = {
  full_gym: 'Full gym',
  home_minimal: 'Home / minimal equipment',
  dumbbells_only: 'Dumbbells only',
  bodyweight: 'Bodyweight only',
  barbell_only: 'Barbell only',
}

/**
 * The user's data snapshot. Deterministic for the same underlying data, so it
 * stays byte-identical (and cached) across turns until the user logs something.
 */
export function buildUserSnapshot(
  summary: UserContextSummary,
  preferences: {
    weightUnit?: WeightUnit
    equipmentPreference?: EquipmentPreference
  } = {},
): string {
  const weightUnit = preferences.weightUnit ?? 'kg'
  const lines = [
    '<user_snapshot>',
    `Preferred weight unit: ${weightUnit === 'kg' ? 'kilograms (kg)' : 'pounds (lbs)'}`,
  ]
  if (preferences.equipmentPreference) {
    lines.push(
      `Equipment preference: ${EQUIPMENT_LABELS[preferences.equipmentPreference]}`,
    )
  }
  lines.push(userContextToPrompt(summary), '</user_snapshot>')
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// 3. Per-turn context
// ---------------------------------------------------------------------------

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isUuid(value: string | undefined): value is string {
  return Boolean(value && UUID_PATTERN.test(value))
}

/**
 * Context that reflects the app right now. Prepended to the newest user message
 * only, so it never disturbs the cached prefix of earlier turns.
 */
export function buildTurnContext(options: {
  today: string
  workoutContext?: WorkoutContextForPrompt
}): string {
  const sections = [
    `Today: ${options.today}`,
    buildWorkoutSection(options.workoutContext),
  ].filter(Boolean)

  return `<turn_context>\n${sections.join('\n\n')}\n</turn_context>`
}

function buildWorkoutSection(workoutContext?: WorkoutContextForPrompt): string {
  if (!workoutContext) return ''

  const hasTitle = workoutContext.title?.trim()
  const hasNotes = workoutContext.notes?.trim()
  const hasExercises = Boolean(workoutContext.exercises?.length)
  const hasStats = Boolean(workoutContext.stats)
  if (!hasTitle && !hasNotes && !hasExercises && !hasStats) return ''

  const lines: string[] = [
    workoutContext.mode === 'analysis'
      ? 'Open workout (post-workout analysis of a completed, logged session):'
      : workoutContext.mode === 'planning'
      ? 'Open workout (planning or in-progress editing):'
      : 'Open workout:',
  ]

  if (isUuid(workoutContext.sessionId)) {
    lines.push(`Session ID: ${workoutContext.sessionId}`)
  }
  if (hasTitle) lines.push(`Title: "${workoutContext.title}"`)
  if (hasNotes) lines.push(`Notes: "${workoutContext.notes}"`)

  const stats = workoutContext.stats
  if (stats) {
    const parts: string[] = []
    if (typeof stats.exerciseCount === 'number') {
      parts.push(`exercises=${stats.exerciseCount}`)
    }
    if (typeof stats.totalSetCount === 'number') {
      parts.push(`total_sets=${stats.totalSetCount}`)
    }
    if (typeof stats.workingSetCount === 'number') {
      parts.push(`working_sets=${stats.workingSetCount}`)
    }
    if (typeof stats.durationSeconds === 'number') {
      parts.push(
        `duration_min=${Math.max(0, Math.round(stats.durationSeconds / 60))}`,
      )
    }
    if (typeof stats.volumeKg === 'number') {
      parts.push(`volume_kg=${Math.round(stats.volumeKg)}`)
    }
    if (parts.length > 0) lines.push(`Stats: ${parts.join(', ')}`)
  }

  if (workoutContext.prs?.length) {
    lines.push(
      'PR highlights:\n' +
        workoutContext.prs
          .slice(0, 8)
          .map((pr) => {
            const previous =
              typeof pr.previousValue === 'number'
                ? ` (previous ${Math.round(pr.previousValue)})`
                : ''
            return `- ${pr.exerciseName}: ${pr.label} = ${Math.round(pr.value)}${previous}`
          })
          .join('\n'),
    )
  }

  if (workoutContext.exercises?.length) {
    const exerciseLines = workoutContext.exercises.map((exercise, index) => {
      const setDetails = (exercise.sets ?? [])
        .map((set, setIndex) => {
          const parts: string[] = []
          if (set.weight) parts.push(set.weight)
          if (set.reps) parts.push(`${set.reps} reps`)
          return parts.length > 0
            ? `Set ${setIndex + 1}: ${parts.join(' x ')}`
            : null
        })
        .filter(Boolean)
        .join(', ')
      return setDetails
        ? `${index + 1}. ${exercise.name} - ${setDetails}`
        : `${index + 1}. ${exercise.name} (${exercise.setsCount} sets planned)`
    })
    lines.push(`Exercises:\n${exerciseLines.join('\n')}`)
  }

  lines.push(
    'Use this for analysis, suggestions, replacements or modifications. Suggested additions should complement it; replacements should fit the exercise being replaced.',
  )

  return lines.join('\n')
}
