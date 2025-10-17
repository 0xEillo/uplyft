import * as ImagePicker from 'expo-image-picker'
import { useCallback, useState } from 'react'
import { Alert, Platform } from 'react-native'

// Constants
const IMAGE_QUALITY = 0.8
const IMAGE_PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: [ImagePicker.MediaType.Images],
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
      const cameraPermission = await ImagePicker.requestCameraPermissionsAsync()

      if (cameraPermission.status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Camera permission is required to take photos.',
        )
        return
      }

      const result = await ImagePicker.launchCameraAsync(IMAGE_PICKER_OPTIONS)

      if (!result.canceled && result.assets[0]) {
        await processImage(result.assets[0].uri, action)
      }
    } catch (error) {
      console.error('Error launching camera:', error)
      Alert.alert('Error', 'Failed to open camera. Please try again.', [
        { text: 'OK' },
      ])
    }
  }, [processImage])

  /**
   * Launch library picker with the selected action
   */
  const launchLibrary = useCallback(async (action: 'scan' | 'attach') => {
    try {
      const libraryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync()

      if (libraryPermission.status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Photo library permission is required to select photos.',
        )
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync(IMAGE_PICKER_OPTIONS)

      if (!result.canceled && result.assets[0]) {
        await processImage(result.assets[0].uri, action)
      }
    } catch (error) {
      console.error('Error launching library:', error)
      Alert.alert('Error', 'Failed to open photo library. Please try again.', [
        { text: 'OK' },
      ])
    }
  }, [processImage])

  /**
   * Show action choice, then camera/library picker
   */
  const pickImage = useCallback(async () => {
    try {
      // First, ask what they want to do with the image
      Alert.alert(
        'Camera',
        'What would you like to do?',
        [
          {
            text: 'Scan Workout',
            onPress: () => {
              // Then ask camera or library
              Alert.alert(
                'Scan Workout',
                'Choose how to add your workout',
                [
                  {
                    text: 'Take Photo',
                    onPress: () => launchCamera('scan'),
                  },
                  {
                    text: 'Choose from Library',
                    onPress: () => launchLibrary('scan'),
                  },
                  {
                    text: 'Cancel',
                    style: 'cancel',
                  },
                ],
              )
            },
          },
          {
            text: 'Attach Photo',
            onPress: () => {
              // Then ask camera or library
              Alert.alert(
                'Attach Photo',
                'Choose how to add your photo',
                [
                  {
                    text: 'Take Photo',
                    onPress: () => launchCamera('attach'),
                  },
                  {
                    text: 'Choose from Library',
                    onPress: () => launchLibrary('attach'),
                  },
                  {
                    text: 'Cancel',
                    style: 'cancel',
                  },
                ],
              )
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
  }, [launchCamera, launchLibrary])

  return {
    isProcessing,
    pickImage,
  }
}
