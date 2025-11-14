import { AnalyticsEvents } from '@/constants/analytics-events'
import { useAnalytics } from '@/contexts/analytics-context'
import { useAuth } from '@/contexts/auth-context'
import { WorkoutSessionWithDetails } from '@/types/database.types'
import * as Device from 'expo-device'
import * as FileSystem from 'expo-file-system/legacy'
import * as Haptics from 'expo-haptics'
import { useCallback, useState } from 'react'
import {
  Alert,
  InteractionManager,
  Linking,
  Platform,
  Share,
} from 'react-native'
import { useWeightUnits } from './useWeightUnits'

// Disable view-shot on simulator (it's not available there)
const isSimulator = !Device.isDevice

// Conditionally import view-shot (will be null on simulator)
let captureRef: typeof import('react-native-view-shot')['captureRef'] | null = null
try {
  if (!isSimulator) {
    captureRef = require('react-native-view-shot').captureRef
  }
} catch {
  // Module not available, will be handled by simulator check
}

/**
 * Hook to handle workout sharing functionality
 *
 * This hook:
 * 1. Captures shareable workout widgets as images
 * 2. Shares them via the native share dialog or Instagram Stories
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

      if (isSimulator) {
        Alert.alert(
          'Share Unavailable',
          'Workout sharing is not available on the simulator. Please test on a physical device.',
          [{ text: 'OK' }],
        )
        return
      }

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

        if (!captureRef) {
          throw new Error('View capture not available')
        }

        try {
          uri = await captureRef(viewRef, baseCaptureOptions)
        } catch (captureError) {
          const message =
            captureError instanceof Error
              ? captureError.message
              : String(captureError)

          if (message.includes('drawViewHierarchyInRect')) {
            // Fallback path for large/complex views on iOS
            uri = await captureRef!(viewRef, {
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
        const shareMessage = `Check out my workout on Rep AI! https://repaifit.app`

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

  const shareToInstagramStories = useCallback(
    async (
      workout: WorkoutSessionWithDetails,
      viewRef: any,
      widgetType?: string,
    ) => {
      if (isSharing) return

      if (isSimulator) {
        Alert.alert(
          'Share Unavailable',
          'Workout sharing is not available on the simulator. Please test on a physical device.',
          [{ text: 'OK' }],
        )
        return
      }

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
          share_type: 'instagram_stories',
          widget_type: widgetType,
        })

        // Ensure layout/animations settle before capturing
        await new Promise<void>((resolve) =>
          InteractionManager.runAfterInteractions(() => resolve()),
        )
        // Give extra time for images to load
        await new Promise<void>((resolve) => setTimeout(resolve, 300))

        // Capture at Instagram Stories resolution (1080x1920)
        const captureOptions = {
          format: 'png' as const,
          quality: 1,
          result: 'tmpfile' as const,
          width: 1080,
          height: 1920,
        }

        let uri: string | undefined

        if (!captureRef) {
          throw new Error('View capture not available')
        }

        try {
          uri = await captureRef(viewRef, captureOptions)
        } catch (captureError) {
          const message =
            captureError instanceof Error
              ? captureError.message
              : String(captureError)

          if (message.includes('drawViewHierarchyInRect')) {
            // Fallback for complex views
            uri = await captureRef!(viewRef, {
              ...captureOptions,
              useRenderInContext: true,
              quality: 0.95,
            })
          } else {
            throw captureError
          }
        }

        if (!uri) {
          throw new Error('Failed to generate share image')
        }

        const generationTime = Date.now() - startTime

        // Check if file exists
        const fileInfo = await FileSystem.getInfoAsync(uri)
        if (!fileInfo.exists) {
          throw new Error('Failed to generate share image')
        }

        // Convert to base64 for Instagram
        const base64Image = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        })

        const instagramURL = `instagram-stories://share?source_application=${
          Platform.OS === 'ios' ? 'your-app-id' : 'com.repai.app'
        }`

        // Check if Instagram is installed
        const canOpen = await Linking.canOpenURL(instagramURL)

        if (!canOpen) {
          // Fallback to regular share if Instagram not installed
          const shareMessage = `Check out my workout on Rep AI! https://repaifit.app`
          const shareOptions = {
            url: Platform.OS === 'ios' ? uri : `file://${uri}`,
            message: shareMessage,
            title: 'My Workout - Rep AI',
          }
          await Share.share(shareOptions)
        } else {
          // Share to Instagram Stories
          if (Platform.OS === 'ios') {
            // iOS: Use pasteboard
            await Linking.openURL(
              `instagram-stories://share?source_application=your-app-id&backgroundImage=${encodeURIComponent(
                base64Image,
              )}`,
            )
          } else {
            // Android: Use intent (simplified approach - may need additional setup)
            await Linking.openURL(instagramURL)
          }
        }

        // Success haptic
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        )

        // Track successful share
        trackEvent(AnalyticsEvents.WORKOUT_SHARE_COMPLETED, {
          workout_id: workout.id,
          exercise_count: workout.workout_exercises?.length || 0,
          has_image: Boolean(workout.image_url),
          share_platform: 'instagram_stories',
          widget_type: widgetType,
          generation_time: generationTime,
        })
      } catch (error) {
        console.error('Error sharing to Instagram:', error)

        // Track error
        trackEvent(AnalyticsEvents.WORKOUT_SHARE_FAILED, {
          workout_id: workout.id,
          exercise_count: workout.workout_exercises?.length || 0,
          has_image: Boolean(workout.image_url),
          share_type: 'instagram_stories',
          widget_type: widgetType,
          error_message:
            error instanceof Error ? error.message : 'Unknown error',
        })

        // Error haptic
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)

        // Show error alert
        Alert.alert(
          'Share Failed',
          'Unable to share to Instagram. Please make sure Instagram is installed.',
          [{ text: 'OK' }],
        )
      } finally {
        setIsSharing(false)
      }
    },
    [isSharing, trackEvent, weightUnit],
  )

  const shareWorkoutWidget = useCallback(
    async (viewRef: any, shareType: 'instagram' | 'general') => {
      if (isSharing) return

      if (isSimulator) {
        Alert.alert(
          'Share Unavailable',
          'Workout sharing is not available on the simulator. Please test on a physical device.',
          [{ text: 'OK' }],
        )
        return
      }

      const startTime = Date.now()

      try {
        setIsSharing(true)

        // Haptic feedback
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

        // Track share initiated
        trackEvent(AnalyticsEvents.WORKOUT_SHARE_INITIATED, {
          share_type: shareType === 'instagram' ? 'instagram_stories' : 'general',
        })

        // Ensure layout/animations settle before capturing
        await new Promise<void>((resolve) =>
          InteractionManager.runAfterInteractions(() => resolve()),
        )
        await new Promise<void>((resolve) => setTimeout(resolve, 300))

        if (shareType === 'instagram') {
          // Capture for Instagram Stories (1080x1920)
          const captureOptions = {
            format: 'png' as const,
            quality: 1,
            result: 'tmpfile' as const,
            width: 1080,
            height: 1920,
          }

          let uri: string | undefined

          if (!captureRef) {
            throw new Error('View capture not available')
          }

          try {
            uri = await captureRef(viewRef, captureOptions)
          } catch (captureError) {
            const message =
              captureError instanceof Error
                ? captureError.message
                : String(captureError)

            if (message.includes('drawViewHierarchyInRect')) {
              uri = await captureRef!(viewRef, {
                ...captureOptions,
                useRenderInContext: true,
                quality: 0.95,
              })
            } else {
              throw captureError
            }
          }

          if (!uri) {
            throw new Error('Failed to generate share image')
          }

          const fileInfo = await FileSystem.getInfoAsync(uri)
          if (!fileInfo.exists) {
            throw new Error('Failed to generate share image')
          }

          // Convert to base64 for Instagram
          const base64Image = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          })

          const instagramURL = `instagram-stories://share?source_application=${
            Platform.OS === 'ios' ? 'your-app-id' : 'com.repai.app'
          }`

          // Check if Instagram is installed
          const canOpen = await Linking.canOpenURL(instagramURL)

          if (!canOpen) {
            // Fallback to regular share
            const shareMessage = `Check out my workout on Rep AI! https://repaifit.app`
            const shareOptions = {
              url: Platform.OS === 'ios' ? uri : `file://${uri}`,
              message: shareMessage,
              title: 'My Workout - Rep AI',
            }
            await Share.share(shareOptions)
          } else {
            // Share to Instagram Stories
            if (Platform.OS === 'ios') {
              await Linking.openURL(
                `instagram-stories://share?source_application=your-app-id&backgroundImage=${encodeURIComponent(
                  base64Image,
                )}`,
              )
            } else {
              await Linking.openURL(instagramURL)
            }
          }
        } else {
          // General share
          const captureOptions = {
            format: 'jpg' as const,
            quality: Platform.OS === 'ios' ? 0.85 : 0.9,
            result: 'tmpfile' as const,
          }

          let uri: string | undefined

          if (!captureRef) {
            throw new Error('View capture not available')
          }

          try {
            uri = await captureRef(viewRef, captureOptions)
          } catch (captureError) {
            const message =
              captureError instanceof Error
                ? captureError.message
                : String(captureError)

            if (message.includes('drawViewHierarchyInRect')) {
              uri = await captureRef!(viewRef, {
                ...captureOptions,
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

          const fileInfo = await FileSystem.getInfoAsync(uri)
          if (!fileInfo.exists) {
            throw new Error('Failed to generate share image')
          }

          // Share the image
          const shareMessage = `Check out my workout on Rep AI! https://repaifit.app`
          const shareOptions = {
            url: Platform.OS === 'ios' ? uri : `file://${uri}`,
            message: shareMessage,
            title: 'My Workout - Rep AI',
          }

          const result = await Share.share(shareOptions)

          if (result.action === Share.sharedAction) {
            await Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success,
            )
          }
        }

        const generationTime = Date.now() - startTime

        // Track success
        trackEvent(AnalyticsEvents.WORKOUT_SHARE_COMPLETED, {
          share_type: shareType === 'instagram' ? 'instagram_stories' : 'general',
          generation_time: generationTime,
        })

        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        )
      } catch (error) {
        console.error('Error sharing widget:', error)

        trackEvent(AnalyticsEvents.WORKOUT_SHARE_FAILED, {
          share_type: shareType === 'instagram' ? 'instagram_stories' : 'general',
          error_message:
            error instanceof Error ? error.message : 'Unknown error',
        })

        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)

        Alert.alert(
          'Share Failed',
          'Unable to share your workout. Please try again.',
          [{ text: 'OK' }],
        )
      } finally {
        setIsSharing(false)
      }
    },
    [isSharing, trackEvent],
  )

  return {
    shareWorkout,
    shareToInstagramStories,
    shareWorkoutWidget,
    isSharing,
  }
}
