import { Paywall } from '@/components/paywall'
import {
  WorkoutPlanningData,
  WorkoutPlanningWizard,
} from '@/components/workout-planning-wizard'
import { AnalyticsEvents } from '@/constants/analytics-events'
import { useAnalytics } from '@/contexts/analytics-context'
import { useAuth } from '@/contexts/auth-context'
import { useSubscription } from '@/contexts/subscription-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import {
  convertAiPlanToRoutine,
  convertAiPlanToWorkout,
} from '@/lib/ai/ai-workout-converter'
import { database } from '@/lib/database'
import { supabase } from '@/lib/supabase'
import { saveDraft } from '@/lib/utils/workout-draft'
import { Ionicons } from '@expo/vector-icons'
import * as FileSystem from 'expo-file-system/legacy'
import * as Haptics from 'expo-haptics'
import * as ImagePicker from 'expo-image-picker'
import { router } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler'
import 'react-native-get-random-values'
import Markdown from 'react-native-markdown-display'
import AnimatedReanimated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  images?: string[] // Image URIs for display
}

interface PlanningState {
  isActive: boolean
  step: 'wizard' | 'none'
  data: Partial<WorkoutPlanningData>
}

interface ParsedWorkoutDisplay {
  description: string
  title: string
  duration: string
  exercises: {
    name: string
    sets: {
      type: 'warmup' | 'working'
      weight: string
      reps: string
      rest: number
    }[]
  }[]
}

type SuggestionMode = 'main' | 'tell_me_about' | 'how_to'

const SUGGESTIONS = {
  main: [
    {
      id: 'tell_me_about',
      text: 'Tell me about...',
      icon: 'book-outline',
    },
    { id: 'how_to', text: 'How to...', icon: 'help-circle-outline' },
  ],
  tell_me_about: [
    'Progressive overload',
    'Muscle recovery',
    'One rep max',
    'RPE',
    'Hypertrophy',
    'Deload weeks',
  ],
  how_to: [
    'Back Squat',
    'Barbell Row',
    'Bench Press',
    'Deadlift',
    'Overhead Press',
  ],
}

const MAX_IMAGES = 10

