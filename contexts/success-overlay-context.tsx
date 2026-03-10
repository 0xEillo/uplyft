import { ExerciseRankUpgrade } from '@/components/exercise-rank-overlay'
import type { StrengthLevel } from '@/lib/strength-standards'
import { WorkoutSessionWithDetails } from '@/types/database.types'
import React, { createContext, useCallback, useContext, useState } from 'react'

export interface SuccessOverlayData {
  message: string
  workoutNumber: number
  weeklyTarget: number
  currentStreak?: number
  previousStreak?: number // Track previous streak to detect milestone
  streakMilestone?: boolean // True when streak increased (e.g., 2 weeks -> 3 weeks)
  workout?: WorkoutSessionWithDetails
  workoutTitle?: string
}

export interface StrengthScoreData {
  previousScore: number
  currentScore: number
  pointsGained: number
  previousLevel: StrengthLevel
  currentLevel: StrengthLevel
  nextLevel: StrengthLevel | null
  progress: number // 0-100
}

export interface PostWorkoutCelebrationData {
  workout: WorkoutSessionWithDetails
  workoutTitle?: string
  workoutNumber?: number
  workoutCountThisWeek?: number
  streakData?: {
    currentStreak: number
    previousStreak: number
    isMilestone: boolean
  }
  pointsData?: StrengthScoreData
  exerciseUpgrades?: ExerciseRankUpgrade[]
}

interface SuccessOverlayContextType {
  // Stash initial data from create-post
  pendingStreakData: SuccessOverlayData | null
  setPendingStreakData: (data: SuccessOverlayData | null) => void

  // Celebration overlay state
  celebrationData: PostWorkoutCelebrationData | null
  isCelebrationVisible: boolean
  showCelebration: (data: PostWorkoutCelebrationData) => void
  hideCelebration: () => void

  // Backward compatibility / existing features
  showShareScreen: boolean
  setShowShareScreen: (show: boolean) => void
}

const SuccessOverlayContext = createContext<
  SuccessOverlayContextType | undefined
>(undefined)

export function SuccessOverlayProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [pendingStreakData, setPendingStreakData] = useState<SuccessOverlayData | null>(null)
  
  const [isCelebrationVisible, setIsCelebrationVisible] = useState(false)
  const [celebrationData, setCelebrationData] = useState<PostWorkoutCelebrationData | null>(null)

  const [showShareScreen, setShowShareScreen] = useState(false)

  const showCelebration = useCallback((data: PostWorkoutCelebrationData) => {
    setCelebrationData(data)
    setIsCelebrationVisible(true)
    setShowShareScreen(false) // Reset share screen
  }, [])

  const hideCelebration = useCallback(() => {
    setIsCelebrationVisible(false)
  }, [])

  return (
    <SuccessOverlayContext.Provider
      value={{
        pendingStreakData,
        setPendingStreakData,
        celebrationData,
        isCelebrationVisible,
        showCelebration,
        hideCelebration,
        showShareScreen,
        setShowShareScreen,
      }}
    >
      {children}
    </SuccessOverlayContext.Provider>
  )
}

export function useSuccessOverlay() {
  const context = useContext(SuccessOverlayContext)
  if (context === undefined) {
    throw new Error(
      'useSuccessOverlay must be used within a SuccessOverlayProvider',
    )
  }
  return context
}
