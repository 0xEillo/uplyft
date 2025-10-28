import * as ImagePicker from 'expo-image-picker'
import { useCallback, useState } from 'react'
import { Alert, Platform, Linking } from 'react-native'

// Constants
const IMAGE_QUALITY = 0.8
const IMAGE_PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: 'images' as any,
  allowsEditing: false,
  quality: IMAGE_QUALITY,
}

/**
 * Type definition for image file in FormData.
 * React Native's FormData accepts this shape for file uploads.
 */
interface ImageFileBlob {
  uri: string
  type: string
  name: string
}

interface ExtractedWorkoutData {
  title?: string
  description?: string
  workout: string
}

interface UseImageTranscriptionOptions {
  onExtractionComplete?: (data: ExtractedWorkoutData) => void
  onImageAttached?: (uri: string) => void
  onError?: (error: Error) => void
}

/**
 * Custom hook for image selection and text extraction.
 * Handles permissions, image picking, and API calls.
 *
 * @example
 * ```tsx
 * const { isProcessing, pickImage } = useImageTranscription({
 *   onExtractionComplete: (data) => {
 *     setWorkoutTitle(data.title || '')
 *     setNotes(data.description ? `${data.description}\n\n${data.workout}` : data.workout)
 *   }
 * })
 * ```
 */
export function useImageTranscription(
  options: UseImageTranscriptionOptions = {},
) {
  const { onExtractionComplete, onImageAttached, onError } = options
  const [isProcessing, setIsProcessing] = useState(false)
  const [showModal, setShowModal] = useState(false)

  /**
   * Extract text from image using the Supabase Edge Function
   */
  const extractTextFromImage = useCallback(async (uri: string): Promise<
    ExtractedWorkoutData
  > => {
    // Import at call time to avoid issues with module resolution
    const { callSupabaseFunctionWithFormData } = await import('@/lib/supabase-functions-client')
    const { supabase } = await import('@/lib/supabase')

    const formData = new FormData()
    const imageFile: ImageFileBlob = {
      uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
      type: 'image/jpeg',
      name: 'workout-image.jpg',
    }
    // FormData.append accepts Blob-like objects in React Native
    formData.append('image', (imageFile as unknown) as Blob)

    // Get the session token for authentication
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData?.session?.access_token

    const response = await callSupabaseFunctionWithFormData('extract-image', formData, token)

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(
        errorData.details ||
          errorData.error ||
          'Failed to extract text from image',
      )
    }

    const data = await response.json()
    return data
  }, [])

  /**
   * Process the selected image based on the chosen action
   */
  const processImage = useCallback(async (uri: string, action: 'scan' | 'attach') => {
    if (action === 'scan') {
      // Scan workout - extract text from image
      setIsProcessing(true)
      try {
        const data = await extractTextFromImage(uri)
        onExtractionComplete?.(data)
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error('Unknown error')
        onError?.(errorObj)

        Alert.alert(
          'Could Not Extract Workout',
          errorObj.message || 'Unable to extract workout information from the image. Please try again or enter it manually.',
          [{ text: 'OK' }],
        )
      } finally {
        setIsProcessing(false)
      }
    } else {
      // Attach photo - just pass the URI
      onImageAttached?.(uri)
    }
  }, [extractTextFromImage, onExtractionComplete, onImageAttached, onError])

  /**
   * Launch camera with the selected action
   */
  const launchCamera = useCallback(async (action: 'scan' | 'attach') => {
    try {
      // Check current permission status
      const currentStatus = await ImagePicker.getCameraPermissionsAsync()

      // If permission was previously denied, guide user to settings
      if (currentStatus.status === 'denied' && !currentStatus.canAskAgain) {
        Alert.alert(
          'Camera Access Needed',
          Platform.select({
            ios: 'To take photos, please enable camera access in Settings > Rep AI > Camera.',
            android: 'To take photos, please enable camera access in Settings > Apps > Rep AI > Permissions.',
          }),
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => Linking.openSettings(),
            },
          ],
        )
        return
      }

      // Request permission
      const cameraPermission = await ImagePicker.requestCameraPermissionsAsync()

      if (cameraPermission.status !== 'granted') {
        Alert.alert(
          'Camera Permission Required',
          'Rep AI needs camera access to take photos of your workouts. You can enable this in your device settings.',
          [
            { text: 'Not Now', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => Linking.openSettings(),
            },
          ],
        )
        return
      }

      const result = await ImagePicker.launchCameraAsync(IMAGE_PICKER_OPTIONS)

      if (!result.canceled && result.assets[0]) {
        await processImage(result.assets[0].uri, action)
      }
    } catch (error) {
      console.error('Error launching camera:', error)
      Alert.alert(
        'Camera Error',
        'Failed to open camera. Please check your camera permissions in device settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open Settings',
            onPress: () => Linking.openSettings(),
          },
        ],
      )
    }
  }, [processImage])

  /**
   * Launch library picker with the selected action
   */
  const launchLibrary = useCallback(async (action: 'scan' | 'attach') => {
    try {
      // Check current permission status
      const currentStatus = await ImagePicker.getMediaLibraryPermissionsAsync()

      // If permission was previously denied, guide user to settings
      if (currentStatus.status === 'denied' && !currentStatus.canAskAgain) {
        Alert.alert(
          'Photo Library Access Needed',
          Platform.select({
            ios: 'To select photos, please enable photo library access in Settings > Rep AI > Photos.',
            android: 'To select photos, please enable storage access in Settings > Apps > Rep AI > Permissions.',
          }),
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => Linking.openSettings(),
            },
          ],
        )
        return
      }

      // Request permission
      const libraryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync()

      if (libraryPermission.status !== 'granted') {
        Alert.alert(
          'Photo Library Permission Required',
          'Rep AI needs photo library access to select photos of your workouts. You can enable this in your device settings.',
          [
            { text: 'Not Now', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => Linking.openSettings(),
            },
          ],
        )
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync(IMAGE_PICKER_OPTIONS)

      if (!result.canceled && result.assets[0]) {
        await processImage(result.assets[0].uri, action)
      }
    } catch (error) {
      console.error('Error launching library:', error)
      Alert.alert(
        'Photo Library Error',
        'Failed to open photo library. Please check your photo library permissions in device settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open Settings',
            onPress: () => Linking.openSettings(),
          },
        ],
      )
    }
  }, [processImage])

  /**
   * Show the image picker modal
   */
  const pickImage = useCallback(() => {
    setShowModal(true)
  }, [])

  const closeModal = useCallback(() => {
    setShowModal(false)
  }, [])

  const handleScanWithCamera = useCallback(() => {
    launchCamera('scan')
  }, [launchCamera])

  const handleScanWithLibrary = useCallback(() => {
    launchLibrary('scan')
  }, [launchLibrary])

  const handleAttachWithCamera = useCallback(() => {
    launchCamera('attach')
  }, [launchCamera])

  const handleAttachWithLibrary = useCallback(() => {
    launchLibrary('attach')
  }, [launchLibrary])

  return {
    isProcessing,
    pickImage,
    showModal,
    closeModal,
    handleScanWithCamera,
    handleScanWithLibrary,
    handleAttachWithCamera,
    handleAttachWithLibrary,
  }
}
