import { ExerciseMediaThumbnail } from '@/components/ExerciseMedia'
import { CoachSelectionSheet } from '@/components/coach-selection-sheet'
import { Paywall } from '@/components/paywall'
import { WorkoutCard } from '@/components/workout-card'
import {
  WorkoutPlanningData,
  WorkoutPlanningWizard,
} from '@/components/workout-planning-wizard'
import { AnalyticsEvents } from '@/constants/analytics-events'
import { useAnalytics } from '@/contexts/analytics-context'
import { useAuth } from '@/contexts/auth-context'
import { useProfile } from '@/contexts/profile-context'
import { useSubscription } from '@/contexts/subscription-context'
import { useTutorial } from '@/contexts/tutorial-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import {
  AiWorkoutConversionResult,
  convertAiPlanToRoutine,
  convertAiPlanToWorkout,
} from '@/lib/ai/ai-workout-converter'
import {
  ParsedWorkoutDisplay,
  parseWorkoutForDisplay,
} from '@/lib/ai/workoutParsing'
import {
  buildWorkoutCreationPrompt,
  buildWorkoutModificationSuffix,
} from '@/lib/ai/workoutPrompt'
import { getCoach, getCoachTrainingGuidelines } from '@/lib/coaches'
import { database } from '@/lib/database'
import { appFetch } from '@/lib/fetch'
import { haptic, hapticSuccess } from '@/lib/haptics'
import { exerciseLookup } from '@/lib/services/exerciseLookup'
import { supabase } from '@/lib/supabase'
import { findExerciseByName } from '@/lib/utils/exercise-matcher'
import {
  loadDraft as loadWorkoutDraft,
  saveDraft,
} from '@/lib/utils/workout-draft'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useFocusEffect } from '@react-navigation/native'
import * as FileSystem from 'expo-file-system/legacy'
import * as ImagePicker from 'expo-image-picker'
import { router } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native'
import 'react-native-get-random-values'
import Markdown from 'react-native-markdown-display'
import AnimatedReanimated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
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
  commonMuscles?: string[]
}

type SuggestionMode =
  | 'main'
  | 'tell_me_about'
  | 'how_to'
  | 'adjust_workout'
  | 'replace_exercise'

// Exercise suggestion for add exercise callback
export interface ExerciseSuggestion {
  name: string
  sets: number
  reps: string
  notes?: string
}

// Internal component for animated suggestion buttons
function AnimatedSuggestion({
  index,
  onPress,
  style,
  textStyle,
  icon,
  text,
  isBack = false,
  colors,
}: {
  index: number
  onPress: () => void
  style?: StyleProp<ViewStyle>
  textStyle?: StyleProp<TextStyle>
  icon?: React.ReactNode
  text?: string
  isBack?: boolean
  colors: ReturnType<typeof useThemedColors>
}) {
  const translateY = useSharedValue(40)
  const opacity = useSharedValue(0)

  useEffect(() => {
    // Reset
    translateY.value = 40
    opacity.value = 0

    // Animate in with delay based on index
    translateY.value = withDelay(
      index * 60,
      withSpring(0, {
        damping: 8,
        stiffness: 200,
        mass: 0.8,
      }),
    )
    opacity.value = withDelay(index * 60, withTiming(1, { duration: 300 }))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reanimated values are stable
  }, [index, text, isBack]) // Re-run when text or mode changes

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }))

  if (isBack) {
    return (
      <AnimatedReanimated.View style={animatedStyle}>
        <TouchableOpacity style={style} onPress={onPress} activeOpacity={0.7}>
          <Ionicons
            name="chevron-back"
            size={18}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
      </AnimatedReanimated.View>
    )
  }

  return (
    <AnimatedReanimated.View style={animatedStyle}>
      <TouchableOpacity style={style} onPress={onPress} activeOpacity={0.7}>
        {icon}
        <Text style={textStyle}>{text}</Text>
      </TouchableOpacity>
    </AnimatedReanimated.View>
  )
}

// Animated typing dot for loading indicator
function TypingDot({
  delay,
  colors,
}: {
  delay: number
  colors: ReturnType<typeof useThemedColors>
}) {
  const opacity = useSharedValue(0.3)

  useEffect(() => {
    const animate = () => {
      opacity.value = withDelay(
        delay,
        withTiming(1, { duration: 400 }, () => {
          opacity.value = withTiming(0.3, { duration: 400 })
        }),
      )
    }
    animate()
    const interval = setInterval(animate, 1200)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delay])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }))

  return (
    <AnimatedReanimated.View
      style={[
        {
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: colors.textSecondary,
        },
        animatedStyle,
      ]}
    />
  )
}

// Workout context passed from create-post
export interface WorkoutContextSet {
  weight?: string
  reps?: string
}

export interface WorkoutContextExercise {
  name: string
  setsCount: number
  sets?: WorkoutContextSet[]
}

export interface WorkoutContext {
  title: string
  notes?: string
  exercises: WorkoutContextExercise[]
}

// Custom suggestions config
export interface SuggestionsConfig {
  main: { id: string; text: string; icon: string }[]
  tell_me_about?: string[]
  how_to?: string[]
  replace_exercise?: string[]
  adjust_workout?: { id: string; text: string; icon: string }[]
}

// Props for WorkoutChat component
export interface WorkoutChatProps {
  // For modal/sheet usage
  mode?: 'fullscreen' | 'sheet'

  // Custom suggestions for create-post context
  customSuggestions?: SuggestionsConfig

  // Workout context for create-post
  workoutContext?: WorkoutContext

  // Callback when exercise is selected/suggested
  onAddExercise?: (exercise: ExerciseSuggestion) => void

  // Callback when exercise is replaced
  onReplaceExercise?: (
    oldExerciseName: string,
    newExercise: ExerciseSuggestion,
  ) => void

  // For sheet mode - hide features not needed
  hideImagePicker?: boolean
  hidePlanningWizard?: boolean

  // Callback for closing the sheet (sheet mode only)
  onClose?: () => void

  // Callback when chat has started (has messages) - useful for sheet mode header
  onChatStarted?: (hasMessages: boolean) => void
}

