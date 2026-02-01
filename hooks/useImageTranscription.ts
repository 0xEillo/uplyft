import * as FileSystem from 'expo-file-system/legacy'
import * as ImagePicker from 'expo-image-picker'
import { useCallback, useState } from 'react'
import { Alert, Linking, Platform } from 'react-native'

// Lazy import expo-image-manipulator to avoid crashes in Expo Go (requires native module)
let ImageManipulator: typeof import('expo-image-manipulator') | null = null
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ImageManipulator = require('expo-image-manipulator')
} catch {
  // Module not available in Expo Go
}

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
  /** New structured exercises array from API */
  exercises?: {
    name: string
    sets: { weight: string; reps: string }[]
  }[]
}

/**
 * Parsed set data from scanned workout
 */
interface ParsedSetData {
  weight: string
  reps: string
}

/**
 * Parsed exercise data from scanned workout
 * Matches the StructuredExerciseDraft format used in structured-workout-input
 */
export interface ParsedExerciseData {
  id: string
  name: string
  sets: ParsedSetData[]
}

interface UseImageTranscriptionOptions {
  onExtractionComplete?: (data: ExtractedWorkoutData) => void
  /** Callback when structured workout data is extracted and parsed from image */
  onStructuredExtractionComplete?: (data: {
    title?: string
    description?: string
    exercises: ParsedExerciseData[]
  }) => void
  onImageAttached?: (uri: string) => void
  onEquipmentIdentified?: (equipmentName: string) => void
  onError?: (error: Error) => void
}

type ActionType = 'scan' | 'attach' | 'scan-equipment'

