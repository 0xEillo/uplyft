import { AnalyticsEvents } from '@/constants/analytics-events'
import { useAnalytics } from '@/contexts/analytics-context'
import { useAuth } from '@/contexts/auth-context'
import { WorkoutSessionWithDetails } from '@/types/database.types'
import * as FileSystem from 'expo-file-system/legacy'
import * as Haptics from 'expo-haptics'
import { useCallback, useState } from 'react'
import { Alert, InteractionManager, Platform, Share } from 'react-native'
import { captureRef } from 'react-native-view-shot'
import { useWeightUnits } from './useWeightUnits'

export interface UseWorkoutShareResult {
  shareWorkout: (
    workout: WorkoutSessionWithDetails,
    workoutTitle: string,
    viewRef: any,
  ) => Promise<void>
  isSharing: boolean
}

/**
 * Hook to handle workout sharing functionality
 *
 * This hook:
 * 1. Captures a ShareWorkoutCard component as an image
 * 2. Shares it via the native share dialog
 * 3. Tracks analytics events
 * 4. Handles errors gracefully
 */
export function useWorkoutShare(): UseWorkoutShareResult {
  const [isSharing, setIsSharing] = useState(false)
  const { trackEvent } = useAnalytics()
  const { user } = useAuth()
  const { weightUnit } = useWeightUnits()

  const shareWorkout = useCallback(
    async (
      workout: WorkoutSessionWithDetails,
      workoutTitle: string,
      viewRef: any,
    ) => {
      if (isSharing) return

      const startTime = Date.now()

      try {
        setIsSharing(true)

        // Haptic feedback
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

        // Track share initiated
        trackEvent(AnalyticsEvents.WORKOUT_SHARE_INITIATED, {
          workout_id: workout.id,
          exercise_count: workout.workout_exercises?.length || 0,
          has_image: Boolean(workout.image_url),
        })

        // Ensure layout/animations settle before capturing
        await new Promise<void>((resolve) =>
          InteractionManager.runAfterInteractions(() => resolve()),
        )
        // Give extra time for images to load
        await new Promise<void>((resolve) => setTimeout(resolve, 300))

        const baseCaptureOptions = {
          format: 'jpg' as const,
          quality: Platform.OS === 'ios' ? 0.85 : 0.9,
          result: 'tmpfile' as const,
        }

        let uri: string | undefined

        try {
          uri = await captureRef(viewRef, baseCaptureOptions)
        } catch (captureError) {
          const message =
            captureError instanceof Error
              ? captureError.message
              : String(captureError)

          if (message.includes('drawViewHierarchyInRect')) {
            // Fallback path for large/complex views on iOS
            uri = await captureRef(viewRef, {
              ...baseCaptureOptions,
              useRenderInContext: true,
              quality: 0.8,
            })
          } else {
            throw captureError
          }
        }

        if (!uri) {
          throw new Error('Failed to generate share image')
        }

        const generationTime = Date.now() - startTime

        // Check if file exists and get its size
        const fileInfo = await FileSystem.getInfoAsync(uri)
        if (!fileInfo.exists) {
          throw new Error('Failed to generate share image')
        }

        // Share the image with message and link
        const shareMessage = `Track your workouts with Rep AI: https://repaifit.app`

        const shareOptions = {
          url: Platform.OS === 'ios' ? uri : `file://${uri}`,
          message: shareMessage,
          title: 'My Workout - Rep AI',
        }

        const result = await Share.share(shareOptions)

        // Track successful share
        if (result.action === Share.sharedAction) {
          // Success haptic
          await Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          )

          trackEvent(AnalyticsEvents.WORKOUT_SHARE_COMPLETED, {
            workout_id: workout.id,
            exercise_count: workout.workout_exercises?.length || 0,
            has_image: Boolean(workout.image_url),
            share_platform: result.activityType || 'unknown',
            generation_time: generationTime,
          })
        }

        // Clean up temporary file (skip cleanup as iOS handles temp files automatically)
        // Trying to delete sometimes causes permission errors on iOS
      } catch (error) {
        console.error('Error sharing workout:', error)

        // Track error
        trackEvent(AnalyticsEvents.WORKOUT_SHARE_FAILED, {
          workout_id: workout.id,
          exercise_count: workout.workout_exercises?.length || 0,
          has_image: Boolean(workout.image_url),
          error_message:
            error instanceof Error ? error.message : 'Unknown error',
        })

        // Error haptic
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)

        // Show error alert
        Alert.alert(
          'Share Failed',
          'Unable to share your workout. Please try again.',
          [{ text: 'OK' }],
        )
      } finally {
        setIsSharing(false)
      }
    },
    [isSharing, trackEvent, weightUnit],
  )

  return {
    shareWorkout,
    isSharing,
  }
}