const DEFAULT_SUGGESTIONS: SuggestionsConfig = {
  main: [
    {
      id: 'plan_workout',
      text: 'Generate Workout',
      icon: 'flash-outline',
    },
    {
      id: 'tell_me_about',
      text: 'Tell me about...',
      icon: 'book-outline',
    },
    { id: 'how_to', text: 'How to...', icon: 'help-circle-outline' },
  ],
  adjust_workout: [
    {
      id: 'add_exercises',
      text: 'Add Exercises',
      icon: 'add-circle-outline',
    },
    {
      id: 'replace_exercise_menu',
      text: 'Replace Exercise',
      icon: 'swap-horizontal-outline',
    },
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

const JSON_BLOCK_REGEX = /(?:```(?:json)?\s*)?(\[\s*\{[\s\S]*?\}\s*\])(?:\s*```)?/

// Storage key for tracking welcome message
const WELCOME_MESSAGE_SEEN_KEY = 'chat_welcome_message_seen'

// Check if user has unread welcome message (for badge display)
export async function hasUnreadWelcomeMessage(
  userId: string | undefined,
): Promise<boolean> {
  if (!userId) return false
  try {
    const storageKey = `${WELCOME_MESSAGE_SEEN_KEY}_${userId}`
    const hasSeen = await AsyncStorage.getItem(storageKey)
    return !hasSeen
  } catch {
    return false
  }
}

// Get personalized welcome message based on coach personality
function getWelcomeMessage(coachId: string, userName?: string): string {
  const greeting = userName ? `Hey ${userName}!` : 'Hey there!'

  switch (coachId) {
    case 'kino':
      return `${greeting} Glad you made it in. Now the real work begins. I've got your stats from onboarding. We're skipping the fluff and focusing on pure strength. Ready to get your first session on the books?`
    case 'maya':
      return `${greeting} Yay, you're officially here! 🎉 I've been so looking forward to this. We're going to build such incredible momentum together. Let's start this journey off right, want me to put together your first workout?`
    case 'ross':
    default:
      return `${greeting} Glad you made it inside! I've already started processing your goals from onboarding. I'm ready to help you train smarter and optimize every set. Shall we generate your first science-based plan?`
  }
}

// Parse exercise suggestions from AI response
function parseExerciseSuggestions(content: string): ExerciseSuggestion[] {
  const suggestions: ExerciseSuggestion[] = []

  // 1. Try to parse JSON block first (Most robust)
  // Match either code-blocked JSON or raw JSON array in text
  const jsonMatch = content.match(JSON_BLOCK_REGEX)

  if (jsonMatch && jsonMatch[1]) {
    try {
      const parsed = JSON.parse(jsonMatch[1])
      if (Array.isArray(parsed)) {
        parsed.forEach((item) => {
          if (item.name && (item.sets || item.reps)) {
            suggestions.push({
              name: item.name,
              sets:
                typeof item.sets === 'number'
                  ? item.sets
                  : parseInt(item.sets || '3'),
              reps: item.reps?.toString() || '10',
            })
          }
        })

        // If we successfully parsed JSON, return immediately
        if (suggestions.length > 0) return suggestions
      }
    } catch (e) {
      // Incomplete JSON during streaming is expected
    }
  }

  // 2. Fallback to Regex patterns for plain text responses
  const patterns = [
    // Bullet/Plain/Bold style: Name - Sets x Reps
    /(?:^|\n)[\s⋅•·\.-]*\**([^*\n]+?)\**\s*[-–:]\s*(\d+)\s*(?:sets?\s*[x×]\s*|x\s*)(\d+(?:-\d+)?)\s*(?:reps?)?/gi,

    // Numbered Loop style: 1. Name: 3x10
    /^\d+\.\s*([^:\n]+):\s*(\d+)\s*[x×]\s*(\d+(?:-\d+)?)/gim,

    // Narrative style: "Add Bench Press - 3 sets x 10"
    /(?:Add|Try|Include)\s+([A-Z][a-z]+(?:\s+[A-Z]?[a-z]+)*)\s*[-–]\s*(\d+)\s*sets?\s*[x×]\s*(\d+(?:-\d+)?)/gi,
  ]

  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(content)) !== null) {
      const name = match[1].trim()
      const sets = parseInt(match[2], 10)
      const reps = match[3]

      // Avoid duplicates
      if (
        !suggestions.some((s) => s.name.toLowerCase() === name.toLowerCase())
      ) {
        suggestions.push({ name, sets, reps })
      }
    }
  }

  return suggestions
}

