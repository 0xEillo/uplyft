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