// Parse workout from AI response text for display
function parseWorkoutForDisplay(text: string): ParsedWorkoutDisplay | null {
  try {
    // Try parsing as JSON first
    const jsonMatch =
      text.match(/```json\s*([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const jsonStr = jsonMatch[1] || jsonMatch[0]
      const data = JSON.parse(jsonStr)

      // Validate structure
      if (!data.exercises || !Array.isArray(data.exercises)) return null

      return {
        description: data.description || '',
        title: data.title || 'Generated Workout',
        duration: data.estimatedDuration
          ? `${data.estimatedDuration}:00`
          : '45:00',
        exercises: data.exercises.map((ex: any) => ({
          name: ex.name,
          sets: ex.sets.map((s: any) => ({
            type: s.type || 'working',
            weight: s.weight || '',
            reps: s.reps || '',
            rest: s.restSeconds || s.rest || 60,
          })),
        })),
      }
    }

    // Fallback to text parsing (legacy support)
    // Extract description - usually first paragraph before workout title/details
    const lines = text.split('\n').filter((l) => l.trim())
    let description = ''
    let title = 'Generated Workout'
    let foundWorkoutStart = false

    // Find description (text before workout structure)
    for (const line of lines) {
      const trimmed = line.trim()
      // Check for workout title patterns
      if (
        trimmed.match(/^##?\s/) ||
        trimmed.match(/^\*\*.*workout/i) ||
        trimmed.match(/^#.*workout/i)
      ) {
        foundWorkoutStart = true
        // Extract title
        title = trimmed
          .replace(/^[#*\s]+/, '')
          .replace(/[*]+$/, '')
          .trim()
        break
      }
      if (!foundWorkoutStart && trimmed && !trimmed.startsWith('-')) {
        description += (description ? ' ' : '') + trimmed
      }
    }

    // Extract exercises
    const exercises: ParsedWorkoutDisplay['exercises'] = []
    const exerciseRegex = /(?:^|\n)[-*•\d.]+\s*\*?\*?([A-Z][^:\n*]+?)\*?\*?\s*(?:[-–:]|$)/gim
    const exerciseMatches = text.matchAll(exerciseRegex)

    for (const match of exerciseMatches) {
      const name = match[1].trim().replace(/\*+/g, '')
      if (name.length < 3 || name.length > 50) continue
      if (
        name.toLowerCase().includes('warm') &&
        name.toLowerCase().includes('up')
      )
        continue

      // Find sets info near this exercise
      const afterMatch = text.slice(match.index || 0, (match.index || 0) + 200)
      const setsMatch = afterMatch.match(/(\d+)\s*(?:sets?|x)/i)
      const repsMatch = afterMatch.match(/(\d+)[-–]?(\d+)?\s*(?:reps?|rep)/i)

      const setsCount = setsMatch ? parseInt(setsMatch[1]) : 3
      const repsRange = repsMatch
        ? repsMatch[2]
          ? `${repsMatch[1]}-${repsMatch[2]}`
          : repsMatch[1]
        : '8-12'

      // Create dummy sets for display
      const sets = Array(setsCount).fill({
        type: 'working',
        weight: '',
        reps: repsRange,
        rest: 60,
      })

      exercises.push({
        name,
        sets,
      })
    }

    // If regex didn't find exercises, try line-by-line pattern
    if (exercises.length === 0) {
      for (const line of lines) {
        const trimmed = line.trim()
        // Pattern: "1. Exercise Name" or "- Exercise Name" or "**Exercise Name**"
        const exerciseLineMatch = trimmed.match(
          /^(?:[-*•]|\d+[.)])\s*\*?\*?([A-Z][^:*\n]+)/i,
        )
        if (exerciseLineMatch) {
          const name = exerciseLineMatch[1].trim().replace(/\*+/g, '')
          if (name.length >= 3 && name.length <= 50) {
            const setsMatch = trimmed.match(/(\d+)\s*(?:sets?|x)/i)
            const repsMatch = trimmed.match(/(\d+)[-–]?(\d+)?\s*(?:reps?|rep)/i)

            const setsCount = setsMatch ? parseInt(setsMatch[1]) : 3
            const repsRange = repsMatch
              ? repsMatch[2]
                ? `${repsMatch[1]}-${repsMatch[2]}`
                : repsMatch[1]
              : '8-12'

            const sets = Array(setsCount).fill({
              type: 'working',
              weight: '',
              reps: repsRange,
              rest: 60,
            })

            exercises.push({
              name,
              sets,
            })
          }
        }
      }
    }

    // Estimate duration based on exercises and sets
    const totalSets = exercises.reduce((sum, ex) => sum + ex.sets.length, 0)
    const estimatedMinutes = Math.round(totalSets * 2.5 + 5) // ~2.5 min per set + warmup
    const duration = `${estimatedMinutes}:00`

    if (exercises.length === 0) return null

    return {
      description:
        description.slice(0, 300) || "Here's your personalized workout plan.",
      title,
      duration,
      exercises: exercises.slice(0, 12), // Cap at 12 exercises
    }
  } catch {
    return null
  }
}

// Get icon for exercise - always return barbell as requested
function getExerciseIcon(exerciseName: string): 'barbell-outline' {
  return 'barbell-outline'
}

export function WorkoutChat() {
  const scrollViewRef = useRef<ScrollView>(null)
  const inputRef = useRef<TextInput>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showPaywall, setShowPaywall] = useState(false)
  const [selectedImages, setSelectedImages] = useState<string[]>([])
  const [showImagePickerModal, setShowImagePickerModal] = useState(false)
  const [viewerImages, setViewerImages] = useState<string[]>([])
  const [viewerImageIndex, setViewerImageIndex] = useState<number | null>(null)
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false)
  const [planningState, setPlanningState] = useState<PlanningState>({
    isActive: false,
    step: 'none',
    data: {},
  })
  const [generatedPlanContent, setGeneratedPlanContent] = useState<
    string | null
  >(null)
  const [
    parsedWorkout,
    setParsedWorkout,
  ] = useState<ParsedWorkoutDisplay | null>(null)
  const [isWorkoutExpanded, setIsWorkoutExpanded] = useState(false)
  const [expandedExerciseIndices, setExpandedExerciseIndices] = useState<
    number[]
  >([])
  const [suggestionMode, setSuggestionMode] = useState<SuggestionMode>('main')
  const translateY = useSharedValue(0)
  const { user, session } = useAuth()
  const { isProMember } = useSubscription()
  const { trackEvent } = useAnalytics()
  const colors = useThemedColors()
  const { weightUnit } = useWeightUnits()
  const insets = useSafeAreaInsets()

  // Auto-scroll to bottom when new messages arrive or content changes
  const scrollToBottom = () => {
    scrollViewRef.current?.scrollToEnd({ animated: true })
  }

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom()
    }
  }, [messages.length])

  // Scroll to bottom when buttons appear (to ensure they're visible)
  useEffect(() => {
    if (generatedPlanContent) {
      // Small delay to ensure buttons are rendered before scrolling
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true })
      }, 100)
    }
  }, [generatedPlanContent])

  // Scroll to bottom when keyboard appears
  useEffect(() => {
    const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setIsKeyboardVisible(true)
        setTimeout(() => scrollToBottom(), 100)
      },
    )

    const keyboardWillHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setIsKeyboardVisible(false)
      },
    )

    return () => {
      keyboardWillShowListener.remove()
      keyboardWillHideListener.remove()
    }
  }, [])

  // Reset bottom sheet position when modal opens
  useEffect(() => {
    if (showImagePickerModal) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      translateY.value = 0
    }
  }, [showImagePickerModal, translateY])

  // Bottom sheet swipe-down gesture
  const closeImagePickerSheet = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setShowImagePickerModal(false)
  }

  const pan = Gesture.Pan()
    .onUpdate((event) => {
      if (event.translationY > 0) {
        translateY.value = event.translationY
      }
    })
    .onEnd((event) => {
      if (event.translationY > 100 || event.velocityY > 1000) {
        translateY.value = withTiming(500, { duration: 200 }, () => {
          runOnJS(closeImagePickerSheet)()
        })
      } else {
        translateY.value = withSpring(0, {
          damping: 20,
          stiffness: 300,
        })
      }
    })

  const animatedBottomSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }))

  // Convert image URI to base64
  const convertImageToBase64 = async (uri: string): Promise<string> => {
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      })
      return base64
    } catch (error) {
      console.error('Error converting image to base64:', error)
      throw error
    }
  }

  // Launch camera
  const launchCamera = async () => {
    setShowImagePickerModal(false)

    try {
      const currentStatus = await ImagePicker.getCameraPermissionsAsync()

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

      const permission = await ImagePicker.requestCameraPermissionsAsync()

      if (permission.status !== 'granted') {
        Alert.alert(
          'Camera Permission Required',
          'Rep AI needs camera access to take photos. You can enable this in your device settings.',
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

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images' as any,
        allowsEditing: false,
        quality: 0.8,
      })

      if (!result.canceled && result.assets[0]) {
        if (selectedImages.length < MAX_IMAGES) {
          setSelectedImages((prev) => [...prev, result.assets[0].uri])
        } else {
          Alert.alert(
            'Maximum Images Reached',
            `You can only add up to ${MAX_IMAGES} images per message.`,
          )
        }
      }
    } catch (error) {
      console.error('Error launching camera:', error)
      Alert.alert(
        'Camera Error',
        'Failed to open camera. Please check your camera permissions in device settings.',
      )
    }
  }

  // Launch photo library
  const launchLibrary = async () => {
    setShowImagePickerModal(false)

    try {
      const currentStatus = await ImagePicker.getMediaLibraryPermissionsAsync()

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

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()

      if (permission.status !== 'granted') {
        Alert.alert(
          'Photo Library Permission Required',
          'Rep AI needs photo library access to select photos. You can enable this in your device settings.',
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

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images' as any,
        allowsEditing: false,
        quality: 0.8,
        allowsMultipleSelection: true,
        selectionLimit: MAX_IMAGES - selectedImages.length,
      })

      if (!result.canceled && result.assets.length > 0) {
        const newImages = result.assets.map((asset) => asset.uri)
        const totalImages = selectedImages.length + newImages.length

        if (totalImages <= MAX_IMAGES) {
          setSelectedImages((prev) => [...prev, ...newImages])
        } else {
          Alert.alert(
            'Maximum Images Reached',
            `You can only add up to ${MAX_IMAGES} images per message. Selected ${newImages.length} images would exceed the limit.`,
          )
        }
      }
    } catch (error) {
      console.error('Error launching library:', error)
      Alert.alert(
        'Photo Library Error',
        'Failed to open photo library. Please check your photo library permissions in device settings.',
      )
    }
  }

  // Remove image from selection
  const removeImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index))
  }

  // Open image viewer
  const openImageViewer = (images: string[], startIndex: number) => {
    setViewerImages(images)
    setViewerImageIndex(startIndex)
  }

  // Close image viewer
  const closeImageViewer = () => {
    setViewerImageIndex(null)
    setViewerImages([])
  }

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return

    // Check if user is pro member
    if (!isProMember) {
      setShowPaywall(true)
      trackEvent(AnalyticsEvents.PAYWALL_SHOWN, {
        feature: 'ai_chat',
      })
      return
    }

    // Store input and images before clearing
    const messageContent = input.trim()
    const imagesToSend = [...selectedImages]

    // Clear input immediately after validation
    setInput('')
    setSelectedImages([])

    // Force blur and clear the TextInput to prevent race conditions
    inputRef.current?.clear()
    Keyboard.dismiss()

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageContent,
      images: imagesToSend.length > 0 ? imagesToSend : undefined,
    }
    setMessages((prev) => [...prev, userMessage])

    let hiddenPromptContent: string | undefined

    // Handle Planning Flow (if text based fallback is needed, though we use wizard now)
    // We'll keep this logic simple or remove it if we fully switch to wizard.
    // For now, let's assume we only trigger the wizard via button.

    setIsLoading(true)

    try {
      const { getSupabaseFunctionBaseUrl } = await import(
        '@/lib/supabase-functions-client'
      )

      // Convert images to base64 if any
      const imageBase64Array: string[] = []
      if (imagesToSend.length > 0) {
        for (const imageUri of imagesToSend) {
          try {
            const base64 = await convertImageToBase64(imageUri)
            imageBase64Array.push(base64)
          } catch (error) {
            console.error('Error converting image:', error)
          }
        }
      }

      // Format messages for API - keep content as string
      const formattedMessages = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }))

      // Check if we have a hidden prompt content from the planning flows
      if (typeof hiddenPromptContent !== 'undefined') {
        // Replace the last user message content with the full prompt for the AI
        formattedMessages[
          formattedMessages.length - 1
        ].content = hiddenPromptContent
      } else {
        // If we already generated a workout/routine, and the user is sending a new message,
        // we assume they might be refining it.
        if (generatedPlanContent) {
          const lastMsg = formattedMessages[formattedMessages.length - 1]
          lastMsg.content +=
            '\n\n(If this request involves modifying the workout plan, please output the FULL updated workout routine details (exercises, sets, reps) in your response, not just the changes. I need the complete routine to start the workout.)'
        }
      }

      // Prepare request body with images as separate field
      const requestBody: any = {
        messages: formattedMessages,
        userId: user?.id,
        weightUnit,
      }

      // Add images array if present
      if (imageBase64Array.length > 0) {
        requestBody.images = imageBase64Array.map((base64) => ({
          type: 'image_url',
          image_url: {
            url: `data:image/jpeg;base64,${base64}`,
          },
        }))
      }

      const response = await fetch(`${getSupabaseFunctionBaseUrl()}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-no-stream': '1',
          ...(session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Chat API error:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        })
        throw new Error(
          `Failed to get response: ${response.status} ${response.statusText}`,
        )
      }

      const assistantMessageId = (Date.now() + 1).toString()
      // create placeholder assistant message for streaming
      setMessages((prev) => [
        ...prev,
        { id: assistantMessageId, role: 'assistant', content: '' },
      ])

      const reader = response.body?.getReader()
      if (!reader) {
        // Fallback: non-streaming response
        const assistantContent = await response.text()
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId
              ? {
                  ...m,
                  content:
                    assistantContent ||
                    'I received an empty response. Please try again.',
                }
              : m,
          ),
        )
      } else {
        const decoder = new TextDecoder()
        let buffer = ''
        let acc = ''
        let ndjsonMode: boolean | null = null

        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })

          if (ndjsonMode === null) {
            const firstNonWs = chunk.trimStart()[0]
            ndjsonMode = firstNonWs === '{' || chunk.startsWith('data:')
          }

          if (!ndjsonMode) {
            // plain text mode
            acc += chunk
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMessageId ? { ...m, content: acc } : m,
              ),
            )
            continue
          }

          buffer += chunk
          let newlineIndex: number
          while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
            let line = buffer.slice(0, newlineIndex).trim()
            buffer = buffer.slice(newlineIndex + 1)

            if (!line) continue
            if (line.startsWith('data:')) line = line.slice(5).trim()
            if (!line || line === '[DONE]') continue

            try {
              const evt = JSON.parse(line)
              // Accept common shapes
              if (
                evt.type === 'text-delta' &&
                typeof evt.textDelta === 'string'
              ) {
                acc += evt.textDelta
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessageId ? { ...m, content: acc } : m,
                  ),
                )
              } else if (
                evt.type === 'message' &&
                typeof evt.text === 'string'
              ) {
                acc += evt.text
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessageId ? { ...m, content: acc } : m,
                  ),
                )
              } else {
                // ignore tool-call/tool-result/status events for now
              }
            } catch {
              // Not JSON, treat as plain text fragment
              acc += line
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMessageId ? { ...m, content: acc } : m,
                ),
              )
            }
          }
        }

        // flush any remaining buffer in NDJSON mode (may be a final partial JSON or text)
        if (buffer && ndjsonMode) {
          const line = buffer.trim()
          if (line && line !== '[DONE]') {
            try {
              const evt = JSON.parse(line)
              if (
                evt.type === 'text-delta' &&
                typeof evt.textDelta === 'string'
              ) {
                acc += evt.textDelta
              } else if (
                evt.type === 'message' &&
                typeof evt.text === 'string'
              ) {
                acc += evt.text
              } else if (typeof line === 'string') {
                acc += line
              }
            } catch {
              acc += line
            }
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMessageId ? { ...m, content: acc } : m,
              ),
            )
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error)
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: "Sorry, I couldn't process that request. Please try again.",
        },
      ])
    } finally {
      setIsLoading(false)
      // Note: We don't automatically set generatedPlanContent here for normal chat messages
      // unless we detect it's a plan, but currently we rely on wizard completion.
      // However, if the user asks for refinement, we should probably treat the response as a plan.
      // For simplicity, if we already had a plan, we assume the new response is also a plan (refinement).
      if (generatedPlanContent) {
        // We need to get the actual content from the state update which is async/batched.
        // But here in finally, we can't access the updated state easily.
        // So we'll rely on the streaming logic to update state messages,
        // and we might need to find the last assistant message.
        // Actually, for refinements, we might want to "re-enable" the buttons if they were hidden?
        // They stay visible because generatedPlanContent is state.
      }
    }
  }

  const handleExampleQuestion = (question: string) => {
    if (question === 'Plan Workout') {
      // Launch the new wizard UI
      setPlanningState({
        isActive: true,
        step: 'wizard',
        data: {},
      })
      return
    }

    // For other questions, check pro status first
    if (!isProMember) {
      setShowPaywall(true)
      trackEvent(AnalyticsEvents.PAYWALL_SHOWN, {
        feature: 'ai_chat',
      })
      return
    }

    setInput(question)
  }

  const handleNewChat = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setMessages([])
    setInput('')
    setSelectedImages([])
    setPlanningState({
      isActive: false,
      step: 'none',
      data: {},
    })
    setGeneratedPlanContent(null)
    setParsedWorkout(null)
    setIsWorkoutExpanded(false)
    setSuggestionMode('main')
    inputRef.current?.clear()
    Keyboard.dismiss()
  }

  const handleSuggestionClick = (
    item: string | { id: string; text: string },
  ) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    if (suggestionMode === 'main' && typeof item === 'object') {
      if (item.id === 'tell_me_about') {
        setSuggestionMode('tell_me_about')
        setInput('Tell me about ')
      } else if (item.id === 'how_to') {
        setSuggestionMode('how_to')
        setInput('How to ')
      }
      inputRef.current?.focus()
    } else if (typeof item === 'string') {
      setInput((prev) => prev + item)
      setSuggestionMode('main')
      inputRef.current?.focus()
    }
  }

  const handleSuggestionBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSuggestionMode('main')
    if (input === 'Tell me about ' || input === 'How to ') {
      setInput('')
    }
  }

  const handleWizardComplete = async (wizardData: WorkoutPlanningData) => {
    // Check if user is pro member
    if (!isProMember) {
      setShowPaywall(true)
      trackEvent(AnalyticsEvents.PAYWALL_SHOWN, {
        feature: 'ai_workout_generation',
      })
      return
    }

    // Reset wizard state
    setPlanningState({
      isActive: false,
      step: 'none',
      data: {},
    })

    // Build the equipment label for display
    const equipmentLabels: Record<string, string> = {
      full_gym: 'Full Gym',
      dumbbells_only: 'Dumbbells Only',
      home_minimal: 'Home / Minimal Equipment',
      bodyweight: 'Bodyweight Only',
      barbell_only: 'Barbell Only',
    }
    const equipmentLabel =
      equipmentLabels[wizardData.equipment] || wizardData.equipment

    // Construct the hidden prompt for the AI
    const finalPrompt = `Create a reusable workout routine (a single workout template the user can save and reuse).
Focus/Goal: ${wizardData.goal}
Muscle Groups: ${wizardData.muscles}
Target Duration: ${wizardData.duration}
Equipment Available: ${equipmentLabel}
Custom Specifications: ${wizardData.specifics || 'None'}

IMPORTANT: You must output ONLY a JSON object with the following structure:
{
  "title": "Creative Workout Title",
  "description": "Brief 1-2 sentence description of the workout intent.",
  "estimatedDuration": 45,
  "exercises": [
    {
      "name": "Exact Exercise Name",
      "sets": [
        {
          "type": "warmup" | "working",
          "reps": "12" | "8-10" | "AMRAP",
          "weight": "Bar" | "135 lbs" | "Bodyweight",
          "restSeconds": 60
        }
      ]
    }
  ]
}
Do not wrap in markdown code blocks. Do not add intro/outro text. Just the JSON.`

    // Now call the API
    setIsLoading(true)

    try {
      const { getSupabaseFunctionBaseUrl } = await import(
        '@/lib/supabase-functions-client'
      )

      const formattedMessages = [
        ...messages,
        { role: 'user', content: finalPrompt },
      ]

      const requestBody: any = {
        messages: formattedMessages,
        userId: user?.id,
        weightUnit,
      }

      const response = await fetch(`${getSupabaseFunctionBaseUrl()}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-no-stream': '1',
          ...(session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Chat API error:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        })
        throw new Error(
          `Failed to get response: ${response.status} ${response.statusText}`,
        )
      }

      const assistantMessageId = (Date.now() + 1).toString()

      const reader = response.body?.getReader()
      if (!reader) {
        const assistantContent = await response.text()
        setMessages((prev) => [
          ...prev,
          {
            id: assistantMessageId,
            role: 'assistant',
            content:
              assistantContent ||
              'I received an empty response. Please try again.',
          },
        ])
        setGeneratedPlanContent(assistantContent)
        // Parse workout for structured display
        const parsed = parseWorkoutForDisplay(assistantContent)
        setParsedWorkout(parsed)
        setIsWorkoutExpanded(false)
      } else {
        // Create placeholder message for streaming
        setMessages((prev) => [
          ...prev,
          { id: assistantMessageId, role: 'assistant', content: '' },
        ])

        const decoder = new TextDecoder()
        let acc = ''
        let buffer = ''
        // Use null to indicate "not yet determined" - fixes NDJSON detection bug
        let ndjsonMode: boolean | null = null

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })

          // Auto-detect mode on first chunk
          if (ndjsonMode === null) {
            const firstNonWs = chunk.trimStart()[0]
            ndjsonMode = firstNonWs === '{' || chunk.startsWith('data:')
          }

          if (!ndjsonMode) {
            // Plain text mode - accumulate all chunks
            acc += chunk
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMessageId ? { ...m, content: acc } : m,
              ),
            )
            continue
          }

          buffer += chunk
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            let trimmed = line.trim()
            if (!trimmed || trimmed === '[DONE]') continue

            // Handle SSE format
            if (trimmed.startsWith('data:')) trimmed = trimmed.slice(5).trim()
            if (!trimmed || trimmed === '[DONE]') continue

            try {
              const evt = JSON.parse(trimmed)
              if (
                evt.type === 'text-delta' &&
                typeof evt.textDelta === 'string'
              ) {
                acc += evt.textDelta
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessageId ? { ...m, content: acc } : m,
                  ),
                )
              } else if (
                evt.type === 'message' &&
                typeof evt.text === 'string'
              ) {
                acc += evt.text
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessageId ? { ...m, content: acc } : m,
                  ),
                )
              }
            } catch {
              // Not JSON, treat as plain text
              acc += trimmed
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMessageId ? { ...m, content: acc } : m,
                ),
              )
            }
          }
        }

        // Flush remaining buffer
        if (buffer && ndjsonMode) {
          let line = buffer.trim()
          if (line.startsWith('data:')) line = line.slice(5).trim()
          if (line && line !== '[DONE]') {
            try {
              const evt = JSON.parse(line)
              if (
                evt.type === 'text-delta' &&
                typeof evt.textDelta === 'string'
              ) {
                acc += evt.textDelta
              } else if (
                evt.type === 'message' &&
                typeof evt.text === 'string'
              ) {
                acc += evt.text
              }
            } catch {
              acc += line
            }
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMessageId ? { ...m, content: acc } : m,
              ),
            )
          }
        }
        setGeneratedPlanContent(acc)
        // Parse workout for structured display
        const parsed = parseWorkoutForDisplay(acc)
        setParsedWorkout(parsed)
        setIsWorkoutExpanded(false)
      }
    } catch (error) {
      console.error('Chat error:', error)
      // Only add error message - don't create duplicate placeholder
      setMessages((prev) => {
        // Check if last message is an empty assistant placeholder we created
        const lastMsg = prev[prev.length - 1]
        if (lastMsg?.role === 'assistant' && lastMsg.content === '') {
          // Update the empty placeholder with error message
          return prev.map((m, idx) =>
            idx === prev.length - 1
              ? {
                  ...m,
                  content:
                    "Sorry, I couldn't process that request. Please try again.",
                }
              : m,
          )
        }
        // Otherwise add new error message
        return [
          ...prev,
          {
            id: Date.now().toString(),
            role: 'assistant',
            content:
              "Sorry, I couldn't process that request. Please try again.",
          },
        ]
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleWizardCancel = () => {
    setPlanningState({
      isActive: false,
      step: 'none',
      data: {},
    })
  }

  const handleStartWorkout = async () => {
    if (isLoading) return

    // Find the last assistant message (the workout plan)
    const lastAssistantMessage = [...messages]
      .reverse()
      .find((m) => m.role === 'assistant')

    if (!lastAssistantMessage) {
      Alert.alert('Error', 'No workout plan found to start.')
      return
    }

    setIsLoading(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    try {
      let workoutData

      if (parsedWorkout) {
        // Use parsed JSON directly without calling AI again
        workoutData = {
          title: parsedWorkout.title,
          description: parsedWorkout.description,
          exercises: parsedWorkout.exercises.map((ex) => ({
            name: ex.name,
            sets: ex.sets.map((s) => {
              // Parse reps range string to min/max
              let repsMin: number | undefined
              let repsMax: number | undefined
              const rangeMatch = s.reps.match(/(\d+)[-–](\d+)/)
              if (rangeMatch) {
                repsMin = parseInt(rangeMatch[1])
                repsMax = parseInt(rangeMatch[2])
              } else {
                const singleRep = parseInt(s.reps)
                if (!isNaN(singleRep)) {
                  repsMin = singleRep
                  repsMax = singleRep
                }
              }

              return {
                reps: s.reps,
                weight: s.weight,
                repsMin,
                repsMax,
                restSeconds: s.rest,
              }
            }),
          })),
        }
      } else {
        // Fallback to text conversion
        workoutData = await convertAiPlanToWorkout({
          text: lastAssistantMessage.content,
          userId: user?.id,
          weightUnit,
          token: session?.access_token,
        })
      }

      // Convert to StructuredExerciseDraft format
      const generateId = () =>
        Date.now().toString(36) + Math.random().toString(36).substr(2)

      const structuredData = workoutData.exercises.map((ex: any) => ({
        id: generateId(),
        name: ex.name,
        sets: ex.sets.map((s: any) => ({
          weight: s.weight || '',
          reps: s.reps || '',
          lastWorkoutWeight: null,
          lastWorkoutReps: null,
          targetRepsMin: s.repsMin || null,
          targetRepsMax: s.repsMax || null,
          targetRestSeconds: s.restSeconds || null,
        })),
      }))

      // Save draft
      await saveDraft({
        title: workoutData.title || 'AI Generated Workout',
        notes: workoutData.description || 'Generated from AI Chat',
        structuredData,
        isStructuredMode: true,
      })

      // Navigate to create-post
      router.push({
        pathname: '/(tabs)/create-post',
        params: { refresh: Date.now().toString() },
      })
    } catch (error) {
      console.error('Error starting workout:', error)
      Alert.alert(
        'Error',
        'Failed to create workout from chat. Please try again.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveRoutine = async () => {
    if (isLoading || !generatedPlanContent) return

    setIsLoading(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    let createdRoutineId: string | null = null

    try {
      if (!user?.id) throw new Error('User not found')

      let routineData

      if (parsedWorkout) {
        // Use parsed JSON directly without calling AI again
        routineData = {
          title: parsedWorkout.title,
          description: parsedWorkout.description,
          exercises: parsedWorkout.exercises.map((ex) => ({
            name: ex.name,
            sets: ex.sets.map((s) => {
              // Parse reps range string to min/max
              let repsMin: number | undefined
              let repsMax: number | undefined
              const rangeMatch = s.reps.match(/(\d+)[-–](\d+)/)
              if (rangeMatch) {
                repsMin = parseInt(rangeMatch[1])
                repsMax = parseInt(rangeMatch[2])
              } else {
                const singleRep = parseInt(s.reps)
                if (!isNaN(singleRep)) {
                  repsMin = singleRep
                  repsMax = singleRep
                }
              }

              return {
                reps: s.reps,
                repsMin,
                repsMax,
                restSeconds: s.rest,
              }
            }),
          })),
        }
      } else {
        // Fallback to text conversion
        routineData = await convertAiPlanToRoutine({
          text: generatedPlanContent,
          userId: user.id,
          weightUnit,
          token: session?.access_token,
        })
      }

      // Create routine
      const routine = await database.workoutRoutines.create(
        user.id,
        routineData.title || 'AI Generated Routine',
        routineData.description || 'Generated from AI Chat',
      )
      createdRoutineId = routine.id

      // Resolve all exercises at once using the AI agent
      const exerciseNames = routineData.exercises.map((ex) => ex.name)
      let resolutions: Record<
        string,
        { exerciseId: string; exerciseName: string; wasCreated: boolean }
      > = {}

      const { callSupabaseFunction } = await import(
        '@/lib/supabase-functions-client'
      )
      const response = await callSupabaseFunction(
        'resolve-exercises',
        'POST',
        {
          exerciseNames,
          userId: user.id,
        },
        undefined,
        session?.access_token,
      )

      if (!response.ok) {
        throw new Error('Failed to resolve exercises')
      }

      const data = await response.json()
      resolutions = data.resolutions

      // Helper to find resolution with case-insensitive matching
      const findResolution = (name: string) => {
        // Try exact match first
        if (resolutions[name]) return resolutions[name]
        // Try case-insensitive match
        const lowerName = name.toLowerCase()
        for (const key of Object.keys(resolutions)) {
          if (key.toLowerCase() === lowerName) {
            return resolutions[key]
          }
        }
        return null
      }

      // Collect all routine exercises to insert
      const routineExercisesToInsert = []
      const exerciseIndexMap: {
        originalIndex: number
        exerciseId: string
      }[] = []

      for (let i = 0; i < routineData.exercises.length; i++) {
        const ex = routineData.exercises[i]
        const resolution = findResolution(ex.name)

        if (!resolution || !resolution.exerciseId) {
          console.warn(`Could not resolve exercise: ${ex.name}`)
          continue
        }

        routineExercisesToInsert.push({
          routine_id: routine.id,
          exercise_id: resolution.exerciseId,
          order_index: i,
          notes: null,
        })
        exerciseIndexMap.push({
          originalIndex: i,
          exerciseId: resolution.exerciseId,
        })
      }

      if (routineExercisesToInsert.length === 0) {
        throw new Error('No exercises could be resolved')
      }

      // Batch insert all routine exercises
      const { data: insertedExercises, error: exError } = await supabase
        .from('workout_routine_exercises')
        .insert(routineExercisesToInsert)
        .select()

      if (exError || !insertedExercises) {
        throw new Error('Failed to create routine exercises')
      }

      // Prepare all sets for batch insert
      const routineSets: {
        routine_exercise_id: string
        set_number: number
        reps_min: number | null
        reps_max: number | null
      }[] = []

      for (let idx = 0; idx < insertedExercises.length; idx++) {
        const insertedExercise = insertedExercises[idx]
        const originalIndex = exerciseIndexMap[idx].originalIndex
        const ex = routineData.exercises[originalIndex]

        ex.sets.forEach((s, setIndex) => {
          // Determine reps_min and reps_max
          // Use explicit check for undefined/null to allow 0 as valid value
          let repsMin: number | null =
            s.repsMin !== undefined && s.repsMin !== null ? s.repsMin : null
          let repsMax: number | null =
            s.repsMax !== undefined && s.repsMax !== null ? s.repsMax : null

          // If min/max are both null but we have a reps string, parse it
          if (repsMin === null && repsMax === null && s.reps) {
            const parsed = parseInt(s.reps)
            if (!isNaN(parsed)) {
              repsMin = parsed
              repsMax = parsed
            }
          }

          routineSets.push({
            routine_exercise_id: insertedExercise.id,
            set_number: setIndex + 1,
            reps_min: repsMin,
            reps_max: repsMax,
          })
        })
      }

      if (routineSets.length > 0) {
        const { error: setsError } = await supabase
          .from('workout_routine_sets')
          .insert(routineSets)

        if (setsError) throw setsError
      }

      // Navigate directly to the routine detail page
      router.push({
        pathname: '/routine-detail',
        params: { routineId: routine.id },
      })
    } catch (error) {
      console.error('Error creating routine:', error)

      // Clean up orphaned routine if it was created
      if (createdRoutineId) {
        try {
          await supabase
            .from('workout_routines')
            .delete()
            .eq('id', createdRoutineId)
        } catch (cleanupError) {
          console.error('Failed to cleanup orphaned routine:', cleanupError)
        }
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Failed to create routine'
      Alert.alert('Error', `${errorMessage}. Please try again.`)
    } finally {
      setIsLoading(false)
    }
  }

  const styles = createStyles(colors)

  // Show unified workout planning wizard
  if (planningState.isActive && planningState.step === 'wizard') {
    return (
      <View style={styles.container}>
        <WorkoutPlanningWizard
          colors={colors}
          onComplete={handleWizardComplete}
          onCancel={handleWizardCancel}
        />
        <Paywall
          visible={showPaywall}
          onClose={() => setShowPaywall(false)}
          title="Try Pro for FREE!"
          message="AI workout planning is a Pro feature"
        />
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {/* New Chat Button - Positioned absolutely */}
      <TouchableOpacity
        style={[styles.newChatButton, { top: Math.max(insets.top - 38, 0) }]}
        onPress={handleNewChat}
        activeOpacity={0.7}
      >
        <Ionicons name="create-outline" size={22} color={colors.primary} />
      </TouchableOpacity>

      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        showsVerticalScrollIndicator={false}
        automaticallyAdjustKeyboardInsets={false}
        onContentSizeChange={() => messages.length > 0 && scrollToBottom()}
      >
        {messages.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.welcomeSection}>
              <Ionicons
                name="chatbubbles-outline"
                size={64}
                color={colors.primary}
              />
              <Text style={styles.welcomeTitle}>
                Plan your workouts with AI
              </Text>
            </View>

            <View style={styles.actionCardsContainer}>
              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => handleExampleQuestion('Plan Workout')}
                activeOpacity={0.7}
              >
                <View style={styles.actionCardIcon}>
                  <Ionicons name="flash" size={24} color={colors.primary} />
                </View>
                <View style={styles.actionCardContent}>
                  <Text style={styles.actionCardTitle}>Plan Workout</Text>
                  <Text style={styles.actionCardSubtitle}>
                    Create a personalized workout
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.chatMessages}>
            {messages.map((message) => (
              <View
                key={message.id}
                style={[
                  message.role === 'user'
                    ? styles.userMessageContainer
                    : styles.assistantMessageContainer,
                ]}
              >
                {message.role === 'user' ? (
                  <View style={styles.userMessageBubble}>
                    <View style={styles.userMessageContent}>
                      {/* Display images for user messages */}
                      {message.images && message.images.length > 0 && (
                        <View style={styles.messageImagesGrid}>
                          {message.images.map((imageUri, index) => (
                            <TouchableOpacity
                              key={index}
                              style={styles.messageImageThumbnail}
                              onPress={() =>
                                openImageViewer(message.images!, index)
                              }
                            >
                              <Image
                                source={{ uri: imageUri }}
                                style={styles.messageImage}
                                resizeMode="cover"
                              />
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                      <Text style={styles.userMessageText}>
                        {message.content}
                      </Text>
                    </View>
                  </View>
                ) : // Check if this is the last message and we have parsed workout
                parsedWorkout &&
                  message.id ===
                    messages.filter((m) => m.role === 'assistant').pop()?.id ? (
                  <View style={styles.assistantMessageContent}>
                    {/* AI Description */}
                    <Text style={styles.workoutDescription}>
                      {parsedWorkout.description}
                    </Text>

                    {/* Workout Card */}
                    <View style={styles.workoutCard}>
                      <View style={styles.workoutCardHeader}>
                        <Text style={styles.workoutCardTitle}>
                          {parsedWorkout.title}
                        </Text>
                        <View style={styles.workoutDuration}>
                          <Ionicons
                            name="time-outline"
                            size={16}
                            color={colors.primary}
                          />
                          <Text style={styles.workoutDurationText}>
                            {parsedWorkout.duration}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.workoutDivider} />

                      {/* Exercise List */}
                      {(isWorkoutExpanded
                        ? parsedWorkout.exercises
                        : parsedWorkout.exercises.slice(0, 4)
                      ).map((exercise, index) => {
                        const warmupSets = exercise.sets.filter(
                          (s) => s.type === 'warmup',
                        ).length
                        const totalSets = exercise.sets.length
                        const isExpanded = expandedExerciseIndices.includes(
                          index,
                        )

                        return (
                          <TouchableOpacity
                            key={index}
                            style={styles.exerciseItemContainer}
                            activeOpacity={0.7}
                            onPress={() => {
                              setExpandedExerciseIndices((prev) =>
                                prev.includes(index)
                                  ? prev.filter((i) => i !== index)
                                  : [...prev, index],
                              )
                            }}
                          >
                            <View style={styles.exerciseItem}>
                              <View style={styles.exerciseIconContainer}>
                                <Ionicons
                                  name={getExerciseIcon(exercise.name)}
                                  size={24}
                                  color={colors.textSecondary}
                                />
                              </View>
                              <View style={styles.exerciseInfo}>
                                <Text style={styles.exerciseName}>
                                  {exercise.name}
                                </Text>
                                <Text style={styles.exerciseSets}>
                                  {totalSets} sets
                                  {warmupSets > 0
                                    ? ` (${warmupSets} warmup)`
                                    : ''}
                                </Text>
                              </View>
                              <Ionicons
                                name={
                                  isExpanded ? 'chevron-up' : 'chevron-down'
                                }
                                size={18}
                                color={colors.textSecondary}
                              />
                            </View>

                            {/* Detailed Sets View */}
                            {isExpanded && (
                              <View style={styles.exerciseDetails}>
                                {exercise.sets.map((set, setIndex) => (
                                  <View
                                    key={setIndex}
                                    style={styles.setDetailRow}
                                  >
                                    <View style={styles.setNumberContainer}>
                                      <Text style={styles.setNumberText}>
                                        {setIndex + 1}
                                      </Text>
                                      {set.type === 'warmup' && (
                                        <View style={styles.warmupBadge}>
                                          <Text style={styles.warmupText}>
                                            W
                                          </Text>
                                        </View>
                                      )}
                                    </View>
                                    <View style={styles.setMainInfo}>
                                      <Text style={styles.setDetailText}>
                                        {set.weight ? `${set.weight} x ` : ''}
                                        {set.reps} reps
                                      </Text>
                                    </View>
                                    {set.rest && (
                                      <View style={styles.restInfo}>
                                        <Ionicons
                                          name="timer-outline"
                                          size={14}
                                          color={colors.textSecondary}
                                        />
                                        <Text style={styles.restText}>
                                          {set.rest}s
                                        </Text>
                                      </View>
                                    )}
                                  </View>
                                ))}
                              </View>
                            )}
                          </TouchableOpacity>
                        )
                      })}

                      {/* Expand/Collapse Button */}
                      {parsedWorkout.exercises.length > 4 && (
                        <TouchableOpacity
                          style={styles.expandButton}
                          onPress={() =>
                            setIsWorkoutExpanded(!isWorkoutExpanded)
                          }
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name={
                              isWorkoutExpanded ? 'chevron-up' : 'chevron-down'
                            }
                            size={24}
                            color={colors.textSecondary}
                          />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ) : (
                  <View style={styles.assistantMessageContent}>
                    <Markdown
                      style={{
                        body: {
                          fontSize: 15,
                          lineHeight: 22,
                          color: colors.text,
                          margin: 0,
                        },
                        paragraph: {
                          marginTop: 0,
                          marginBottom: 12,
                        },
                        heading1: {
                          fontSize: 20,
                          fontWeight: '700',
                          color: colors.text,
                          marginTop: 16,
                          marginBottom: 8,
                        },
                        heading2: {
                          fontSize: 18,
                          fontWeight: '700',
                          color: colors.text,
                          marginTop: 14,
                          marginBottom: 6,
                        },
                        heading3: {
                          fontSize: 16,
                          fontWeight: '600',
                          color: colors.text,
                          marginTop: 12,
                          marginBottom: 6,
                        },
                        code_inline: {
                          backgroundColor: colors.backgroundLight,
                          paddingHorizontal: 4,
                          paddingVertical: 2,
                          borderRadius: 4,
                          fontSize: 14,
                          fontFamily:
                            Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                          color: colors.text,
                        },
                        code_block: {
                          backgroundColor: colors.backgroundLight,
                          padding: 12,
                          borderRadius: 8,
                          fontSize: 14,
                          fontFamily:
                            Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                          color: colors.text,
                          marginVertical: 8,
                          overflow: 'hidden',
                        },
                        fence: {
                          backgroundColor: colors.backgroundLight,
                          padding: 12,
                          borderRadius: 8,
                          fontSize: 14,
                          fontFamily:
                            Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                          color: colors.text,
                          marginVertical: 8,
                        },
                        strong: {
                          fontWeight: '600',
                          color: colors.text,
                        },
                        em: {
                          fontStyle: 'italic',
                        },
                        bullet_list: {
                          marginTop: 0,
                          marginBottom: 12,
                        },
                        ordered_list: {
                          marginTop: 0,
                          marginBottom: 12,
                        },
                        list_item: {
                          marginTop: 4,
                          marginBottom: 4,
                        },
                        hr: {
                          backgroundColor: colors.border,
                          height: 1,
                          marginVertical: 16,
                        },
                        blockquote: {
                          borderLeftWidth: 3,
                          borderLeftColor: colors.primary,
                          paddingLeft: 12,
                          marginVertical: 8,
                          backgroundColor: colors.backgroundLight,
                          paddingVertical: 8,
                          paddingRight: 8,
                        },
                        link: {
                          color: colors.primary,
                          textDecorationLine: 'underline',
                        },
                      }}
                    >
                      {message.content}
                    </Markdown>
                  </View>
                )}
              </View>
            ))}
            {isLoading && (
              <View style={styles.loadingMessageContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            )}
            {/* Start Workout & Save Buttons - In chat section */}
            {generatedPlanContent && (
              <View style={styles.actionButtonsContainer}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={handleStartWorkout}
                  activeOpacity={0.7}
                >
                  <Ionicons name="barbell" size={20} color={colors.white} />
                  <Text style={styles.actionButtonText}>Start Workout</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.secondaryActionButton]}
                  onPress={handleSaveRoutine}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="bookmark-outline"
                    size={20}
                    color={colors.primary}
                  />
                  <Text style={styles.secondaryActionButtonText}>
                    Save as Routine
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Suggestions Row */}
      {!generatedPlanContent && !planningState.isActive && (
        <View style={styles.suggestionsContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.suggestionsContent}
            keyboardShouldPersistTaps="handled"
          >
            {suggestionMode !== 'main' && (
              <TouchableOpacity
                style={styles.suggestionBackBubble}
                onPress={handleSuggestionBack}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="chevron-back"
                  size={18}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            )}

            {suggestionMode === 'main'
              ? SUGGESTIONS.main.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.suggestionBubble}
                    onPress={() => handleSuggestionClick(item)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.suggestionText}>{item.text}</Text>
                  </TouchableOpacity>
                ))
              : SUGGESTIONS[suggestionMode].map((item, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.suggestionBubble}
                    onPress={() => handleSuggestionClick(item)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.suggestionText}>{item}</Text>
                  </TouchableOpacity>
                ))}
          </ScrollView>
        </View>
      )}

      {/* Input Area */}
      <View
        style={[
          styles.inputContainer,
          { paddingBottom: isKeyboardVisible ? 80 : 16 },
        ]}
      >
        {/* Image Thumbnails Preview */}
        {selectedImages.length > 0 && (
          <ScrollView
            horizontal
            style={styles.imagePreviewContainer}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.imagePreviewContent}
          >
            {selectedImages.map((imageUri, index) => (
              <View key={index} style={styles.imageThumbnailContainer}>
                <Image
                  source={{ uri: imageUri }}
                  style={styles.imageThumbnail}
                  resizeMode="cover"
                />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => removeImage(index)}
                >
                  <Ionicons name="close" size={14} color={colors.white} />
                </TouchableOpacity>
              </View>
            ))}
            <View style={styles.imageCountBadge}>
              <Text style={styles.imageCountText}>
                {selectedImages.length}/{MAX_IMAGES}
              </Text>
            </View>
          </ScrollView>
        )}

        {/* Input Row */}
        <View style={styles.inputWrapper}>
          {/* Add Image Button */}
          <TouchableOpacity
            style={styles.addImageButton}
            onPress={() => setShowImagePickerModal(true)}
            disabled={isLoading}
          >
            <Ionicons
              name="add"
              size={20}
              color={isLoading ? colors.textPlaceholder : colors.primary}
            />
          </TouchableOpacity>

          {/* Text Input */}
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder={
              generatedPlanContent
                ? 'Make changes to your plan...'
                : 'Ask about your workouts...'
            }
            placeholderTextColor={colors.textPlaceholder}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={handleSendMessage}
            blurOnSubmit={false}
            editable={!isLoading}
          />

          {/* Send Button */}
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!input.trim() || isLoading) && styles.sendButtonDisabled,
            ]}
            onPress={handleSendMessage}
            disabled={!input.trim() || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={colors.textPlaceholder} />
            ) : (
              <Ionicons
                name="send"
                size={20}
                color={input.trim() ? colors.white : colors.textPlaceholder}
              />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Paywall Modal */}
      <Paywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        title="Try Pro for FREE!"
        message="AI chat is a Pro feature"
      />

      {/* Image Picker Bottom Sheet */}
      <Modal
        visible={showImagePickerModal}
        transparent
        animationType="fade"
        onRequestClose={closeImagePickerSheet}
      >
        <GestureHandlerRootView style={styles.modalContainer}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeImagePickerSheet}
          >
            <View style={styles.modalBackdrop} />
          </Pressable>

          <GestureDetector gesture={pan}>
            <AnimatedReanimated.View
              style={[styles.bottomSheet, animatedBottomSheetStyle]}
            >
              <View style={styles.bottomSheetHandleContainer}>
                <View style={styles.bottomSheetHandle} />
              </View>
              <Text style={styles.bottomSheetTitle}>Add Image</Text>

              <TouchableOpacity
                style={styles.bottomSheetOption}
                onPress={launchCamera}
              >
                <View style={styles.bottomSheetOptionIcon}>
                  <Ionicons name="camera" size={24} color={colors.primary} />
                </View>
                <Text style={styles.bottomSheetOptionText}>Take Photo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.bottomSheetOption}
                onPress={launchLibrary}
              >
                <View style={styles.bottomSheetOptionIcon}>
                  <Ionicons name="images" size={24} color={colors.primary} />
                </View>
                <Text style={styles.bottomSheetOptionText}>
                  Choose from Library
                </Text>
              </TouchableOpacity>
            </AnimatedReanimated.View>
          </GestureDetector>
        </GestureHandlerRootView>
      </Modal>

      {/* Image Viewer Modal */}
      <Modal
        visible={viewerImageIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={closeImageViewer}
      >
        <View style={styles.imageViewerContainer}>
          <TouchableOpacity
            style={styles.imageViewerCloseButton}
            onPress={closeImageViewer}
          >
            <Ionicons name="close" size={28} color={colors.white} />
          </TouchableOpacity>

          {viewerImages.length > 0 && viewerImageIndex !== null && (
            <>
              <FlatList
                data={viewerImages}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                initialScrollIndex={viewerImageIndex}
                getItemLayout={(_, index) => ({
                  length: 400,
                  offset: 400 * index,
                  index,
                })}
                renderItem={({ item }) => (
                  <View style={styles.imageViewerSlide}>
                    <Image
                      source={{ uri: item }}
                      style={styles.imageViewerImage}
                      resizeMode="contain"
                    />
                  </View>
                )}
                keyExtractor={(_, index) => index.toString()}
              />

              {viewerImages.length > 1 && (
                <View style={styles.imageViewerCounter}>
                  <Text style={styles.imageViewerCounterText}>
                    {viewerImageIndex + 1} of {viewerImages.length}
                  </Text>
                </View>
              )}
            </>
          )}
        </View>
      </Modal>
    </KeyboardAvoidingView>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    newChatButton: {
      position: 'absolute',
      left: 16,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.backgroundLight,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 10,
      padding: 0,
    },
    actionButtonsContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: 16,
      marginBottom: 16,
      paddingHorizontal: 16,
      gap: 12,
    },
    actionButton: {
      flex: 1,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primary,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 16,
      gap: 8,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 4,
    },
    secondaryActionButton: {
      backgroundColor: colors.backgroundWhite,
      borderWidth: 1,
      borderColor: colors.primary,
      shadowOpacity: 0.05,
    },
    actionButtonText: {
      color: colors.white,
      fontSize: 14,
      fontWeight: '600',
    },
    secondaryActionButtonText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '600',
    },
    messagesContainer: {
      flex: 1,
    },
    messagesContent: {
      flexGrow: 1,
      padding: 16,
      paddingBottom: 8,
      paddingTop: 16,
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      paddingBottom: 60,
    },
    welcomeSection: {
      alignItems: 'center',
      marginBottom: 32,
      marginTop: 20,
    },
    welcomeTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      marginTop: 16,
      marginBottom: 8,
    },
    welcomeSubtitle: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      paddingHorizontal: 32,
    },
    actionCardsContainer: {
      paddingHorizontal: 16,
      gap: 12,
    },
    actionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.backgroundWhite,
      padding: 20,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    actionCardIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: `${colors.primary}15`,
      justifyContent: 'center',
      alignItems: 'center',
    },
    actionCardContent: {
      flex: 1,
      marginLeft: 16,
    },
    actionCardTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    actionCardSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    chatMessages: {
      gap: 24,
    },
    userMessageContainer: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'flex-start',
    },
    assistantMessageContainer: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
      alignItems: 'flex-start',
    },
    userMessageBubble: {
      maxWidth: '80%',
    },
    userMessageContent: {
      backgroundColor: colors.primary,
      padding: 12,
      borderRadius: 16,
      borderBottomRightRadius: 4,
    },
    userMessageText: {
      fontSize: 15,
      lineHeight: 20,
      color: colors.white,
    },
    assistantMessageContent: {
      flex: 1,
      paddingVertical: 4,
    },
    // Workout Preview Card Styles
    workoutDescription: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.textSecondary,
      marginBottom: 16,
    },
    workoutCard: {
      backgroundColor: colors.backgroundWhite,
      borderRadius: 20,
      padding: 20,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 4,
      borderWidth: 1,
      borderColor: colors.border,
    },
    workoutCardHeader: {
      marginBottom: 12,
    },
    workoutCardTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    workoutDuration: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    workoutDurationText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.primary,
    },
    workoutDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginBottom: 16,
    },
    exerciseItemContainer: {
      borderBottomWidth: 1,
      borderBottomColor: `${colors.border}80`,
    },
    exerciseItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
    },
    exerciseDetails: {
      paddingLeft: 58, // Icon width + margin
      paddingRight: 16,
      paddingBottom: 12,
    },
    setDetailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
    },
    setNumberContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      width: 40,
    },
    setNumberText: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    warmupBadge: {
      backgroundColor: `${colors.primary}15`,
      borderRadius: 4,
      paddingHorizontal: 4,
      paddingVertical: 1,
      marginLeft: 4,
    },
    warmupText: {
      fontSize: 10,
      color: colors.primary,
      fontWeight: '700',
    },
    setMainInfo: {
      flex: 1,
    },
    setDetailText: {
      fontSize: 14,
      color: colors.text,
    },
    restInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    restText: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    exerciseIconContainer: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: colors.backgroundLight,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 14,
    },
    exerciseInfo: {
      flex: 1,
    },
    exerciseName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },
    exerciseSets: {
      fontSize: 14,
      color: colors.primary,
      fontWeight: '500',
    },
    expandButton: {
      alignItems: 'center',
      paddingTop: 12,
      marginTop: 4,
    },
    inputContainer: {
      backgroundColor: colors.white,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingHorizontal: 16,
      paddingTop: 8,
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
    },
    input: {
      flex: 1,
      backgroundColor: colors.backgroundLight,
      borderRadius: 9999,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 10,
      fontSize: 15,
      lineHeight: 20,
      color: colors.text,
      maxHeight: 100,
      textAlignVertical: 'center',
    },
    sendButton: {
      width: 40,
      height: 40,
      borderRadius: 9999,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    sendButtonDisabled: {
      backgroundColor: colors.backgroundLight,
    },
    loadingMessageContainer: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
      alignItems: 'center',
      paddingVertical: 8,
    },
    loadingText: {
      fontSize: 14,
      color: colors.textSecondary,
      fontStyle: 'italic',
    },
    // Suggestion bubbles
    suggestionsContainer: {
      paddingTop: 12,
      paddingBottom: 12,
      backgroundColor: colors.background,
    },
    suggestionsContent: {
      paddingHorizontal: 16,
      gap: 8,
    },
    suggestionBubble: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.backgroundLight,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
    },
    suggestionBackBubble: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.backgroundLight,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    suggestionText: {
      fontSize: 14,
      color: colors.text,
      fontWeight: '500',
    },
    // Image preview in input area
    imagePreviewContainer: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 8,
    },
    imagePreviewContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    imageThumbnailContainer: {
      position: 'relative',
    },
    imageThumbnail: {
      width: 60,
      height: 60,
      borderRadius: 8,
    },
    removeImageButton: {
      position: 'absolute',
      top: -6,
      right: -6,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.error || '#FF3B30',
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
      elevation: 2,
    },
    imageCountBadge: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: colors.backgroundLight,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    imageCountText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    addImageButton: {
      width: 40,
      height: 40,
      borderRadius: 9999,
      backgroundColor: colors.backgroundLight,
      justifyContent: 'center',
      alignItems: 'center',
    },
    // Images in messages
    messageImagesGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 4,
      marginBottom: 8,
    },
    messageImageThumbnail: {
      width: 80,
      height: 80,
      borderRadius: 8,
      overflow: 'hidden',
    },
    messageImage: {
      width: '100%',
      height: '100%',
    },
    // Bottom sheet modal
    modalContainer: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    modalBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    bottomSheet: {
      backgroundColor: colors.white,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingBottom: 32,
      paddingHorizontal: 16,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 12,
    },
    bottomSheetHandleContainer: {
      alignItems: 'center',
      paddingTop: 12,
      paddingBottom: 4,
    },
    bottomSheetHandle: {
      width: 36,
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
    },
    bottomSheetTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
      textAlign: 'center',
    },
    bottomSheetOption: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      backgroundColor: colors.backgroundLight,
      borderRadius: 12,
      marginBottom: 8,
    },
    bottomSheetOptionIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.white,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    bottomSheetOptionText: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.text,
    },
    // Image viewer modal
    imageViewerContainer: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.95)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    imageViewerCloseButton: {
      position: 'absolute',
      top: 50,
      right: 20,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 10,
    },
    imageViewerSlide: {
      width: 400,
      height: 400,
      justifyContent: 'center',
      alignItems: 'center',
    },
    imageViewerImage: {
      width: '100%',
      height: '100%',
    },
    imageViewerCounter: {
      position: 'absolute',
      bottom: 50,
      alignSelf: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 16,
    },
    imageViewerCounterText: {
      color: colors.white,
      fontSize: 14,
      fontWeight: '600',
    },
  })
