import type { StrengthLevel } from '@/lib/strength-standards'

export interface ExerciseRankUpgrade {
  exerciseName: string
  previousLevel: StrengthLevel
  currentLevel: StrengthLevel
}
