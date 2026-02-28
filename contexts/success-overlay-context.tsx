import type { StrengthLevel } from '@/lib/strength-standards'
import { WorkoutSessionWithDetails } from '@/types/database.types'
import React, { createContext, useCallback, useContext, useState } from 'react'

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
