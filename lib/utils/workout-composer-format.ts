import { formatDurationDigits } from '@/lib/exercise-logging-mode'
import type { StructuredExerciseDraft } from '@/lib/utils/workout-draft'

export function getDefaultWorkoutTitle(date: Date = new Date()): string {
  const hour = date.getHours()

  if (hour < 12) {
    return 'Morning Session'
  }

  if (hour < 15) {
    return 'Afternoon Session'
  }

  return 'Evening Session'
}

export function structuredWorkoutHasLoggedSets(
  structuredData: StructuredExerciseDraft[] = [],
): boolean {
  return structuredData.some((exercise) =>
    (exercise.sets ?? []).some(
      (set) => set.weight?.trim() || set.reps?.trim() || set.duration?.trim(),
    ),
  )
}

export function convertStructuredDataToText(
  data: StructuredExerciseDraft[],
  unitDisplay: string = 'kg',
): string {
  if (!data || data.length === 0) return ''

  return data
    .map((exercise) => {
      const lines = [exercise.name]

      exercise.sets.forEach((set, index) => {
        if (exercise.loggingType === 'duration') {
          if (set.duration) {
            lines.push(`Set ${index + 1}: ${formatDurationDigits(set.duration)}`)
          }
          return
        }

        if (set.weight || set.reps) {
          const weightText = set.weight || '___'
          const repsText = set.reps || '___'

          lines.push(
            `Set ${index + 1}: ${weightText} ${unitDisplay} x ${repsText} reps`,
          )
        }
      })

      return lines.join('\n')
    })
    .join('\n\n')
}
