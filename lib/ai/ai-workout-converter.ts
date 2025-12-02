import { getSupabaseFunctionBaseUrl } from '@/lib/supabase-functions-client'

export interface AiWorkoutConversionResult {
  title: string
  description?: string
  exercises: {
    name: string
    sets: {
      reps: string
      weight: string
      repsMin?: number
      repsMax?: number
    }[]
  }[]
}

export interface AiRoutineConversionResult {
  title: string
  description?: string
  exercises: {
    name: string
    sets: {
      repsMin?: number
      repsMax?: number
      reps?: string
    }[]
  }[]
}

interface ConvertAiPlanParams {
  text: string
  userId?: string
  weightUnit: 'kg' | 'lb'
  token?: string
}

/**
 * Extract JSON from AI response, handling various formats:
 * - Plain JSON
 * - Markdown code blocks (```json ... ```)
 * - Text before/after JSON
 */
function extractJsonFromResponse(text: string): string {
  // Try to find JSON in markdown code block first
  const codeBlockMatch = text.match(/```(?:json|typescript)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim()
  }

  // Try to find raw JSON object
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    return jsonMatch[0].trim()
  }

  // Fallback: clean up common markdown artifacts
  return text.replace(/```json/g, '').replace(/```/g, '').trim()
}

/**
 * Validate workout data structure
 */
function validateWorkoutData(data: unknown): AiWorkoutConversionResult {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid workout data: not an object')
  }

  const workout = data as Record<string, unknown>

  // Validate title
  if (typeof workout.title !== 'string' || !workout.title.trim()) {
    throw new Error('Invalid workout data: missing or empty title')
  }

  // Validate exercises array
  if (!Array.isArray(workout.exercises)) {
    throw new Error('Invalid workout data: exercises must be an array')
  }

  if (workout.exercises.length === 0) {
    throw new Error('Invalid workout data: no exercises found')
  }

  // Validate each exercise
  const validatedExercises = workout.exercises.map((ex: unknown, index: number) => {
    if (!ex || typeof ex !== 'object') {
      throw new Error(`Invalid exercise at index ${index}: not an object`)
    }

    const exercise = ex as Record<string, unknown>

    if (typeof exercise.name !== 'string' || !exercise.name.trim()) {
      throw new Error(`Invalid exercise at index ${index}: missing or empty name`)
    }

    if (!Array.isArray(exercise.sets)) {
      throw new Error(`Invalid exercise "${exercise.name}": sets must be an array`)
    }

    if (exercise.sets.length === 0) {
      throw new Error(`Invalid exercise "${exercise.name}": no sets found`)
    }

    const validatedSets = exercise.sets.map((s: unknown, setIndex: number) => {
      if (!s || typeof s !== 'object') {
        throw new Error(`Invalid set at index ${setIndex} for "${exercise.name}"`)
      }

      const set = s as Record<string, unknown>

      return {
        reps: typeof set.reps === 'string' ? set.reps : String(set.reps ?? ''),
        weight: typeof set.weight === 'string' ? set.weight : String(set.weight ?? ''),
        repsMin: typeof set.repsMin === 'number' ? set.repsMin : undefined,
        repsMax: typeof set.repsMax === 'number' ? set.repsMax : undefined,
      }
    })

    return {
      name: exercise.name.trim(),
      sets: validatedSets,
    }
  })

  return {
    title: workout.title.trim(),
    description: typeof workout.description === 'string' ? workout.description : undefined,
    exercises: validatedExercises,
  }
}

/**
 * Validate routine data structure
 */
function validateRoutineData(data: unknown): AiRoutineConversionResult {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid routine data: not an object')
  }

  const routine = data as Record<string, unknown>

  // Validate title
  if (typeof routine.title !== 'string' || !routine.title.trim()) {
    throw new Error('Invalid routine data: missing or empty title')
  }

  // Validate exercises array
  if (!Array.isArray(routine.exercises)) {
    throw new Error('Invalid routine data: exercises must be an array')
  }

  if (routine.exercises.length === 0) {
    throw new Error('Invalid routine data: no exercises found')
  }

  // Validate each exercise
  const validatedExercises = routine.exercises.map((ex: unknown, index: number) => {
    if (!ex || typeof ex !== 'object') {
      throw new Error(`Invalid exercise at index ${index}: not an object`)
    }

    const exercise = ex as Record<string, unknown>

    if (typeof exercise.name !== 'string' || !exercise.name.trim()) {
      throw new Error(`Invalid exercise at index ${index}: missing or empty name`)
    }

    if (!Array.isArray(exercise.sets)) {
      throw new Error(`Invalid exercise "${exercise.name}": sets must be an array`)
    }

    if (exercise.sets.length === 0) {
      throw new Error(`Invalid exercise "${exercise.name}": no sets found`)
    }

    const validatedSets = exercise.sets.map((s: unknown, setIndex: number) => {
      if (!s || typeof s !== 'object') {
        throw new Error(`Invalid set at index ${setIndex} for "${exercise.name}"`)
      }

      const set = s as Record<string, unknown>

      return {
        repsMin: typeof set.repsMin === 'number' ? set.repsMin : undefined,
        repsMax: typeof set.repsMax === 'number' ? set.repsMax : undefined,
        reps: typeof set.reps === 'string' ? set.reps : undefined,
      }
    })

    return {
      name: exercise.name.trim(),
      sets: validatedSets,
    }
  })

  return {
    title: routine.title.trim(),
    description: typeof routine.description === 'string' ? routine.description : undefined,
    exercises: validatedExercises,
  }
}

export async function convertAiPlanToWorkout({
  text,
  userId,
  weightUnit,
  token,
}: ConvertAiPlanParams): Promise<AiWorkoutConversionResult> {
  // System prompt to convert text to JSON
  const conversionPrompt = `
      Extract the workout details from the following text and format it as a JSON object.
      The JSON should have this structure:
      {
        "title": "Workout Title",
        "description": "A brief summary of the workout focus (max 2 sentences).",
        "exercises": [
          {
            "name": "Exercise Name",
            "sets": [
              { 
                "reps": "10", 
                "weight": "",
                "repsMin": 8,
                "repsMax": 12
              } 
            ]
          }
        ]
      }
      
      Rules:
      1. Extract the workout title if present, otherwise generate a short descriptive title.
      2. Generate a brief description/summary of the workout.
      3. For each exercise, extract the name.
      4. For sets:
         - If a range is given (e.g. "8-12 reps"), set "repsMin" to 8, "repsMax" to 12, and "reps" to empty string.
         - If a single number is given (e.g. "10 reps"), set "reps" to "10" and leave min/max null.
         - If "to failure" or "AMRAP", set "reps" to "AMRAP".
      5. Leave "weight" empty unless specifically mentioned.
      6. If multiple sets are implied (e.g. "3 sets of 10"), create 3 set objects in the array.
      7. Return ONLY the JSON object, no markdown formatting or other text.
      
      Text to process:
      ${text}
      `

  const requestBody = {
    messages: [{ role: 'user', content: conversionPrompt }],
    userId,
    weightUnit,
  }

  const response = await fetch(`${getSupabaseFunctionBaseUrl()}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-no-stream': '1',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    throw new Error('Failed to process workout data')
  }

  const jsonText = await response.text()

  // Extract JSON from response (handles markdown blocks, text before/after, etc.)
  const cleanJson = extractJsonFromResponse(jsonText)

  try {
    const rawData = JSON.parse(cleanJson)
    // Validate and normalize the data structure
    return validateWorkoutData(rawData)
  } catch (error) {
    console.error('Failed to parse AI response as JSON:', cleanJson)
    if (error instanceof Error && error.message.startsWith('Invalid workout')) {
      throw error
    }
    throw new Error('Failed to parse workout data')
  }
}

