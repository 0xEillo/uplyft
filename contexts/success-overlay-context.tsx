import React, { createContext, useContext, useState } from 'react'
import { WorkoutSessionWithDetails } from '@/types/database.types'

interface SuccessOverlayData {
  message: string
  workoutNumber: number
  weeklyTarget: number
  currentStreak?: number
  workout?: WorkoutSessionWithDetails
  workoutTitle?: string
}

interface SuccessOverlayContextType {
  showOverlay: (data: SuccessOverlayData) => void
  hideOverlay: () => void
  updateWorkoutData: (workout: WorkoutSessionWithDetails) => void
  isVisible: boolean
  data: SuccessOverlayData
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
  const [isVisible, setIsVisible] = useState(false)
  const [showShareScreen, setShowShareScreen] = useState(false)
  const [data, setData] = useState<SuccessOverlayData>({
    message: 'Well done on completing another workout!',
    workoutNumber: 1,
    weeklyTarget: 3,
  })

  const showOverlay = (overlayData: SuccessOverlayData) => {
    console.log('[SuccessOverlay] showOverlay called with:', overlayData)
    setData(overlayData)
    setIsVisible(true)
    // Reset share screen state when showing new overlay
    setShowShareScreen(false)
  }

  const hideOverlay = () => {
    console.log('[SuccessOverlay] hideOverlay called')
    setIsVisible(false)
  }

  const updateWorkoutData = (workout: WorkoutSessionWithDetails) => {
    console.log('[SuccessOverlay] updateWorkoutData called with workout:', {
      id: workout.id,
      exerciseCount: workout.workout_exercises?.length,
    })
    setData((prevData) => {
      const newData = {
        ...prevData,
        workout,
      }
      console.log('[SuccessOverlay] Updated data:', {
        hasWorkout: Boolean(newData.workout),
        workoutId: newData.workout?.id,
      })
      return newData
    })
  }

  return (
    <SuccessOverlayContext.Provider
      value={{
        showOverlay,
        hideOverlay,
        updateWorkoutData,
        isVisible,
        data,
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
