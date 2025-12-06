import * as FileSystem from 'expo-file-system/legacy'
import * as ImageManipulator from 'expo-image-manipulator'
import * as ImagePicker from 'expo-image-picker'
import { useCallback, useState } from 'react'
import { Alert, Linking, Platform } from 'react-native'

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
  onEquipmentIdentified?: (equipmentName: string) => void
  onError?: (error: Error) => void
}

type ActionType = 'scan' | 'attach' | 'scan-equipment'

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
  const {
    onExtractionComplete,
    onImageAttached,
    onEquipmentIdentified,
    onError,
  } = options
  const [isProcessing, setIsProcessing] = useState(false)
  const [showModal, setShowModal] = useState(false)

  /**
   * Extract text from image using the Supabase Edge Function
   */
  const extractTextFromImage = useCallback(async (uri: string): Promise<
    ExtractedWorkoutData
  > => {
    // Import at call time to avoid issues with module resolution
    const { callSupabaseFunctionWithFormData } = await import(
      '@/lib/supabase-functions-client'
    )
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

    const response = await callSupabaseFunctionWithFormData(
      'extract-image',
      formData,
      token,
    )

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
   * Identify equipment from image using the Chat Edge Function
   */
  const identifyEquipmentFromImage = useCallback(async (uri: string): Promise<
    string
  > => {
    const { callSupabaseFunction } = await import(
      '@/lib/supabase-functions-client'
    )
    const { supabase } = await import('@/lib/supabase')

    // Resize image to reduce payload size and processing time
    // 512px is sufficient for identifying objects like dumbbells/machines
    const manipulated = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 512 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
    )

    const base64 = await FileSystem.readAsStringAsync(manipulated.uri, {
      encoding: FileSystem.EncodingType.Base64,
    })

    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData?.session?.access_token

    const response = await callSupabaseFunction(
      'chat',
      'POST',
      {
        messages: [
          {
            role: 'user',
            content:
              'Identify the specific gym equipment in this image. Be precise (e.g., "Leg Extension Machine", "Seated Leg Curl", "Incline Chest Press", "Smith Machine", "Cable Crossover"). Do not generalize (e.g., avoid just "Leg Press" if it is actually a hack squat or leg extension). Return ONLY the specific name of the equipment. If there are multiple, return the most prominent one. If none, return "unknown". Do not use markdown or extra punctuation. Just the name.',
          },
        ],
        images: [
          {
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${base64}` },
          },
        ],
      },
      {
        'x-no-stream': '1',
      },
      token,
    )

    if (!response.ok) {
      throw new Error('Failed to identify equipment')
    }

    const text = await response.text()
    // The response might be raw text or contain artifacts if it was a stream that completed.
    // If it's a stream response gathered as text, it should be just the content if the function outputs text.
    // But wait, the `chat` function returns `result.toTextStreamResponse`.
    // The raw text might be just the delta or the full text depending on how `ai` SDK works.
    // `streamText` output when consumed as text usually contains the full generation.
    return text.trim()
  }, [])

  /**
   * Process the selected image based on the chosen action
   */
  const processImage = useCallback(
    async (uri: string, action: ActionType) => {
      if (action === 'scan') {
        // Scan workout - extract text from image
        setIsProcessing(true)
        try {
          const data = await extractTextFromImage(uri)
          onExtractionComplete?.(data)
        } catch (error) {
          const errorObj =
            error instanceof Error ? error : new Error('Unknown error')
          onError?.(errorObj)

          Alert.alert(
            'Could Not Extract Workout',
            errorObj.message ||
              'Unable to extract workout information from the image. Please try again or enter it manually.',
            [{ text: 'OK' }],
          )
        } finally {
          setIsProcessing(false)
        }
      } else if (action === 'scan-equipment') {
        setIsProcessing(true)
        try {
          const name = await identifyEquipmentFromImage(uri)
          if (name && name.toLowerCase() !== 'unknown') {
            onEquipmentIdentified?.(name)
          } else {
            Alert.alert(
              'Equipment Not Identified',
              'Could not identify any gym equipment in the image.',
            )
          }
        } catch (error) {
          console.error('Error identifying equipment:', error)
          const errorObj =
            error instanceof Error ? error : new Error('Unknown error')
          onError?.(errorObj)
          Alert.alert(
            'Error',
            'Failed to identify equipment. Please try again.',
            [{ text: 'OK' }],
          )
        } finally {
          setIsProcessing(false)
        }
      } else {
        // Attach photo - just pass the URI
        onImageAttached?.(uri)
      }
    },
    [
      extractTextFromImage,
      identifyEquipmentFromImage,
      onExtractionComplete,
      onEquipmentIdentified,
      onImageAttached,
      onError,
    ],
  )

  /**
   * Launch camera with the selected action
   */
  const launchCamera = useCallback(
    async (action: ActionType) => {
      try {
        // Check current permission status
        const currentStatus = await ImagePicker.getCameraPermissionsAsync()

        // If permission was previously denied, guide user to settings
        if (currentStatus.status === 'denied' && !currentStatus.canAskAgain) {
          Alert.alert(
            'Camera Access Needed',
            Platform.select({
              ios:
                'To take photos, please enable camera access in Settings > Rep AI > Camera.',
              android:
                'To take photos, please enable camera access in Settings > Apps > Rep AI > Permissions.',
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
    },
    [processImage],
  )

  /**
   * Launch library picker with the selected action
   */
  const launchLibrary = useCallback(
    async (action: ActionType) => {
      try {
        // Check current permission status
        const currentStatus = await ImagePicker.getMediaLibraryPermissionsAsync()

        // If permission was previously denied, guide user to settings
        if (currentStatus.status === 'denied' && !currentStatus.canAskAgain) {
          Alert.alert(
            'Photo Library Access Needed',
            Platform.select({
              ios:
                'To select photos, please enable photo library access in Settings > Rep AI > Photos.',
              android:
                'To select photos, please enable storage access in Settings > Apps > Rep AI > Permissions.',
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

        const result = await ImagePicker.launchImageLibraryAsync(
          IMAGE_PICKER_OPTIONS,
        )

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
    },
    [processImage],
  )

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

  const handleScanEquipment = useCallback(() => {
    launchCamera('scan-equipment')
  }, [launchCamera])

  return {
    isProcessing,
    pickImage,
    showModal,
    closeModal,
    handleScanWithCamera,
    handleScanWithLibrary,
    handleAttachWithCamera,
    handleAttachWithLibrary,
    handleScanEquipment,
  }
}
