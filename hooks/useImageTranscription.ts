import * as ImagePicker from 'expo-image-picker'
import { useCallback, useState } from 'react'
import { Alert, Platform } from 'react-native'

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
  const { onExtractionComplete, onError } = options
  const [isProcessing, setIsProcessing] = useState(false)

  /**
   * Extract text from image using the API
   */
  const extractTextFromImage = useCallback(async (uri: string): Promise<
    ExtractedWorkoutData
  > => {
    const formData = new FormData()
    const imageFile: ImageFileBlob = {
      uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
      type: 'image/jpeg',
      name: 'workout-image.jpg',
    }
    // FormData.append accepts Blob-like objects in React Native
    formData.append('image', (imageFile as unknown) as Blob)

    const response = await fetch('/api/extract-image', {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })

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
   * Pick an image from camera or gallery and extract text
   */
  const pickImage = useCallback(async () => {
    try {
      // Request permissions
      const cameraPermission = await ImagePicker.requestCameraPermissionsAsync()
      const libraryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync()

      if (
        cameraPermission.status !== 'granted' &&
        libraryPermission.status !== 'granted'
      ) {
        Alert.alert(
          'Permission Required',
          'Please grant camera or photo library permissions to log workouts with images.',
          [{ text: 'OK' }],
        )
        return
      }

      // Show action sheet to choose camera or library
      Alert.alert(
        'Add Workout Image',
        'Choose how you want to add your workout',
        [
          {
            text: 'Take Photo',
            onPress: async () => {
              if (cameraPermission.status !== 'granted') {
                Alert.alert(
                  'Permission Required',
                  'Camera permission is required to take photos.',
                )
                return
              }

              const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ['images'],
                allowsEditing: false,
                quality: 0.8,
              })

              if (!result.canceled && result.assets[0]) {
                setIsProcessing(true)
                try {
                  const data = await extractTextFromImage(result.assets[0].uri)
                  onExtractionComplete?.(data)
                } catch (error) {
                  const errorObj =
                    error instanceof Error ? error : new Error('Unknown error')
                  onError?.(errorObj)

                  Alert.alert(
                    'Could Not Extract Workout',
                    errorObj.message || 'Unable to extract workout information from the image. Please try again or enter it manually.',
                    [{ text: 'OK' }],
                  )
                } finally {
                  setIsProcessing(false)
                }
              }
            },
          },
          {
            text: 'Choose from Library',
            onPress: async () => {
              if (libraryPermission.status !== 'granted') {
                Alert.alert(
                  'Permission Required',
                  'Photo library permission is required to select photos.',
                )
                return
              }

              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: false,
                quality: 0.8,
              })

              if (!result.canceled && result.assets[0]) {
                setIsProcessing(true)
                try {
                  const data = await extractTextFromImage(result.assets[0].uri)
                  onExtractionComplete?.(data)
                } catch (error) {
                  const errorObj =
                    error instanceof Error ? error : new Error('Unknown error')
                  onError?.(errorObj)

                  Alert.alert(
                    'Could Not Extract Workout',
                    errorObj.message || 'Unable to extract workout information from the image. Please try again or enter it manually.',
                    [{ text: 'OK' }],
                  )
                } finally {
                  setIsProcessing(false)
                }
              }
            },
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ],
      )
    } catch (error) {
      console.error('Error picking image:', error)
      Alert.alert('Error', 'Failed to open image picker. Please try again.', [
        { text: 'OK' },
      ])
    }
  }, [extractTextFromImage, onExtractionComplete, onError])

  return {
    isProcessing,
    pickImage,
  }
}
