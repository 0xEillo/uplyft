import { ExerciseRankUpgrade } from '@/components/exercise-rank-overlay'
import type { StrengthLevel } from '@/lib/strength-standards'
import { WorkoutSessionWithDetails } from '@/types/database.types'
import React, { createContext, useCallback, useContext, useRef, useState } from 'react'

interface SuccessOverlayData {
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

interface SuccessOverlayContextType {
  showOverlay: (data: SuccessOverlayData) => void
  showStreakOverlay: (data: SuccessOverlayData) => void // Only show if streak milestone
  hideOverlay: () => void
  updateWorkoutData: (workout: WorkoutSessionWithDetails) => void
  isVisible: boolean
  overlayHasShown: boolean
  workoutPosted: boolean
  data: SuccessOverlayData
  showShareScreen: boolean
  setShowShareScreen: (show: boolean) => void
  // Points gain overlay
  showPointsGainOverlay: (scoreData: StrengthScoreData) => void
  hidePointsOverlay: () => void
  isPointsOverlayVisible: boolean
  pointsData: StrengthScoreData | null
  // Exercise rank overlays
  showExerciseRankOverlays: (upgrades: ExerciseRankUpgrade[], scoreData?: StrengthScoreData) => void
  dismissCurrentExerciseRankOverlay: () => void
  isExerciseRankOverlayVisible: boolean
  currentExerciseRankUpgrade: ExerciseRankUpgrade | null
}

const SuccessOverlayContext = createContext<
  SuccessOverlayContextType | undefined
>(undefined)

export function SuccessOverlayProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [isVisible, setIsVisible] = useState(false)
  const [showShareScreen, setShowShareScreen] = useState(false)
  const [overlayHasShown, setOverlayHasShown] = useState(false)
  const [workoutPosted, setWorkoutPosted] = useState(false)
  const [data, setData] = useState<SuccessOverlayData>({
    message: 'Well done on completing another workout!',
    workoutNumber: 1,
    weeklyTarget: 3,
  })
  const [isPointsOverlayVisible, setIsPointsOverlayVisible] = useState(false)
  const [pointsData, setPointsData] = useState<StrengthScoreData | null>(null)
  const [exerciseRankQueue, setExerciseRankQueue] = useState<ExerciseRankUpgrade[]>([])
  const pendingPointsDataRef = useRef<StrengthScoreData | null>(null)

  const showOverlay = (overlayData: SuccessOverlayData) => {
    setData(overlayData)
    setIsVisible(true)
    setOverlayHasShown(true)
    // Reset workout posted flag and share screen state when showing new overlay
    setWorkoutPosted(false)
    setShowShareScreen(false)
  }

  // Only show overlay if it's a streak milestone (streak increased)
  const showStreakOverlay = (overlayData: SuccessOverlayData) => {
    // Check if streak increased (e.g., 2 weeks -> 3 weeks)
    const previousStreak = overlayData.previousStreak ?? 0
    const currentStreak = overlayData.currentStreak ?? 0
    const isStreakMilestone = currentStreak > previousStreak && currentStreak > 0

    if (isStreakMilestone) {
      setData({ ...overlayData, streakMilestone: true })
      setIsVisible(true)
      setOverlayHasShown(true)
      // Reset workout posted flag and share screen state when showing new overlay
      setWorkoutPosted(false)
      setShowShareScreen(false)
    } else {
      // No streak milestone - just mark as shown so share screen can proceed
      setData(overlayData)
      setOverlayHasShown(true)
      setWorkoutPosted(false)
      setShowShareScreen(false)
    }
  }

  const hideOverlay = () => {
    setIsVisible(false)
    // Mark that the overlay animation has completed
    setOverlayHasShown(false)
  }

  const updateWorkoutData = (workout: WorkoutSessionWithDetails) => {
    setData((prevData) => {
      const newData = {
        ...prevData,
        workout,
      }
      return newData
    })
    // Mark that the workout has been successfully posted to the server
    setWorkoutPosted(true)
  }

  const showPointsGainOverlay = useCallback((scoreData: StrengthScoreData) => {
    if (scoreData.pointsGained <= 0) return
    setPointsData(scoreData)
    setIsPointsOverlayVisible(true)
  }, [])

  const hidePointsOverlay = useCallback(() => {
    setIsPointsOverlayVisible(false)
  }, [])

  const showExerciseRankOverlays = useCallback(
    (upgrades: ExerciseRankUpgrade[], scoreData?: StrengthScoreData) => {
      if (scoreData) pendingPointsDataRef.current = scoreData
      const hasUpgrades = upgrades.length > 0
      const hasPoints = scoreData && scoreData.pointsGained > 0
      if (!hasUpgrades) {
        if (hasPoints) {
          setPointsData(scoreData!)
          setIsPointsOverlayVisible(true)
          pendingPointsDataRef.current = null
        }
        return
      }
      setExerciseRankQueue(upgrades)
    },
    [],
  )

  const dismissCurrentExerciseRankOverlay = useCallback(() => {
    setExerciseRankQueue((prev) => {
      const next = prev.slice(1)
      const pending = pendingPointsDataRef.current
      if (next.length === 0 && pending && pending.pointsGained > 0) {
        setTimeout(() => {
          setPointsData(pending)
          setIsPointsOverlayVisible(true)
          pendingPointsDataRef.current = null
        }, 400)
      }
      return next
    })
  }, [])

  return (
    <SuccessOverlayContext.Provider
      value={{
        showOverlay,
        showStreakOverlay,
        hideOverlay,
        updateWorkoutData,
        isVisible,
        overlayHasShown,
        workoutPosted,
        data,
        showShareScreen,
        setShowShareScreen,
        showPointsGainOverlay,
        hidePointsOverlay,
        isPointsOverlayVisible,
        pointsData,
        showExerciseRankOverlays,
        dismissCurrentExerciseRankOverlay,
        isExerciseRankOverlayVisible: exerciseRankQueue.length > 0,
        currentExerciseRankUpgrade: exerciseRankQueue[0] ?? null,
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
