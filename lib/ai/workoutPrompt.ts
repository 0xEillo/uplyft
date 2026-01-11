import { WorkoutPlanningData } from '@/components/workout-planning-wizard'

// Shared JSON schema without weight suggestions
export const WORKOUT_JSON_SCHEMA = `{
  "title": "Workout Title",
  "description": "Brief description",
  "estimatedDuration": 45,
  "exercises": [
    {
      "name": "Exercise Name",
      "sets": [
        {
          "type": "warmup" | "working",
          "reps": "12" | "8-10",
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
