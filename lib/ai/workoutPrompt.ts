import { WorkoutPlanningData } from '@/components/workout-planning-wizard'

// Shared JSON schema without weight suggestions
export const WORKOUT_JSON_SCHEMA = `{
  "title": "Workout Title",
  "description": "2-3 sentence coaching summary that explains the workout focus, how to execute, and briefly why these exercises fit the user's goal/request",
  "estimatedDuration": 60,
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

export const PROGRAM_JSON_SCHEMA = `{
  "title": "Program Title",
  "description": "3-5 sentence coaching brief that explains the split, how to run the week, effort/progression guidance, recovery/rest-day guidance, and why the structure fits the user's goal/request",
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

const CREATION_PROMPT_TEMPLATE = ({
  goal,
  muscles,
  duration,
  equipmentLabel,
  specifics,
  trainingGuidelines,
}: {
  goal: string
  muscles: string
  duration: string
  equipmentLabel: string
  specifics?: string | null
  trainingGuidelines?: string
}) => `Create a reusable workout routine (a single workout template the user can save and reuse).
Focus/Goal: ${goal}
Muscle Groups: ${muscles}
Target Duration: ${duration}
Equipment Available: ${equipmentLabel}
Custom Specifications: ${specifics || 'None'}

${trainingGuidelines || ''}

DESCRIPTION REQUIREMENTS:
- Keep the "description" field to 2-3 sentences max.
- Briefly explain why the workout matches the user's goal, requested muscles, available equipment, or time constraint.
- Make the rationale feel personalized to this request, but do not invent personal history or metrics.

WARM-UP RULES:
- Warm-up sets are separate from working sets and should appear first in the exercise's "sets" array.
- If an exercise is the first movement in the workout that meaningfully trains or loads a muscle group that has not been warmed up yet, include 3 warm-up sets.
- If that muscle group has already been warmed up earlier in the workout by a previous exercise, include just 1 warm-up set.
- Base this on whether the movement's primary muscles have already been trained or warmed up earlier in the session.

IMPORTANT: You must output ONLY a JSON object with the following structure:
${WORKOUT_JSON_SCHEMA}
Do not wrap in markdown code blocks. Do not add intro/outro text. Just the JSON.`

export function buildWorkoutCreationPrompt(
  wizardData: WorkoutPlanningData,
  equipmentLabel: string,
  trainingGuidelines?: string,
) {
  return CREATION_PROMPT_TEMPLATE({
    goal: wizardData.goal,
    muscles: wizardData.muscles,
    duration: wizardData.duration,
    equipmentLabel,
    specifics: wizardData.specifics,
    trainingGuidelines,
  })
}

export function buildWorkoutModificationSuffix() {
  return `

IMPORTANT: If this request involves modifying the workout plan, you MUST output the COMPLETE updated workout plan as a single JSON object. Do not just describe the changes. The response must be valid JSON to be rendered correctly.

Use this structure:
${WORKOUT_JSON_SCHEMA}`
}

export function buildProgramModificationSuffix() {
  return `

IMPORTANT: If this request involves modifying the training program, you MUST output the COMPLETE updated program as a single JSON object. Do not just describe the changes. The response must be valid JSON to be rendered correctly.

Use this structure:
${PROGRAM_JSON_SCHEMA}`
}

export function buildWorkoutAnalysisPrompt(input?: {
  workoutTitle?: string | null
  exerciseCount?: number
  totalSetCount?: number
  workingSetCount?: number
  durationSeconds?: number | null
}) {
  const normalizedTitle = input?.workoutTitle?.trim()
  const exerciseCount = input?.exerciseCount
  const totalSetCount = input?.totalSetCount
  const workingSetCount = input?.workingSetCount
  const durationSeconds = input?.durationSeconds
  const durationMinutes =
    typeof durationSeconds === 'number' && Number.isFinite(durationSeconds)
      ? Math.max(0, Math.round(durationSeconds / 60))
      : null

  return [
    normalizedTitle
      ? `Analyze the workout I just completed: "${normalizedTitle}".`
      : 'Analyze the workout I just completed.',
    'Use this workout context plus my real app data only.',
    'This is a post-workout analysis request, not a planning request.',
    'First judge whether this was a complete session, a partial session, or just a quick log/check-in.',
    exerciseCount != null
      ? `The workout context currently shows ${exerciseCount} exercise${exerciseCount === 1 ? '' : 's'}.`
      : null,
    totalSetCount != null
      ? `It contains ${totalSetCount} total logged set${totalSetCount === 1 ? '' : 's'}.`
      : null,
    workingSetCount != null
      ? `It contains ${workingSetCount} working set${workingSetCount === 1 ? '' : 's'}.`
      : null,
    durationMinutes != null
      ? `Recorded duration is about ${durationMinutes} minute${durationMinutes === 1 ? '' : 's'}.`
      : null,
    'Compare the key exercises in this session to my recent history when relevant.',
    'Use the exact session first, then use real history/tools for context.',
    'Take into account things like PRs hit, recovery/readiness for the muscles trained, consistency, and how this session compares to my recent average when that information is available.',
    'Judge performance with coach logic, not spreadsheet logic.',
    'Do not over-fixate on volume alone if the performance quality was strong.',
    'Do not treat being slightly below an all-time best, like one rep short at the same load, as a clear negative by itself.',
    'Only call performance regression a problem when there is a meaningful drop or a repeated downward trend across recent exposures.',
    'If this workout has fewer than 2 exercises or fewer than 3 working sets, treat it as partial unless the data clearly shows otherwise.',
    'Do not call a one-set or one-exercise workout a solid full session.',
    'Let the score emerge from the actual session quality, completeness, progression, and context.',
    'Keep the initial reply short, simple, and high-signal.',
    'Do not write long paragraphs.',
    'Give the user the key overview first, then leave obvious room for follow-up questions.',
    'Prioritize the single most important positive and the single most important issue.',
    'Only include exercise-specific comparisons if they are genuinely useful.',
    'Structure the initial reply exactly like this:',
    'Workout Score: X/10',
    'Overview: 1-2 short sentences max.',
    'Top Win: 1 short bullet.',
    'Main Fix: 1 short bullet.',
    'Next Step: 1 short bullet.',
    'Finish with 1 short line that opens the door to follow-up, like offering more detail on technique, progression, or next-session planning.',
    'Do not guess. If data is missing, say so plainly.',
  ]
    .filter(Boolean)
    .join('\n')
}

export function isWorkoutRequest(text: string) {
  const lowerText = text.toLowerCase()

  const creationKeywords = [
    'create',
    'make',
    'generate',
    'give',
    'build',
    'design',
    'plan',
    'suggest',
    'need',
    'want',
  ]

  const workoutKeywords = [
    'workout',
    'routine',
    'program',
    'split',
    'schedule',
    'exercises',
  ]

  const workoutTypes = [
    'push',
    'pull',
    'legs',
    'upper',
    'lower',
    'full body',
    'bro split',
    'chest',
    'back',
    'arm',
    'leg',
    'shoulder',
    'abs',
    'glute',
  ]

  const hasCreation = creationKeywords.some((k) => lowerText.includes(k))
  const hasWorkout = workoutKeywords.some((k) => lowerText.includes(k))
  const hasType = workoutTypes.some((k) => lowerText.includes(k))

  if (hasCreation && (hasWorkout || hasType)) return true
  if (hasType && (hasWorkout || lowerText.includes('day'))) return true

  return false
}