export interface UseImageTranscriptionResult {
  isProcessing: boolean
  pickImage: () => void
  showModal: boolean
  closeModal: () => void
  handleScanWithCamera: () => void
  handleScanWithLibrary: () => void
  handleAttachWithCamera: () => void
  handleAttachWithLibrary: () => void
  handleScanEquipment: () => void
  handleScanWorkout: () => void
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
): UseImageTranscriptionResult {
  const {
    onExtractionComplete,
    onStructuredExtractionComplete,
    onImageAttached,
    onEquipmentIdentified,
    onError,
  } = options
  const [isProcessing, setIsProcessing] = useState(false)
  const [showModal, setShowModal] = useState(false)

  /**
   * Extract text from image using the Supabase Edge Function
   */
  const extractTextFromImage = useCallback(async function extractTextFromImage(
    uri: string,
  ): Promise<ExtractedWorkoutData> {
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
  },
  [])

  /**
   * Parse workout text into structured exercise data.
   * Handles formats like:
   * Exercise Name
   *   135 x 8
   *   155 x 6
   *   165 x 4 x 2 (weight x reps x sets)
   */
  const parseWorkoutText = useCallback(function parseWorkoutText(
    workoutText: string,
  ): ParsedExerciseData[] {
    if (!workoutText.trim()) {
      console.log('[useImageTranscription] No workout text to parse')
      return []
    }

    console.log(
      '[useImageTranscription] Starting parse of workout text:',
      workoutText.substring(0, 100) + '...',
    )

    // Set patterns:
    // 1) weight x reps x sets: "135 x 8 x 3"
    // 2) weight x reps: "135 x 8"
    // 3) sets only: "3 sets" / "3 sets for 30 seconds"
    // 4) reps only: "10 reps"
    // Note: Weight pattern accepts both period and comma as decimal separators (e.g., "7.5" or "7,5")
    const setPattern = /^[\s]*(\d+(?:[.,]\d+)?)\s*(?:lbs?|kg)?\s*[x×]\s*(\d+)(?:\s*[x×]\s*(\d+))?/i
    const setsOnlyPattern = /^[\s]*(\d+)\s*sets?(?:\s*for\s*(.*))?/i
    const repsOnlyPattern = /^[\s]*(\d+)\s*reps?/i

    const lines = workoutText.split('\n')
    const exercises: ParsedExerciseData[] = []
    let currentExercise: ParsedExerciseData | null = null

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim()
      if (!trimmed) continue

      const setMatch = trimmed.match(setPattern)
      const setsOnlyMatch = trimmed.match(setsOnlyPattern)
      const repsOnlyMatch = trimmed.match(repsOnlyPattern)

      const isSetLine = Boolean(setMatch || setsOnlyMatch || repsOnlyMatch)
      if (!isSetLine) {
        if (currentExercise && currentExercise.sets.length > 0) {
          exercises.push(currentExercise)
        }

        currentExercise = {
          id: `scanned-${Date.now()}-${i}`,
          name: trimmed.replace(/[:]$/, ''),
          sets: [],
        }
        console.log(
          `[useImageTranscription] Potential exercise/category: ${trimmed}`,
        )
        continue
      }

      // If we don't have an exercise yet, create a generic one
      if (!currentExercise) {
        currentExercise = {
          id: `scanned-${Date.now()}-${i}`,
          name: 'Exercise',
          sets: [],
        }
      }

      if (setMatch) {
        // Normalize decimal separator: replace comma with period (for European locales)
        const weight = setMatch[1].replace(',', '.')
        const reps = setMatch[2]
        const multiplier = setMatch[3] ? parseInt(setMatch[3], 10) : 1

        console.log(
          `[useImageTranscription] Found set: ${weight} x ${reps} (x${multiplier})`,
        )

        for (let j = 0; j < multiplier; j++) {
          currentExercise.sets.push({ weight, reps })
        }
        continue
      }

      if (setsOnlyMatch) {
        const setsCount = parseInt(setsOnlyMatch[1], 10)
        const notes = setsOnlyMatch[2] || ''
        console.log(
          `[useImageTranscription] Found sets only: ${setsCount} sets`,
        )

        for (let j = 0; j < setsCount; j++) {
          currentExercise.sets.push({
            weight: '',
            reps: notes.includes('sec') ? notes : '',
          })
        }
        continue
      }

      if (repsOnlyMatch) {
        const reps = repsOnlyMatch[1]
        console.log(`[useImageTranscription] Found reps only: ${reps} reps`)
        currentExercise.sets.push({ weight: '', reps })
      }
    }

    if (currentExercise && currentExercise.sets.length > 0) {
      exercises.push(currentExercise)
    }

    console.log(
      `[useImageTranscription] Parsing complete. Found ${exercises.length} exercises.`,
    )
    return exercises
  },
  [])

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
    if (!ImageManipulator) {
      throw new Error(
        'Equipment scanning is not available in Expo Go. Please use a development build.',
      )
    }
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
    async function processImage(uri: string, action: ActionType) {
      switch (action) {
        case 'scan': {
          // Scan workout - extract text from image
          setIsProcessing(true)
          try {
            const data = await extractTextFromImage(uri)

            console.log('[useImageTranscription] API response:', {
              hasExercises: Boolean(data.exercises),
              exercisesCount: data.exercises?.length,
              workoutLength: data.workout?.length,
            })

            // Prefer structured exercises from API (new format)
            let structuredExercises: ParsedExerciseData[] = []

            if (Array.isArray(data.exercises) && data.exercises.length > 0) {
              console.log(
                '[useImageTranscription] Using structured exercises from API',
              )
              structuredExercises = data.exercises.map((ex, index) => ({
                id: `scanned-${Date.now()}-${index}`,
                name: ex.name,
                sets: ex.sets.map((set) => ({
                  weight: set.weight || '',
                  reps: set.reps || '',
                })),
              }))
            } else if (data.workout) {
              console.log(
                '[useImageTranscription] Falling back to text parsing',
              )
              structuredExercises = parseWorkoutText(data.workout)
            }

            console.log('[useImageTranscription] Structured exercises:', {
              count: structuredExercises.length,
              names: structuredExercises.map((e) => e.name),
            })

            if (
              onStructuredExtractionComplete &&
              structuredExercises.length > 0
            ) {
              onStructuredExtractionComplete({
                title: data.title,
                description: data.description,
                exercises: structuredExercises,
              })
            } else if (structuredExercises.length === 0) {
              console.log('[useImageTranscription] No exercises found in image')
              Alert.alert(
                'No Exercises Found',
                "We couldn't find any exercises in this image. Make sure the image clearly shows exercise names with sets or reps.",
                [{ text: 'OK' }],
              )
            } else {
              console.log(
                '[useImageTranscription] Falling back to onExtractionComplete',
              )
              onExtractionComplete?.(data)
            }
          } catch (error) {
            const errorObj =
              error instanceof Error ? error : new Error('Unknown error')
            onError?.(errorObj)

            let title = 'Could Not Extract Workout'
            let message =
              'Unable to extract workout information from the image. Please try again or enter your workout manually.'

            const errorMessage = errorObj.message?.toLowerCase() || ''
            if (
              errorMessage.includes('not appear to contain workout') ||
              errorMessage.includes('not workout-related')
            ) {
              title = 'Not a Workout Image'
              message =
                "This image doesn't appear to contain workout information. Please select an image with exercise names, sets, or reps."
            } else if (
              errorMessage.includes('failed to process') ||
              errorMessage.includes('timeout')
            ) {
              title = 'Processing Failed'
              message =
                'We had trouble processing this image. Please try again with a clearer photo.'
            }

            Alert.alert(title, message, [{ text: 'OK' }])
          } finally {
            setIsProcessing(false)
          }
          return
        }
        case 'scan-equipment': {
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
          return
        }
        default: {
          // Attach photo - just pass the URI
          onImageAttached?.(uri)
        }
      }
    },
    [
      extractTextFromImage,
      parseWorkoutText,
      identifyEquipmentFromImage,
      onExtractionComplete,
      onStructuredExtractionComplete,
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

  const handleScanWorkout = useCallback(() => {
    launchLibrary('scan')
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
    handleScanEquipment,
    handleScanWorkout,
  }
}