export function WorkoutChat({
  mode = 'fullscreen',
  customSuggestions,
  workoutContext,
  onAddExercise,
  onReplaceExercise,
  hideImagePicker = false,
  hidePlanningWizard = false,
  onClose,
  onChatStarted,
}: WorkoutChatProps = {}) {
  const scrollViewRef = useRef<ScrollView>(null)
  const inputRef = useRef<TextInput>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showPaywall, setShowPaywall] = useState(false)
  const [selectedImages, setSelectedImages] = useState<string[]>([])
  const [viewerImages, setViewerImages] = useState<string[]>([])
  const [viewerImageIndex, setViewerImageIndex] = useState<number | null>(null)
  const [planningState, setPlanningState] = useState<PlanningState>({
    isActive: false,
    step: 'none',
    data: {},
    commonMuscles: [],
  })
  const [generatedPlanContent, setGeneratedPlanContent] = useState<
    string | null
  >(null)
  const [
    parsedWorkout,
    setParsedWorkout,
  ] = useState<ParsedWorkoutDisplay | null>(null)
  const [proposedWorkout, setProposedWorkout] = useState<ExerciseSuggestion[]>(
    [],
  ) // Track AI-proposed exercises
  const [exerciseToReplace, setExerciseToReplace] = useState<string | null>(
    null,
  ) // Track which exercise is being replaced
  const { coachId, profile, isLoading: isProfileLoading } = useProfile()
  const coach = getCoach(coachId)
  const coachFirstName = coach.name.split(' ')[1] || coach.name
  const [suggestionMode, setSuggestionMode] = useState<SuggestionMode>('main')
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false)
  const [
    loadedDraftContext,
    setLoadedDraftContext,
  ] = useState<WorkoutContext | null>(null)
  const [hasLoadedWelcome, setHasLoadedWelcome] = useState(false)
  const [isCoachSheetVisible, setIsCoachSheetVisible] = useState(false)
  const { user, session } = useAuth()
  const { isProMember } = useSubscription()
  const { canUseTrial, consumeTrial, completeStep } = useTutorial()
  const { trackEvent } = useAnalytics()
  const colors = useThemedColors()
  const { weightUnit } = useWeightUnits()
  const insets = useSafeAreaInsets()
  const TAB_BAR_HEIGHT = 45
  const keyboardVerticalOffset =
    mode === 'sheet' ? 0 : insets.bottom + TAB_BAR_HEIGHT

  // Merge custom suggestions with defaults
  const suggestions: SuggestionsConfig =
    customSuggestions || DEFAULT_SUGGESTIONS

  // NOTE: currentWorkoutExercises, hasWorkout, and activeSuggestions are computed
  // below using useMemo after effectiveWorkoutContext is defined

  const layoutRef = useRef({
    root: 0,
    scrollView: 0,
    inputContainer: 0,
  })

  const logLayout = (
    label: 'root' | 'scrollView' | 'inputContainer',
    data: { x: number; y: number; width: number; height: number },
  ) => {
    layoutRef.current[label] = data.height
  }

  // Auto-focus input when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      const timeoutId = setTimeout(() => {
        inputRef.current?.focus()
      }, 100)

      return () => clearTimeout(timeoutId)
    }, []),
  )

  // Initialize exercise lookup cache on mount
  useEffect(() => {
    exerciseLookup.initialize().catch((err) => {
      console.error('[WorkoutChat] Failed to initialize exercise lookup:', err)
    })
  }, [])

  // Show welcome message for first-time users (fullscreen mode only)
  useEffect(() => {
    // Wait for profile to load before showing welcome message so we have the user's name
    if (mode !== 'fullscreen' || hasLoadedWelcome || !user?.id || isProfileLoading) return

    const checkAndShowWelcome = async () => {
      try {
        const storageKey = `${WELCOME_MESSAGE_SEEN_KEY}_${user.id}`
        const hasSeen = await AsyncStorage.getItem(storageKey)

        if (!hasSeen) {
          // Show welcome message from coach
          const welcomeContent = getWelcomeMessage(
            coachId,
            profile?.display_name?.split(' ')[0], // First name only
          )

          const welcomeMessage: Message = {
            id: 'welcome-message',
            role: 'assistant',
            content: welcomeContent,
          }

          setMessages([welcomeMessage])

          // Mark as seen
          await AsyncStorage.setItem(storageKey, 'true')
        }

        setHasLoadedWelcome(true)
      } catch (error) {
        console.error('[WorkoutChat] Error checking welcome message:', error)
        setHasLoadedWelcome(true)
      }
    }

    checkAndShowWelcome()
  }, [mode, hasLoadedWelcome, user?.id, coachId, profile?.display_name, isProfileLoading])

  // Load workout draft on mount/focus for the chat tab (when workoutContext is not passed)
  // This ensures the AI always knows about the current workout in progress
  useFocusEffect(
    useCallback(() => {
      // If workoutContext is passed as a prop, use that (e.g., from create-post slide-up)
      if (workoutContext) {
        return
      }

      // Load the workout draft for the chat tab
      const loadDraftContext = async () => {
        try {
          const draft = await loadWorkoutDraft()
          if (draft) {
            const context: WorkoutContext = {
              title: draft.title || '',
              notes: draft.notes || '',
              exercises: (draft.structuredData || []).map((e) => ({
                name: e.name,
                setsCount: e.sets?.length || 0,
                sets:
                  e.sets
                    ?.map((set) => ({
                      weight: set.weight || undefined,
                      reps: set.reps || undefined,
                    }))
                    .filter((set) => set.weight || set.reps) || [],
              })),
            }
            setLoadedDraftContext(context)
          } else {
            setLoadedDraftContext(null)
          }
        } catch (error) {
          // console.error('[WorkoutChat] Failed to load workout draft:', error)
        }
      }

      loadDraftContext()
    }, [workoutContext]),
  )

  // Combined context: prefer passed prop, fall back to loaded draft
  const effectiveWorkoutContext =
    workoutContext || loadedDraftContext || undefined

  // Combine initial context exercises with any proposed exercises for the "current workout" state
  const currentWorkoutExercises = useMemo(
    () => [
      ...(effectiveWorkoutContext?.exercises.map((e) => e.name) || []),
      ...proposedWorkout.map((e) => e.name),
    ],
    [effectiveWorkoutContext, proposedWorkout],
  )

  const hasWorkout = currentWorkoutExercises.length > 0

  // Update suggestions based on state
  const activeSuggestions = useMemo(
    () => ({
      ...suggestions,
      main: hasWorkout
        ? [
            {
              id: 'adjust_workout',
              text: 'Adjust Workout',
              icon: 'options-outline',
            },
            ...suggestions.main.filter((s) => s.id !== 'plan_workout'),
          ]
        : suggestions.main,
    }),
    [suggestions, hasWorkout],
  )

  // Auto-scroll to bottom when new messages arrive or content changes
  const scrollToBottom = () => {
    scrollViewRef.current?.scrollToEnd({ animated: true })
  }

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom()
    }
  }, [messages.length])

  // Notify parent when chat has started (has messages)
  useEffect(() => {
    onChatStarted?.(messages.length > 0 || isLoading)
  }, [messages.length, isLoading, onChatStarted])

  // Coach is now managed by ProfileContext - automatically updates when changed

  // Scroll to bottom when buttons appear (to ensure they're visible)
  useEffect(() => {
    if (generatedPlanContent) {
      // Small delay to ensure buttons are rendered before scrolling
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true })
      }, 100)
    }
  }, [generatedPlanContent])

  // Track keyboard visibility and scroll to bottom when keyboard appears
  useEffect(() => {
    const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (event) => {
        setIsKeyboardVisible(true)
        setTimeout(() => scrollToBottom(), 100)
      },
    )

    const keyboardWillHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      (event) => {
        setIsKeyboardVisible(false)
      },
    )

    return () => {
      keyboardWillShowListener.remove()
      keyboardWillHideListener.remove()
    }
  }, [])

  const processStreamingResponse = async (
    reader: ReadableStreamDefaultReader<Uint8Array>,
    assistantMessageId: string | null,
    options?: { silent?: boolean },
  ) => {
    const decoder = new TextDecoder()
    let buffer = ''
    let acc = ''
    let ndjsonMode: boolean | null = null
    let hasDisabledLoading = false

    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value, { stream: true })

      if (ndjsonMode === null) {
        const firstNonWs = chunk.trimStart()[0]
        ndjsonMode = firstNonWs === '{' || chunk.startsWith('data:')
      }

      if (!ndjsonMode) {
        acc += chunk
        // Check if content looks like a raw JSON or code block (likely a workout plan)
        // If it starts with typical JSON/code block markers, hide it
        const isHiddenStream = 
          /^\s*(\[|\{|```)/.test(acc) || 
          acc.includes('```') || 
          acc.includes('\n[') || 
          acc.includes('\n{') ||
          acc.includes(': [') ||
          acc.includes(': {')
        
        if (!options?.silent && assistantMessageId && !isHiddenStream) {
          if (!hasDisabledLoading) {
            setIsLoading(false)
            hasDisabledLoading = true
          }
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId ? { ...m, content: acc } : m,
            ),
          )
        }
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
          if (evt.type === 'text-delta' && typeof evt.textDelta === 'string') {
            acc += evt.textDelta
          } else if (evt.type === 'message' && typeof evt.text === 'string') {
            acc += evt.text
          }
        } catch {
          acc += line
        }

        // More aggressive detection: skip update if we see typical JSON/code block markers anywhere
        const isHiddenStream = 
          /^\s*(\[|\{|```)/.test(acc) || 
          acc.includes('```') || 
          acc.includes('\n[') || 
          acc.includes('\n{') ||
          acc.includes(': [') ||
          acc.includes(': {')

        if (!options?.silent && assistantMessageId && !isHiddenStream) {
          if (!hasDisabledLoading) {
            setIsLoading(false)
            hasDisabledLoading = true
          }
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId ? { ...m, content: acc } : m,
            ),
          )
        }
      }
    }

    if (buffer && ndjsonMode) {
      let line = buffer.trim()
      if (line.startsWith('data:')) line = line.slice(5).trim()
      if (line && line !== '[DONE]') {
        try {
          const evt = JSON.parse(line)
          if (evt.type === 'text-delta' && typeof evt.textDelta === 'string') {
            acc += evt.textDelta
          } else if (evt.type === 'message' && typeof evt.text === 'string') {
            acc += evt.text
          } else if (typeof line === 'string') {
            acc += line
          }
        } catch {
          acc += line
        }
        const isHiddenStream = /^\s*(\[|```)/.test(acc) || acc.includes('```json') || acc.includes('\n[')
        if (!options?.silent && assistantMessageId && !isHiddenStream) {
          if (!hasDisabledLoading) {
            setIsLoading(false)
            hasDisabledLoading = true
          }
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId ? { ...m, content: acc } : m,
            ),
          )
        }
      }
    }

    // If we were hiding the stream (because it was JSON), or just finished normally,
    // make sure the final content is updated.
    if (!options?.silent && assistantMessageId) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessageId ? { ...m, content: acc } : m,
        ),
      )
    }

    const parsed = parseWorkoutForDisplay(acc)
    if (parsed) {
      setGeneratedPlanContent(acc)
      setParsedWorkout(parsed)

      // Consume the tutorial trial when user successfully generates a workout
      if (!isProMember) {
        consumeTrial('ai_workout')
      }

      // Also populate proposedWorkout from the parsed plan if empty?
      // Actually, for the initial plan generation, we might rely on the ParsedWorkoutDisplay.
      // But if we want to support "Add Exercises" after, we should probably track them.
      // For now, let's keep them separate as ParsedWorkoutDisplay is for the specific "Plan" UI.
      // However, if the user modifies it, we might want to sync up.
      // Let's rely on the explicit "Add Exercises" flow for populating proposedWorkout.
    }

    // Check for add/replace suggestions in non-plan responses
    const newSuggestions = parseExerciseSuggestions(acc)
    if (newSuggestions.length > 0) {
      // If we are in "add exercises" flow, we might want to automatically add them or just show them.
      // The requirement says: "AI responds with exercise suggestions... User sees exercise cards with '+' button"
      // So we don't auto-add to state yet, we wait for user action.
      // But we need to make sure the UI renders these cards.
      // The `ParsedWorkoutDisplay` handles full plans. For partial suggestions, we might need a similar display?
      // `parseWorkoutForDisplay` might be too strict for just 2-3 exercises.
      // Let's assume standard markdown rendering for now, or maybe we can enhance the markdown renderer later to show cards.
      // But wait, step 4 says: "User sees exercise cards with '+' button".
      // This implies we need to detect these suggestions and render a specific UI for them in the chat.
    }

    // Auto-update proposed workout if it's a direct instruction?
    // No, the requirement says "Clicking '+' adds to proposedWorkout state".

    return acc
  }

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

  // Show native action sheet for image picker
  const showImagePickerActionSheet = () => {
    haptic('light')

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Library'],
          cancelButtonIndex: 0,
        },
        (buttonIndex: number) => {
          if (buttonIndex === 1) {
            launchCamera()
          } else if (buttonIndex === 2) {
            launchLibrary()
          }
        },
      )
    } else {
      // Android fallback using Alert
      Alert.alert('Add Image', 'Choose an option', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Take Photo', onPress: launchCamera },
        { text: 'Choose from Library', onPress: launchLibrary },
      ])
    }
  }

  // Launch camera
  const launchCamera = async () => {
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

  const handleAddExercise = (suggestion: ExerciseSuggestion) => {
    hapticSuccess()
    if (onAddExercise) {
      onAddExercise(suggestion)
    } else {
      setProposedWorkout((prev) => [...prev, suggestion])
    }
  }

  const handleReplaceExercise = (suggestion: ExerciseSuggestion) => {
    hapticSuccess()
    if (onReplaceExercise && exerciseToReplace) {
      onReplaceExercise(exerciseToReplace, suggestion)
      setExerciseToReplace(null) // Clear after replacement
    } else {
      // Fallback: just add the exercise if no replace handler
      handleAddExercise(suggestion)
    }
  }

  const handleSendMessage = async (hiddenPrompt?: string) => {
    const messageContent = hiddenPrompt || input.trim()
    if (!messageContent || isLoading) return

    // Check if user is pro member or has tutorial trial available
    const canAccessAiChat = isProMember || canUseTrial('ai_workout')

    if (!canAccessAiChat) {
      setShowPaywall(true)
      trackEvent(AnalyticsEvents.PAYWALL_SHOWN, {
        feature: 'ai_chat',
      })
      return
    }

    // Note: Trial will be consumed later when a workout is actually generated
    // This allows users to chat/explore before using their free workout generation

    // Store input and images before clearing
    const imagesToSend = [...selectedImages]

    // Clear input immediately after validation if not hidden prompt
    if (!hiddenPrompt) {
      setInput('')
      setSelectedImages([])
      inputRef.current?.clear()
      Keyboard.dismiss()
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageContent,
      images: imagesToSend.length > 0 ? imagesToSend : undefined,
    }

    // Only show user message if not a hidden prompt
    if (!hiddenPrompt) {
      setMessages((prev) => [...prev, userMessage])
    }

    let hiddenPromptContent: string | undefined

    // We let the AI decide if it should generate a workout plan based on the system prompt.
    // hiddenPromptContent is only set by specific planning flows (like the wizard).

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
      const systemMessage = {
        role: 'system',
        content: getCoach(coachId).systemPrompt,
      }

      const formattedMessages = [systemMessage, ...messages, userMessage].map(
        (m) => ({
          role: m.role,
          content: m.content,
        }),
      )

      // Check if we have a hidden prompt content from the planning flows
      if (typeof hiddenPromptContent !== 'undefined') {
        // Replace the last user message content with the full prompt for the AI
        formattedMessages[
          formattedMessages.length - 1
        ].content = hiddenPromptContent
      } else {
        // If we already generated a workout/routine, and the user is sending a new message,
        // we assume they might be refining it.
        // Skip adding suffix for hidden prompts or if no plan generated yet
        if (generatedPlanContent && !hiddenPrompt) {
          const lastMsg = formattedMessages[formattedMessages.length - 1]
          lastMsg.content += buildWorkoutModificationSuffix()
        }
      }

      // Prepare request body with images as separate field
      type ChatRequestBody = {
        messages: { role: string; content: string }[]
        userId: string | undefined
        weightUnit: string
        workoutContext?: {
          title?: string
          notes?: string
          exercises?: unknown
        }
        images?: { type: string; image_url: { url: string } }[]
      }
      const requestBody: ChatRequestBody = {
        messages: formattedMessages,
        userId: user?.id,
        weightUnit,
        // Include current workout context so AI knows what workout is in progress
        workoutContext: effectiveWorkoutContext
          ? {
              title: effectiveWorkoutContext.title,
              notes: effectiveWorkoutContext.notes,
              exercises: effectiveWorkoutContext.exercises,
            }
          : undefined,
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

      const response = await appFetch(`${getSupabaseFunctionBaseUrl()}/chat`, {
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
        await processStreamingResponse(reader, assistantMessageId)
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

  const handleNewChat = () => {
    haptic('light')
    setMessages([])
    setInput('')
    setSelectedImages([])
    setPlanningState({
      isActive: false,
      step: 'none',
      data: {},
      commonMuscles: [],
    })
    setGeneratedPlanContent(null)
    setParsedWorkout(null)
    setSuggestionMode('main')
    inputRef.current?.clear()
    Keyboard.dismiss()
  }

  const handleSuggestionPress = (
    item: string | { id: string; text: string; icon: string },
  ) => {
    // 1. Handle object-based menu items (Main, Adjust Workout)
    if (typeof item === 'object') {
      if (item.id === 'plan_workout') {
        haptic('light')
        setPlanningState((prev) => ({
          ...prev,
          isActive: true,
          step: 'wizard',
        }))
        return
      }

      if (item.id === 'adjust_workout') {
        haptic('light')
        setSuggestionMode('adjust_workout')
        return
      }

      if (item.id === 'add_exercises') {
        // Send hidden prompt for adding exercises
        const prompt = `Suggest 2-3 exercises that would complement my current workout: ${currentWorkoutExercises.join(
          ', ',
        )}. Format response as a JSON list: [{"name": "Exercise Name", "sets": 3, "reps": "10-12"}]`
        handleSendMessage(prompt)
        setSuggestionMode('main')
        return
      }

      if (item.id === 'replace_exercise_menu') {
        setSuggestionMode('replace_exercise')
        return
      }

      if (item.id === 'back_to_main') {
        setSuggestionMode('main')
        return
      }

      if (item.id === 'tell_me_about') {
        setSuggestionMode('tell_me_about')
        return
      }

      if (item.id === 'how_to') {
        setSuggestionMode('how_to')
        return
      } else {
        setInput((prev) => prev + item)
        setSuggestionMode('main')
        inputRef.current?.focus()
      }
    } else {
      // 2. Handle string-based suggestion items (Exercise names)
      if (suggestionMode === 'replace_exercise') {
        setExerciseToReplace(item) // Track which exercise we're replacing
        const prompt = `I want to replace "${item}" in my current workout with a similar exercise. Suggest 3 alternatives. Format response as a JSON list: [{"name": "Exercise Name", "sets": 3, "reps": "10-12"}]`
        handleSendMessage(prompt)
        setSuggestionMode('main')
      } else if (suggestionMode === 'how_to') {
        const prompt = `How do I perform "${item}" correctly? Give me a concise guide with key cues.`
        handleSendMessage(prompt)
        setSuggestionMode('main')
      } else {
        // Default: append text to input
        setInput((prev) => prev + (prev ? ' ' : '') + item)
        inputRef.current?.focus()
      }
    }
  }

  const handleWizardComplete = async (data: WorkoutPlanningData) => {
    // Check if user is pro member or has tutorial trial available
    const canAccessAiChat = isProMember || canUseTrial('ai_workout')
    console.log(
      '[WorkoutChat] Wizard complete. canAccessAiChat:',
      canAccessAiChat,
      'isProMember:',
      isProMember,
      'canUseTrial:',
      canUseTrial('ai_workout'),
    )

    if (!canAccessAiChat) {
      setShowPaywall(true)
      trackEvent(AnalyticsEvents.PAYWALL_SHOWN, {
        feature: 'ai_workout_generation',
      })
      return
    }

    // Otherwise, this is the final completion, so generate the workout
    setPlanningState({
      isActive: false,
      step: 'none',
      data: {},
      commonMuscles: [],
    })

    // Build the equipment label for display
    const equipmentLabels: Record<string, string> = {
      full_gym: 'Full Gym',
      dumbbells_only: 'Dumbbells Only',
      home_minimal: 'Home / Minimal Equipment',
      bodyweight: 'Bodyweight Only',
      barbell_only: 'Barbell Only',
    }
    const equipmentLabel = equipmentLabels[data.equipment] || data.equipment

    // Get coach-specific training guidelines
    const trainingGuidelines = getCoachTrainingGuidelines(coachId)

    // Construct the hidden prompt for the AI
    const finalPrompt = buildWorkoutCreationPrompt(data, equipmentLabel, trainingGuidelines)

    // Now call the API
    setIsLoading(true)

    try {
      const { getSupabaseFunctionBaseUrl } = await import(
        '@/lib/supabase-functions-client'
      )

      const systemMessage = {
        role: 'system',
        content: getCoach(coachId).systemPrompt,
      }

      const formattedMessages = [
        systemMessage,
        ...messages,
        { role: 'user', content: finalPrompt },
      ]

      const requestBody = {
        messages: formattedMessages,
        userId: user?.id,
        weightUnit,
      }

      const response = await appFetch(`${getSupabaseFunctionBaseUrl()}/chat`, {
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
        
        // Use timeout to step out of current stack for state updates
        setTimeout(() => {
          setGeneratedPlanContent(assistantContent)
          
          // Parse workout for structured display
          const parsed = parseWorkoutForDisplay(assistantContent)
          setParsedWorkout(parsed)

          // Add the final message
          setMessages((prev) => [
            ...prev,
            {
              id: assistantMessageId,
              role: 'assistant',
              content: assistantContent,
            },
          ])

          // Consume trial when workout is generated
          if (parsed && !isProMember) {
            consumeTrial('ai_workout')
          }
        }, 0)
      } else {
        // Stream silently - no placeholder message initially
        const fullContent = await processStreamingResponse(
          reader, 
          null, // No ID, so it won't update messages during stream
          { silent: true }
        )
        
        // Once complete, add the message
        setMessages((prev) => [
          ...prev,
          {
            id: assistantMessageId,
            role: 'assistant',
            content: fullContent,
          },
        ])
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
    haptic('medium')

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
                type: s.type,
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

      type WorkoutExercise = AiWorkoutConversionResult['exercises'][number]
      type WorkoutSet = WorkoutExercise['sets'][number] & {
        restSeconds?: number
        type?: 'warmup' | 'working'
      }

      const structuredData = workoutData.exercises.map(
        (ex: WorkoutExercise) => ({
          id: generateId(),
          name: ex.name,
          sets: ex.sets.map((s: WorkoutSet) => ({
            weight: s.weight || '',
            reps: '', // Actual reps should be empty for user to fill
            isWarmup: s.type === 'warmup',
            lastWorkoutWeight: null,
            lastWorkoutReps: null,
            targetRepsMin: s.repsMin || null,
            targetRepsMax: s.repsMax || null,
            targetRestSeconds: s.restSeconds || null,
          })),
        }),
      )

      // Save draft
      await saveDraft({
        title: workoutData.title || 'AI Generated Workout',
        notes: '', // Don't prefill notes with AI description
        structuredData,
        isStructuredMode: true,
      })

      // Close the sheet first (if in sheet mode)
      onClose?.()

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

    // Check if user is pro member or has tutorial trial available
    const canAccessCreateRoutine = isProMember || canUseTrial('create_routine')
    if (!canAccessCreateRoutine) {
      setShowPaywall(true)
      trackEvent(AnalyticsEvents.PAYWALL_SHOWN, {
        feature: 'create_routine_from_chat',
      })
      return
    }

    setIsLoading(true)
    haptic('medium')

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
        { notes: routineData.description || 'Generated from AI Chat' },
      )
      createdRoutineId = routine.id

      // Resolve exercise IDs from the database (to get UUIDs)
      const exerciseNames = routineData.exercises.map((ex) => ex.name)
      const { data: dbExercises, error: resolveError } = await supabase
        .from('exercises')
        .select('id, name')
        .in('name', exerciseNames)

      if (resolveError) {
        throw new Error(`Failed to resolve exercises: ${resolveError.message}`)
      }

      const exerciseIdMap = new Map<string, string>()
      dbExercises?.forEach((ex) => {
        if (ex.name) {
          exerciseIdMap.set(ex.name.toLowerCase(), ex.id)
        }
      })

      // Collect all routine exercises to insert
      const routineExercisesToInsert = []
      const exerciseIndexMap: {
        originalIndex: number
        exerciseId: string
      }[] = []

      for (let i = 0; i < routineData.exercises.length; i++) {
        const ex = routineData.exercises[i]
        const dbId = exerciseIdMap.get(ex.name.toLowerCase())

        if (!dbId) {
          console.warn(`Could not find DB exercise for: ${ex.name}`)
          // If strict, we could throw. For now, skipping to avoid crashing if one name is off.
          continue
        }

        routineExercisesToInsert.push({
          routine_id: routine.id,
          exercise_id: dbId,
          order_index: i,
          notes: null,
        })
        exerciseIndexMap.push({
          originalIndex: i,
          exerciseId: dbId,
        })
      }

      if (routineExercisesToInsert.length === 0) {
        throw new Error('No valid exercises found in the database.')
      }

      // Batch insert all routine exercises
      const { data: insertedExercises, error: exError } = await supabase
        .from('workout_routine_exercises')
        .insert(routineExercisesToInsert)
        .select()

      if (exError || !insertedExercises) {
        console.error('Error creating routine exercises:', exError)
        console.error(
          'Payload:',
          JSON.stringify(routineExercisesToInsert, null, 2),
        )
        throw new Error(
          `Failed to create routine exercises: ${
            exError?.message || 'Unknown error'
          }`,
        )
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

      // Consume trial or complete tutorial step
      if (!isProMember) {
        console.log(
          '[WorkoutChat] Saving AI routine. Consuming create_routine trial.',
        )
        consumeTrial('create_routine')
      } else {
        console.log(
          '[WorkoutChat] Saving AI routine. Completing create_routine tutorial step.',
        )
        completeStep('create_routine')
      }

      // Navigate directly to the routine detail page
      router.push({
        pathname: '/routine/[routineId]',
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

  const styles = createStyles(colors, insets)

  return (
    <>
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={keyboardVerticalOffset}
        onLayout={(e) => logLayout('root', e.nativeEvent.layout)}
      >
        {planningState.isActive && planningState.step === 'wizard' ? (
          <WorkoutPlanningWizard
            colors={colors}
            onComplete={handleWizardComplete}
            onCancel={() =>
              setPlanningState({
                isActive: false,
                step: 'none',
                data: {},
                commonMuscles: [],
              })
            }
            initialData={planningState.data}
            commonMuscles={planningState.commonMuscles}
          />
        ) : (
          <>
            {/* New Chat Button - Positioned absolutely (hidden in sheet mode) */}
            {mode === 'fullscreen' && (
              <>
                <TouchableOpacity
                  style={[
                    styles.newChatButton,
                    { top: Math.max(insets.top - 38, 0) },
                  ]}
                  onPress={handleNewChat}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="create-outline"
                    size={28}
                    color={colors.primary}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.settingsButton,
                    { top: Math.max(insets.top - 38, 0) },
                  ]}
                  onPress={() => {
                    haptic('light')
                    setIsCoachSheetVisible(true)
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="settings-sharp"
                    size={24}
                    color={colors.primary}
                  />
                </TouchableOpacity>
              </>
            )}

            <ScrollView
              ref={scrollViewRef}
              style={styles.messagesContainer}
              contentContainerStyle={[
                styles.messagesContent,
                {
                  paddingTop:
                    mode === 'sheet'
                      ? 16
                      : messages.length === 0 && !isLoading
                      ? 16
                      : 80,
                },
              ]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={
                Platform.OS === 'ios' ? 'interactive' : 'on-drag'
              }
              showsVerticalScrollIndicator={false}
              automaticallyAdjustKeyboardInsets={false}
              contentInsetAdjustmentBehavior="never"
              onLayout={(e) => logLayout('scrollView', e.nativeEvent.layout)}
              onContentSizeChange={(w, h) => {
                ;(messages.length > 0 || isLoading) && scrollToBottom()
              }}
            >
              {messages.length === 0 && !isLoading ? (
                <View style={styles.emptyState}>
                  {mode === 'fullscreen' && (
                    <View style={styles.welcomeSection}>
                      <View style={styles.coachWelcomeContainer}>
                        <Image
                          source={getCoach(coachId).image}
                          style={styles.coachWelcomeImage}
                          resizeMode="cover"
                        />
                      </View>
                      <Text style={styles.welcomeText}>
                        Ask{' '}
                        {getCoach(coachId).name.split(' ')[1] ||
                          getCoach(coachId).name}
                        ...
                      </Text>
                    </View>
                  )}
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
                      ) : (
                        <>
                          {/* Check if this message contains a parsed workout plan */}
                          {(() => {
                            const messageParsedWorkout = parseWorkoutForDisplay(
                              message.content,
                            )

                            // Workout cards render full-width with coach branding inside the card
                            if (messageParsedWorkout) {
                              return (
                                <View style={styles.workoutCardContainer}>
                                  <WorkoutCard
                                    workout={messageParsedWorkout}
                                    coachImage={coach.image}
                                    onStartWorkout={() => {
                                      setParsedWorkout(messageParsedWorkout)
                                      setGeneratedPlanContent(message.content)
                                      setTimeout(handleStartWorkout, 0)
                                    }}
                                    onSaveRoutine={() => {
                                      setParsedWorkout(messageParsedWorkout)
                                      setGeneratedPlanContent(message.content)
                                      setTimeout(handleSaveRoutine, 0)
                                    }}
                                  />
                                </View>
                              )
                            }

                            // Regular messages show with coach avatar
                            // Hide partial JSON blocks while streaming
                            const displayContent = message.content
                              .replace(JSON_BLOCK_REGEX, '')
                              .replace(/```(?:json|).*/gs, '') // Strip partial code blocks
                              .replace(/\[\s*\{.*/gs, '')      // Strip partial JSON arrays
                              .replace(/\{\s*"exercises".*/gs, '') // Strip partial workout objects
                              .replace(/\{\s*"title".*/gs, '')     // Strip partial workout objects
                              .trim()
                            
                            const exerciseSuggestions = parseExerciseSuggestions(
                              message.content,
                            )

                            // Don't render empty bubbles (prevents glitch when streaming JSON)
                            if (!displayContent && exerciseSuggestions.length === 0) {
                              return null
                            }

                            return (
                              <>
                                {/* Coach Avatar */}
                                <View style={styles.messageAvatarContainer}>
                                  <Image
                                    source={coach.image}
                                    style={styles.messageAvatar}
                                  />
                                </View>
                                <View style={styles.assistantMessageContent}>
                                  <View style={styles.assistantMessageBubble}>
                                    <Markdown
                                      style={{
                                        body: {
                                          fontSize: 16,
                                          lineHeight: 23,
                                          color: colors.text,
                                          margin: 0,
                                        },
                                        paragraph: {
                                          marginTop: 0,
                                          marginBottom: 8,
                                        },
                                        heading1: {
                                          fontSize: 22,
                                          fontWeight: '700',
                                          color: colors.text,
                                          marginTop: 16,
                                          marginBottom: 8,
                                        },
                                        heading2: {
                                          fontSize: 20,
                                          fontWeight: '700',
                                          color: colors.text,
                                          marginTop: 14,
                                          marginBottom: 6,
                                        },
                                        heading3: {
                                          fontSize: 18,
                                          fontWeight: '600',
                                          color: colors.text,
                                          marginTop: 12,
                                          marginBottom: 6,
                                        },
                                        code_inline: {
                                          backgroundColor: colors.background,
                                          paddingHorizontal: 4,
                                          paddingVertical: 2,
                                          borderRadius: 4,
                                          fontSize: 15,
                                          fontFamily:
                                            Platform.OS === 'ios'
                                              ? 'Menlo'
                                              : 'monospace',
                                          color: colors.text,
                                        },
                                        code_block: {
                                          backgroundColor: colors.background,
                                          padding: 12,
                                          borderRadius: 8,
                                          fontSize: 15,
                                          fontFamily:
                                            Platform.OS === 'ios'
                                              ? 'Menlo'
                                              : 'monospace',
                                          color: colors.text,
                                          marginVertical: 8,
                                          overflow: 'hidden',
                                        },
                                        fence: {
                                          backgroundColor: colors.background,
                                          padding: 12,
                                          borderRadius: 8,
                                          fontSize: 15,
                                          fontFamily:
                                            Platform.OS === 'ios'
                                              ? 'Menlo'
                                              : 'monospace',
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
                                          backgroundColor: colors.background,
                                          paddingVertical: 8,
                                          paddingRight: 8,
                                          borderRadius: 4,
                                        },
                                        link: {
                                          color: colors.primary,
                                          textDecorationLine: 'underline',
                                        },
                                      }}
                                    >
                                      {displayContent}
                                    </Markdown>
                                  </View>

                                  {exerciseSuggestions.length > 0 && (
                                    <View style={styles.exerciseCardsContainer}>
                                      {exerciseSuggestions.map(
                                        (suggestion, idx) => {
                                          const exerciseMatch = findExerciseByName(
                                            suggestion.name,
                                          )
                                          const gifUrl = exerciseMatch?.gifUrl
                                          const exerciseId = exerciseMatch?.id
                                          const canNavigate = !!exerciseId
                                          const isLast =
                                            idx === exerciseSuggestions.length - 1
                                          
                                          const handleNavigateToExercise = () => {
                                            if (exerciseId) {
                                              router.push(`/exercise/${exerciseId}`)
                                            }
                                          }

                                          return (
                                            <View
                                              key={idx}
                                              style={styles.suggestionTimelineRow}
                                            >
                                              <View
                                                style={
                                                  styles.suggestionTimelineColumn
                                                }
                                              >
                                                <View
                                                  style={
                                                    styles.suggestionTimelineLineTop
                                                  }
                                                />
                                                <TouchableOpacity
                                                  style={[
                                                    styles.suggestionTimelineNode,
                                                    gifUrl
                                                      ? styles.suggestionTimelineNodeImage
                                                      : null,
                                                  ]}
                                                  onPress={handleNavigateToExercise}
                                                  disabled={!canNavigate}
                                                  activeOpacity={canNavigate ? 0.7 : 1}
                                                >
                                                  {gifUrl ? (
                                                    <ExerciseMediaThumbnail
                                                      gifUrl={gifUrl}
                                                      style={
                                                        styles.suggestionThumbnailImage
                                                      }
                                                    />
                                                  ) : (
                                                    <Ionicons
                                                      name="barbell-outline"
                                                      size={18}
                                                      color={colors.textSecondary}
                                                    />
                                                  )}
                                                </TouchableOpacity>
                                                {!isLast && (
                                                  <View
                                                    style={
                                                      styles.suggestionTimelineLineBottom
                                                    }
                                                  />
                                                )}
                                              </View>

                                              <View
                                                style={
                                                  styles.suggestionContentColumn
                                                }
                                              >
                                                <View style={styles.exerciseCard}>
                                                  <View
                                                    style={
                                                      styles.exerciseCardInfo
                                                    }
                                                  >
                                                    <View style={styles.exerciseCardNameRow}>
                                                      <Text
                                                        style={
                                                          styles.exerciseCardName
                                                        }
                                                      >
                                                        {suggestion.name}
                                                      </Text>
                                                      {canNavigate && (
                                                        <TouchableOpacity
                                                          onPress={handleNavigateToExercise}
                                                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                                          style={styles.exerciseCardInfoButton}
                                                        >
                                                          <Ionicons
                                                            name="information-circle-outline"
                                                            size={16}
                                                            color={colors.textTertiary}
                                                          />
                                                        </TouchableOpacity>
                                                      )}
                                                    </View>
                                                    <Text
                                                      style={
                                                        styles.exerciseCardDetails
                                                      }
                                                    >
                                                      {suggestion.sets} sets ×{' '}
                                                      {suggestion.reps} reps
                                                    </Text>
                                                  </View>
                                                  <TouchableOpacity
                                                    style={
                                                      styles.addExerciseButton
                                                    }
                                                    onPress={() =>
                                                      exerciseToReplace
                                                        ? handleReplaceExercise(
                                                            suggestion,
                                                          )
                                                        : handleAddExercise(
                                                            suggestion,
                                                          )
                                                    }
                                                  >
                                                    <Ionicons
                                                      name={
                                                        exerciseToReplace
                                                          ? 'swap-horizontal'
                                                          : 'add'
                                                      }
                                                      size={20}
                                                      color={colors.white}
                                                    />
                                                  </TouchableOpacity>
                                                </View>
                                              </View>
                                            </View>
                                          )
                                        },
                                      )}
                                    </View>
                                  )}
                                </View>
                              </>
                            )
                          })()}
                        </>
                      )}
                    </View>
                  ))}

                  {/* Welcome hint - shown after welcome message */}
                  {messages.length === 1 &&
                    messages[0]?.id === 'welcome-message' &&
                    !isLoading && (
                      <View style={styles.welcomeHintContainer}>
                        <View style={styles.welcomeHintRow}>
                          <Text style={styles.welcomeHintText}>Tap </Text>
                          <View style={styles.welcomeHintButton}>
                            <Ionicons
                              name="flash"
                              size={13}
                              color={colors.primary}
                            />
                            <Text style={styles.welcomeHintButtonText}>
                              Generate Workout
                            </Text>
                          </View>
                          <Text style={styles.welcomeHintText}>
                            {' '}
                            below to get started
                          </Text>
                        </View>
                      </View>
                    )}

                  {isLoading && (
                    <View style={styles.loadingMessageContainer}>
                      <View style={styles.messageAvatarContainer}>
                        <Image
                          source={coach.image}
                          style={styles.messageAvatar}
                        />
                      </View>
                      <View style={styles.typingIndicator}>
                        <TypingDot delay={0} colors={colors} />
                        <TypingDot delay={150} colors={colors} />
                        <TypingDot delay={300} colors={colors} />
                      </View>
                    </View>
                  )}
                  {/* Start Workout & Save Buttons - Only show at bottom if it's NOT an inline workout card message */}
                  {/* Start Workout & Save Buttons - Only show at bottom if it's NOT an inline workout card message */}
                  {/* REMOVED: Redundant footer buttons. Actions are now handled inline by WorkoutCard */}
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
                  style={{ overflow: 'visible' }}
                >
                  {suggestionMode !== 'main' && (
                    <AnimatedSuggestion
                      index={0}
                      isBack
                      colors={colors}
                      style={styles.suggestionBackBubble}
                      onPress={() => setSuggestionMode('main')}
                    />
                  )}

                  {suggestionMode === 'main'
                    ? activeSuggestions.main.map((item, idx) => (
                        <AnimatedSuggestion
                          key={item.id}
                          index={idx}
                          text={item.text}
                          colors={colors}
                          style={[
                            styles.suggestionBubble,
                            (item.id === 'plan_workout' ||
                              item.id === 'adjust_workout') &&
                              styles.planWorkoutBubble,
                          ]}
                          textStyle={[
                            styles.suggestionText,
                            (item.id === 'plan_workout' ||
                              item.id === 'adjust_workout') &&
                              styles.planWorkoutText,
                          ]}
                          icon={
                            item.id === 'plan_workout' ||
                            item.id === 'adjust_workout' ? (
                              <Ionicons
                                name="flash"
                                size={14}
                                color={colors.primary}
                                style={{ marginRight: 6 }}
                              />
                            ) : null
                          }
                          onPress={() => handleSuggestionPress(item)}
                        />
                      ))
                    : suggestionMode === 'replace_exercise'
                    ? currentWorkoutExercises.map((exerciseName, index) => (
                        <AnimatedSuggestion
                          key={index}
                          index={index + 1}
                          text={exerciseName}
                          colors={colors}
                          style={styles.suggestionBubble}
                          textStyle={styles.suggestionText}
                          onPress={() => handleSuggestionPress(exerciseName)}
                        />
                      ))
                    : suggestionMode === 'adjust_workout'
                    ? (
                        activeSuggestions.adjust_workout || []
                      ).map((item, index) => (
                        <AnimatedSuggestion
                          key={item.id}
                          index={index + 1}
                          text={item.text}
                          colors={colors}
                          style={[
                            styles.suggestionBubble,
                            styles.planWorkoutBubble,
                          ]}
                          textStyle={[
                            styles.suggestionText,
                            styles.planWorkoutText,
                          ]}
                          icon={
                            <Ionicons
                              name={item.icon as any}
                              size={14}
                              color={colors.primary}
                              style={{ marginRight: 6 }}
                            />
                          }
                          onPress={() => handleSuggestionPress(item)}
                        />
                      ))
                    : (
                        activeSuggestions[suggestionMode] || []
                      ).map((item, index) => (
                        <AnimatedSuggestion
                          key={index}
                          index={index + 1}
                          text={item as string}
                          colors={colors}
                          style={styles.suggestionBubble}
                          textStyle={styles.suggestionText}
                          onPress={() => handleSuggestionPress(item)}
                        />
                      ))}
                </ScrollView>
              </View>
            )}

            {/* Input Area */}
            <View
              style={[
                styles.inputContainer,
                {
                  paddingBottom:
                    mode === 'sheet'
                      ? Math.max(insets.bottom, 16)
                      : isKeyboardVisible
                      ? 0
                      : 60,
                },
              ]}
              onLayout={(e) => logLayout('inputContainer', e.nativeEvent.layout)}
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
                {/* Add Image Button - hidden when hideImagePicker is true */}
                {!hideImagePicker && (
                  <TouchableOpacity
                    style={styles.addImageButton}
                    onPress={showImagePickerActionSheet}
                    disabled={isLoading}
                  >
                    <Ionicons
                      name="image-outline"
                      size={22}
                      color={isLoading ? colors.textPlaceholder : colors.primary}
                    />
                  </TouchableOpacity>
                )}

                <View style={styles.textInputContainer}>
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
                    onSubmitEditing={() => handleSendMessage()}
                    blurOnSubmit={false}
                    editable={!isLoading}
                  />

                  <TouchableOpacity
                    style={[
                      styles.sendButton,
                      (!input.trim() || isLoading) && styles.sendButtonDisabled,
                    ]}
                    onPress={() => handleSendMessage()}
                    disabled={!input.trim() || isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator
                        size="small"
                        color={colors.textPlaceholder}
                      />
                    ) : (
                      <Ionicons name="arrow-up" size={20} color={colors.white} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>

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
          </>
        )}

        {/* Paywall Modal - Rendered outside conditional to appear over wizard */}
        <Paywall
          visible={showPaywall}
          onClose={() => setShowPaywall(false)}
          message={`Get 24/7 expert guidance, custom plan adjustments, and unlimited support.`}
        />
      </KeyboardAvoidingView>
      <CoachSelectionSheet
        visible={isCoachSheetVisible}
        onClose={() => setIsCoachSheetVisible(false)}
      />
    </>
  )
}

function createStyles(
  colors: ReturnType<typeof useThemedColors>,
  insets: { bottom: number },
) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    newChatButton: {
      position: 'absolute',
      left: 16,
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 10,
      padding: 0,
    },
    settingsButton: {
      position: 'absolute',
      right: 16,
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.background,
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
      fontSize: 15,
      fontWeight: '600',
    },
    secondaryActionButtonText: {
      color: colors.primary,
      fontSize: 15,
      fontWeight: '600',
    },
    messagesContainer: {
      flex: 1,
    },
    messagesContent: {
      flexGrow: 1,
      padding: 16,
      paddingBottom: 0,
      paddingTop: 16,
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    welcomeSection: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    welcomeText: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
      marginTop: 16,
      opacity: 0.8,
    },
    coachWelcomeContainer: {
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 5,
      marginBottom: 8,
    },
    coachWelcomeImage: {
      width: 120,
      height: 120,
      borderRadius: 60,
      borderWidth: 4,
      borderColor: colors.background,
    },
    chatMessages: {
      paddingBottom: 20,
    },
    userMessageContainer: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'flex-start',
      marginBottom: 16,
    },
    assistantMessageContainer: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
      alignItems: 'flex-end',
      marginBottom: 16,
      gap: 8,
    },
    messageAvatarContainer: {
      width: 32,
      height: 32,
      flexShrink: 0,
    },
    messageAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.backgroundLight,
    },
    userMessageBubble: {
      maxWidth: '80%',
    },
    userMessageContent: {
      backgroundColor: colors.primary,
      padding: 12,
      paddingHorizontal: 14,
      borderRadius: 18,
      borderBottomRightRadius: 4,
    },
    userMessageText: {
      fontSize: 16,
      lineHeight: 22,
      color: colors.white,
    },
    assistantMessageContent: {
      flex: 1,
      maxWidth: '85%',
      paddingVertical: 0,
    },
    workoutCardContainer: {
      flex: 1,
      width: '100%',
    },
    assistantMessageBubble: {
      backgroundColor: colors.backgroundLight,
      padding: 12,
      paddingHorizontal: 14,
      borderRadius: 18,
      borderBottomLeftRadius: 4,
    },
    welcomeHintContainer: {
      alignItems: 'center',
      marginTop: 24,
      marginBottom: 8,
    },
    welcomeHintRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      flexWrap: 'wrap',
    },
    welcomeHintText: {
      fontSize: 15,
      color: colors.textSecondary,
    },
    welcomeHintButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: `${colors.primary}12`,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.primary,
      gap: 5,
      marginHorizontal: 2,
    },
    welcomeHintButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
    },
    welcomeHintArrow: {
      marginTop: 8,
    },
    inputContainer: {
      backgroundColor: 'transparent',
      borderTopWidth: 0,
      paddingHorizontal: 16,
      paddingTop: 8,
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
    },
    textInputContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'flex-end',
      backgroundColor: colors.backgroundLight,
      borderRadius: 24,
      paddingRight: 4,
      paddingLeft: 16,
      paddingVertical: 4,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    input: {
      flex: 1,
      paddingTop: 6,
      paddingBottom: 6,
      marginRight: 8,
      fontSize: 17,
      lineHeight: 22,
      color: colors.text,
      maxHeight: 100,
      textAlignVertical: 'center',
    },
    sendButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 2,
    },
    sendButtonDisabled: {
      backgroundColor: colors.textPlaceholder,
      opacity: 0.5,
    },
    loadingMessageContainer: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
      alignItems: 'flex-end',
      marginBottom: 16,
      gap: 8,
    },
    typingIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.backgroundLight,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 18,
      borderBottomLeftRadius: 4,
      gap: 4,
    },
    loadingText: {
      fontSize: 15,
      color: colors.textSecondary,
      fontStyle: 'italic',
    },
    // Suggestion bubbles
    suggestionsContainer: {
      paddingTop: 20, // Increased to allow for bounce overshoot
      marginTop: -8, // Compensate for extra padding to keep layout consistent
      paddingBottom: 12,
      backgroundColor: colors.background,
      overflow: 'visible',
      zIndex: 10,
    },
    suggestionsContent: {
      paddingHorizontal: 16,
      gap: 8,
      overflow: 'visible',
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
    planWorkoutBubble: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}08`,
    },
    planWorkoutText: {
      color: colors.primary,
      fontWeight: '600',
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
      fontSize: 15,
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
      fontSize: 13,
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
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
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
    wizardContainer: {
      flex: 1,
    },
    recapCard: {
      flex: 1,
      justifyContent: 'center',
      padding: 24,
    },
    recapTitle: {
      fontSize: 28,
      fontWeight: 'bold',
      marginBottom: 8,
      textAlign: 'center',
    },
    recapSubtitle: {
      fontSize: 16,
      marginBottom: 32,
      textAlign: 'center',
    },
    recapItems: {
      gap: 16,
      marginBottom: 40,
    },
    recapItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 16,
      borderRadius: 12,
      backgroundColor: 'rgba(120, 120, 120, 0.1)',
    },
    recapItemText: {
      fontSize: 16,
      fontWeight: '500',
    },
    recapButtons: {
      gap: 12,
    },
    recapButton: {
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    recapButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    modalContainer: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    modalBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    sheetContainer: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      width: '100%',
      minHeight: 500,
      paddingBottom: insets.bottom + 20,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 12,
    },
    sheetContent: {
      flex: 1,
      width: '100%',
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
      fontSize: 16,
      fontWeight: '600',
    },
    // Exercise suggestion cards (for sheet mode with onAddExercise)
    exerciseCardsContainer: {
      marginTop: 12,
      gap: 8,
    },
    exerciseCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.backgroundLight,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    exerciseCardInfo: {
      flex: 1,
    },
    exerciseCardNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    exerciseCardInfoButton: {
      padding: 2,
    },
    exerciseCardName: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
      flex: 1,
    },
    exerciseCardDetails: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    addExerciseButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    // Timeline styles for exercise suggestions
    suggestionTimelineRow: {
      flexDirection: 'row',
      minHeight: 64,
    },
    suggestionTimelineColumn: {
      width: 48,
      alignItems: 'center',
    },
    suggestionTimelineLineTop: {
      width: 2,
      height: 12,
      backgroundColor: colors.border,
      opacity: 0.5,
    },
    suggestionTimelineLineBottom: {
      width: 2,
      flex: 1,
      backgroundColor: colors.border,
      opacity: 0.5,
    },
    suggestionTimelineNode: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      zIndex: 2,
    },
    suggestionTimelineNodeImage: {
      padding: 0,
      overflow: 'hidden',
      borderWidth: 0,
    },
    suggestionThumbnailImage: {
      width: '100%',
      height: '100%',
    },
    suggestionContentColumn: {
      flex: 1,
      paddingLeft: 12,
      paddingBottom: 8,
    },
  })
}
