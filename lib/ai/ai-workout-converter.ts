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

  // Clean up response if it contains markdown code blocks
  const cleanJson = jsonText.replace(/```json/g, '').replace(/```/g, '').trim()

  try {
    const workoutData = JSON.parse(cleanJson)
    return workoutData as AiWorkoutConversionResult
  } catch (error) {
    console.error('Failed to parse AI response as JSON:', cleanJson)
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

  // Clean up response if it contains markdown code blocks
  const cleanJson = jsonText.replace(/```json/g, '').replace(/```/g, '').trim()

  try {
    const routineData = JSON.parse(cleanJson)
    return routineData as AiRoutineConversionResult
  } catch (error) {
    console.error('Failed to parse AI response as JSON:', cleanJson)
    throw new Error('Failed to parse routine data')
  }
}
