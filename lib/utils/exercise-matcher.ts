import exercisesData from '@/assets/exercises/exercises.json'

export type ExerciseMatch = {
  exerciseId: string
  name: string
  gifUrl: string | null
}

const exercises = exercisesData as ExerciseMatch[]

// Create a normalized map for faster exact lookups
const exerciseMap = new Map<string, ExerciseMatch>()
exercises.forEach((ex) => {
  if (ex.name) {
    exerciseMap.set(ex.name.toLowerCase().trim(), ex)
  }
})

/**
 * matches an exercise name to a local exercise object to retrieve the GIF URL.
 * Prioritizes exact matches (case-insensitive).
 */
export function findExerciseByName(name: string): ExerciseMatch | null {
  if (!name) return null
  const normalizedInput = name.toLowerCase().trim()

  // 1. Exact match
  if (exerciseMap.has(normalizedInput)) {
    return exerciseMap.get(normalizedInput)!
  }

  // 2. Contains match (fallback)
  // If the AI returns "Barbell Bench Press (Chest)", but we only have "Barbell Bench Press"
  // or vice versa.
  // We prefer the longest match that is contained in the input or contains the input.
  
  // Strategy: valid exercise name is a substring of input, or input is substring of valid exercise name
  // This can get messy, but since we have a tool, we expect high accuracy.
  // Let's just try to find if any key in our map is a substring of the input or vice versa.
  
  let bestMatch: ExerciseMatch | null = null
  let bestScore = 0

  for (const ex of exercises) {
    const exName = ex.name.toLowerCase().trim()
    
    // Check for exact inclusion
    if (normalizedInput.includes(exName) || exName.includes(normalizedInput)) {
      // Simple score: match length
      const score = exName.length
      // Prefer the match that is closest significantly in length to the input (favors specific over generic)
      // Actually, for "Dumbbell Press", we want "Dumbbell Bench Press" over just "Press" if both exist?
      // Let's stick to simplest: Longest matched string wins.
      if (score > bestScore) {
        bestScore = score
        bestMatch = ex
      }
    }
  }

  return bestMatch
}
