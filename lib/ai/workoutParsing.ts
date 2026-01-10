import { exerciseLookup } from '@/lib/services/exerciseLookup'

export interface ParsedWorkoutDisplay {
  description: string
  title: string
  duration: string
  exercises: {
    name: string
    gifUrl?: string | null
    sets: {
      type: 'warmup' | 'working'
      weight: string
      reps: string
      rest: number
    }[]
  }[]
}

// Get icon for exercise - always return barbell as requested
export function getExerciseIcon(_: string): 'barbell-outline' {
  return 'barbell-outline'
}

// Parse workout from AI response text for display. Strips any weight suggestions.
export function parseWorkoutForDisplay(
  text: string,
): ParsedWorkoutDisplay | null {
  try {
    // Try parsing as JSON first
    const jsonMatch =
      text.match(/```json\s*([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/)

    if (jsonMatch) {
      const jsonStr = jsonMatch[1] || jsonMatch[0]
      type ParsedExercise = {
        name: string
        sets: { type?: string; reps?: string; restSeconds?: number; rest?: number }[]
      }
      type ParsedData = {
        description?: string
        title?: string
        estimatedDuration?: number
        exercises?: ParsedExercise[]
      }
      let data: ParsedData
      try {
        data = JSON.parse(jsonStr)
      } catch {
        return null
      }

      if (data && data.exercises && Array.isArray(data.exercises)) {
        return {
          description: data.description || '',
          title: data.title || 'Generated Workout',
          duration: data.estimatedDuration
            ? `${data.estimatedDuration}:00`
            : '45:00',
          exercises: data.exercises.map((ex) => {
            // Use the exerciseLookup service to find exact match by name
            const match = exerciseLookup.findByName(ex.name)
            return {
              name: ex.name,
              gifUrl: match?.gifUrl ?? null,
              sets: ex.sets.map((s) => ({
                type: (s.type === 'warmup' ? 'warmup' : 'working') as 'warmup' | 'working',
                weight: '', // Strip weight suggestions
                reps: s.reps || '',
                rest: s.restSeconds || s.rest || 60,
              })),
            }
          }),
        }
      }
    }

    // No valid JSON found - we assume this is just text content
    return null
  } catch (error) {
    console.error('Error parsing workout:', error)
    return null
  }
}
