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

export interface ParsedProgramDisplay {
  title: string
  description: string
  goal?: string
  frequency?: string
  routines: ParsedWorkoutDisplay[]
}

// Get icon for exercise - always return barbell as requested
export function getExerciseIcon(_: string): 'barbell-outline' {
  return 'barbell-outline'
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  try {
    const jsonMatch =
      text.match(/```json\s*([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/)

    if (!jsonMatch) return null
    const jsonStr = jsonMatch[1] || jsonMatch[0]
    const parsed = JSON.parse(jsonStr) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null
    }
    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}

function toPositiveNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.round(value)
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.round(parsed)
    }
  }
  return null
}

// Parse workout from AI response text for display. Strips any weight suggestions.
export function parseWorkoutForDisplay(
  text: string,
): ParsedWorkoutDisplay | null {
  try {
    const data = extractJsonObject(text)
    if (!data || !Array.isArray(data.exercises)) {
      return null
    }

    // Program payloads use routines/workouts/days — never show as a single workout card
    if (
      Array.isArray(data.routines) ||
      Array.isArray(data.workouts) ||
      Array.isArray(data.days)
    ) {
      return null
    }

    type ParsedExercise = {
      name: string
      sets: { type?: string; reps?: string; restSeconds?: number; rest?: number }[]
    }

    const exercises = (data.exercises as ParsedExercise[])
      .filter(
        (exercise) =>
          exercise &&
          typeof exercise.name === 'string' &&
          exercise.name.trim().length > 0 &&
          Array.isArray(exercise.sets),
      )
      .map((exercise) => {
        const match = exerciseLookup.findByName(exercise.name)
        return {
          name: exercise.name,
          gifUrl: match?.gifUrl ?? null,
          sets: exercise.sets.map((set) => ({
            type: (set.type === 'warmup' ? 'warmup' : 'working') as
              | 'warmup'
              | 'working',
            weight: '',
            reps: set.reps || '',
            rest: set.restSeconds || set.rest || 60,
          })),
        }
      })

    if (exercises.length === 0) {
      return null
    }

    return {
      description:
        typeof data.description === 'string' ? data.description : '',
      title: typeof data.title === 'string' ? data.title : 'Generated Workout',
      duration:
        typeof data.estimatedDuration === 'number' &&
        Number.isFinite(data.estimatedDuration)
          ? `${data.estimatedDuration}:00`
          : '45:00',
      exercises,
    }
  } catch (error) {
    console.error('Error parsing workout:', error)
    return null
  }
}

export function parseProgramForDisplay(
  text: string,
): ParsedProgramDisplay | null {
  try {
    const data = extractJsonObject(text)
    if (!data) {
      return null
    }

    const routinesSource = Array.isArray(data.routines)
      ? data.routines
      : Array.isArray(data.workouts)
      ? data.workouts
      : Array.isArray(data.days)
      ? data.days
      : null

    if (!routinesSource || routinesSource.length === 0) {
      return null
    }

    type RawSet = {
      type?: string
      reps?: string
      restSeconds?: number
      rest?: number
    }

    const routines = routinesSource.reduce<ParsedWorkoutDisplay[]>(
      (acc, routine) => {
        if (!routine || typeof routine !== 'object') {
          return acc
        }

        const row = routine as Record<string, unknown>
        const rawExercises = Array.isArray(row.exercises) ? row.exercises : []

        const exercises = rawExercises.reduce<
          ParsedWorkoutDisplay['exercises']
        >((exerciseAcc, exercise) => {
          if (!exercise || typeof exercise !== 'object') {
            return exerciseAcc
          }

          const ex = exercise as Record<string, unknown>
          if (typeof ex.name !== 'string' || ex.name.trim().length === 0) {
            return exerciseAcc
          }

          const match = exerciseLookup.findByName(ex.name as string)

          const sets = Array.isArray(ex.sets)
            ? (ex.sets as RawSet[]).map((s) => ({
                type: (s.type === 'warmup' ? 'warmup' : 'working') as
                  | 'warmup'
                  | 'working',
                weight: '',
                reps: s.reps || '',
                rest: s.restSeconds || s.rest || 60,
              }))
            : Array.from({ length: toPositiveNumber(ex.sets) ?? 3 }, () => ({
                type: 'working' as const,
                weight: '',
                reps:
                  typeof ex.reps === 'string' && ex.reps.trim().length > 0
                    ? ex.reps.trim()
                    : '8-12',
                rest: 60,
              }))

          exerciseAcc.push({
            name: (ex.name as string).trim(),
            gifUrl: match?.gifUrl ?? null,
            sets,
          })
          return exerciseAcc
        }, [])

        const name =
          typeof row.name === 'string' && row.name.trim().length > 0
            ? row.name.trim()
            : typeof row.title === 'string' && row.title.trim().length > 0
            ? row.title.trim()
            : null

        if (!name || exercises.length === 0) {
          return acc
        }

        const durationStr =
          typeof row.duration === 'string' && row.duration.trim().length > 0
            ? row.duration.trim()
            : toPositiveNumber(row.durationMinutes) !== null
            ? `${toPositiveNumber(row.durationMinutes)} min`
            : toPositiveNumber(row.estimatedDuration) !== null
            ? `${toPositiveNumber(row.estimatedDuration)}:00`
            : '45:00'

        acc.push({
          title: name,
          description:
            typeof row.description === 'string' ? row.description : '',
          duration: durationStr,
          exercises,
        })
        return acc
      },
      [],
    )

    if (routines.length === 0) {
      return null
    }

    return {
      title: typeof data.title === 'string' ? data.title : 'Generated Program',
      description:
        typeof data.description === 'string' ? data.description : '',
      goal: typeof data.goal === 'string' ? data.goal : undefined,
      frequency:
        typeof data.frequency === 'string' ? data.frequency : undefined,
      routines,
    }
  } catch (error) {
    console.error('Error parsing program:', error)
    return null
  }
}
