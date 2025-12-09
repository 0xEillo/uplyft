export interface ParsedWorkoutDisplay {
  description: string
  title: string
  duration: string
  exercises: {
    name: string
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
      const data = JSON.parse(jsonStr)

      if (!data.exercises || !Array.isArray(data.exercises)) return null

      return {
        description: data.description || '',
        title: data.title || 'Generated Workout',
        duration: data.estimatedDuration
          ? `${data.estimatedDuration}:00`
          : '45:00',
        exercises: data.exercises.map((ex: any) => ({
          name: ex.name,
          sets: ex.sets.map((s: any) => ({
            type: s.type || 'working',
            weight: '', // Strip weight suggestions
            reps: s.reps || '',
            rest: s.restSeconds || s.rest || 60,
          })),
        })),
      }
    }

    // Fallback to text parsing (legacy support)
    const lines = text.split('\n').filter((l) => l.trim())
    let description = ''
    let title = 'Generated Workout'
    let foundWorkoutStart = false

    for (const line of lines) {
      const trimmed = line.trim()
      if (
        trimmed.match(/^##?\s/) ||
        trimmed.match(/^\*\*.*workout/i) ||
        trimmed.match(/^#.*workout/i)
      ) {
        foundWorkoutStart = true
        title = trimmed
          .replace(/^[#*\s]+/, '')
          .replace(/[*]+$/, '')
          .trim()
        break
      }
      if (!foundWorkoutStart && trimmed && !trimmed.startsWith('-')) {
        description += (description ? ' ' : '') + trimmed
      }
    }

    const exercises: ParsedWorkoutDisplay['exercises'] = []
    const exerciseRegex =
      /(?:^|\n)[-*•\d.]+\s*\*?\*?([A-Z][^:\n*]+?)\*?\*?\s*(?:[-–:]|$)/gim
    const exerciseMatches = text.matchAll(exerciseRegex)

    for (const match of exerciseMatches) {
      const name = match[1].trim().replace(/\*+/g, '')
      if (name.length < 3 || name.length > 50) continue
      if (
        name.toLowerCase().includes('warm') &&
        name.toLowerCase().includes('up')
      )
        continue

      const afterMatch = text.slice(match.index || 0, (match.index || 0) + 200)
      const setsMatch = afterMatch.match(/(\d+)\s*(?:sets?|x)/i)
      const repsMatch = afterMatch.match(/(\d+)[-–]?(\d+)?\s*(?:reps?|rep)/i)

      const setsCount = setsMatch ? parseInt(setsMatch[1]) : 3
      const repsRange = repsMatch
        ? repsMatch[2]
          ? `${repsMatch[1]}-${repsMatch[2]}`
          : repsMatch[1]
        : '8-12'

      const sets = Array(setsCount).fill({
        type: 'working',
        weight: '', // No weight suggested
        reps: repsRange,
        rest: 60,
      })

      exercises.push({
        name,
        sets,
      })
    }

    if (exercises.length === 0) {
      for (const line of lines) {
        const trimmed = line.trim()
        const exerciseLineMatch = trimmed.match(
          /^(?:[-*•]|\d+[.)])\s*\*?\*?([A-Z][^:*\n]+)/i,
        )
        if (exerciseLineMatch) {
          const name = exerciseLineMatch[1].trim().replace(/\*+/g, '')
          if (name.length >= 3 && name.length <= 50) {
            const setsMatch = trimmed.match(/(\d+)\s*(?:sets?|x)/i)
            const repsMatch = trimmed.match(/(\d+)[-–]?(\d+)?\s*(?:reps?|rep)/i)

            const setsCount = setsMatch ? parseInt(setsMatch[1]) : 3
            const repsRange = repsMatch
              ? repsMatch[2]
                ? `${repsMatch[1]}-${repsMatch[2]}`
                : repsMatch[1]
              : '8-12'

            const sets = Array(setsCount).fill({
              type: 'working',
              weight: '', // No weight suggested
              reps: repsRange,
              rest: 60,
            })

            exercises.push({
              name,
              sets,
            })
          }
        }
      }
    }

    const totalSets = exercises.reduce((sum, ex) => sum + ex.sets.length, 0)
    const estimatedMinutes = Math.round(totalSets * 2.5 + 5)
    const duration = `${estimatedMinutes}:00`

    if (exercises.length === 0) return null

    return {
      description:
        description.slice(0, 300) || "Here's your personalized workout plan.",
      title,
      duration,
      exercises: exercises.slice(0, 12),
    }
  } catch {
    return null
  }
}

