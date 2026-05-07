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

function formatDurationDigits(value?: string | null): string {
  const digits = (value ?? '').replace(/\D/g, '')
  if (!digits) return ''
  const seconds = Number.parseInt(digits.slice(-2), 10) || 0
  const minutes = Number.parseInt(digits.slice(0, -2) || '0', 10) || 0
  const totalSeconds = minutes * 60 + seconds
  const displayMinutes = Math.floor(totalSeconds / 60)
  const displaySeconds = totalSeconds % 60
  return `${displayMinutes}:${displaySeconds.toString().padStart(2, '0')}`
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