export async function convertAiPlanToRoutine({
  text,
  userId,
  weightUnit,
  token,
}: ConvertAiPlanParams): Promise<AiRoutineConversionResult> {
  // System prompt to convert text to JSON
  const conversionPrompt = `
      Extract the routine details from the following text and format it as a JSON object.
      This is for a reusable routine template, so ignore specific weights unless strictly relevant.
      
      The JSON should have this structure:
      {
        "title": "Routine Title",
        "description": "A brief description of the routine (max 2 sentences).",
        "exercises": [
          {
            "name": "Exercise Name",
            "sets": [
              { 
                "repsMin": 8,
                "repsMax": 12,
                "reps": ""
              } 
            ]
          }
        ]
      }
      
      Rules:
      1. Extract the routine title if present, otherwise generate a short descriptive title.
      2. Generate a brief description/summary of the routine.
      3. For each exercise, extract the name.
      4. For sets:
         - If a range is given (e.g. "8-12 reps"), set "repsMin" to 8, "repsMax" to 12.
         - If a single number is given, use it for both min/max or as a target.
         - Ignore weights (routines are templates).
      5. If multiple sets are implied (e.g. "3 sets of 10"), create 3 set objects in the array.
      6. Return ONLY the JSON object, no markdown formatting or other text.
      
      Text to process:
      ${text}
      `

  const requestBody = {
    messages: [{ role: 'user', content: conversionPrompt }],
    userId,
    weightUnit,
  }

  const response = await fetch(`${getSupabaseFunctionBaseUrl()}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-no-stream': '1',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    throw new Error('Failed to process routine data')
  }

  const jsonText = await response.text()

  // Extract JSON from response (handles markdown blocks, text before/after, etc.)
  const cleanJson = extractJsonFromResponse(jsonText)

  try {
    const rawData = JSON.parse(cleanJson)
    // Validate and normalize the data structure
    return validateRoutineData(rawData)
  } catch (error) {
    console.error('Failed to parse AI response as JSON:', cleanJson)
    if (error instanceof Error && error.message.startsWith('Invalid routine')) {
      throw error
    }
    throw new Error('Failed to parse routine data')
  }
}
