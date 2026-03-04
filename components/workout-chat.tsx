import { ExerciseMediaThumbnail } from '@/components/ExerciseMedia'
import { CoachSelectionSheet } from '@/components/coach-selection-sheet'
import { DailyMacrosSheet } from '@/components/daily-macros-sheet'
import { FoodScannerModal } from '@/components/food-scanner'
import { LiquidGlassSurface } from '@/components/liquid-glass-surface'
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
import { useTabBarVisibility } from '@/contexts/tab-bar-visibility-context'
import { useTheme } from '@/contexts/theme-context'
import { useTutorial } from '@/contexts/tutorial-context'
import { useAudioTranscription } from '@/hooks/useAudioTranscription'
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
import { consumePendingChatAttachment } from '@/lib/chat-attachment-handoff'
import { getCoach, getCoachTrainingGuidelines } from '@/lib/coaches'
import { database } from '@/lib/database'
import { appFetch } from '@/lib/fetch'
import { consumePendingFoodLibraryChatText } from '@/lib/food-library-handoff'
import { haptic, hapticSuccess } from '@/lib/haptics'
import {
  calculateMaintenanceCalories,
  resolveCalorieGoal,
} from '@/lib/nutrition'
import { exerciseLookup } from '@/lib/services/exerciseLookup'
import { supabase } from '@/lib/supabase'
import { findExerciseByName } from '@/lib/utils/exercise-matcher'
import {
  loadDraft as loadWorkoutDraft,
  saveDraft,
  StructuredExerciseDraft,
} from '@/lib/utils/workout-draft'
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useFocusEffect } from '@react-navigation/native'
import { FlashList, FlashListRef } from '@shopify/flash-list'
import * as FileSystem from 'expo-file-system/legacy'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { router } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextStyle,
  ToastAndroid,
  TouchableOpacity,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native'
import 'react-native-get-random-values'
import Markdown from 'react-native-markdown-display'
import AnimatedReanimated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Circle, G, Svg } from 'react-native-svg'

function RecordingIndicator({
  colors,
}: {
  colors: ReturnType<typeof useThemedColors>
}) {
  const pulse = useSharedValue(0.4)
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 600 }), -1, true)
  }, [pulse])
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }))
  return (
    <View style={recordingIndicatorStyles.container} pointerEvents="none">
      <AnimatedReanimated.View
        style={[
          recordingIndicatorStyles.dot,
          { backgroundColor: colors.textSecondary },
          animatedStyle,
        ]}
      />
    </View>
  )
}

const recordingIndicatorStyles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
})

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  images?: string[] // Image URIs for display
  status?: 'sending' | 'sent' | 'failed'
}

type FoodLogAction = 'log' | 'update_last'
type FoodLogConfidence = 'low' | 'medium' | 'high'
type FoodLogSource = 'text' | 'photo' | 'voice' | 'manual' | 'correction'

interface FoodLogPayload {
  action: FoodLogAction
  summary: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  confidence: FoodLogConfidence
  source: FoodLogSource
}

interface DailyLogSummaryState {
  logDate: string
  entryId: string | null
  totals: {
    calories: number
    protein_g: number
    carbs_g: number
    fat_g: number
    meal_count: number
  }
  goals: {
    calorie_goal: number | null
    protein_goal_g: number | null
  }
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

function getExerciseSuggestionKey(suggestion: ExerciseSuggestion): string {
  return `${suggestion.name.trim().toLowerCase()}|${
    suggestion.sets
  }|${suggestion.reps.trim().toLowerCase()}`
}

function parseRepRangeFromSuggestion(
  reps: string,
): {
  targetRepsMin: number | null
  targetRepsMax: number | null
} {
  const trimmed = reps.trim()
  const rangeMatch = trimmed.match(/(\d+)\s*[-–]\s*(\d+)/)
  if (rangeMatch) {
    return {
      targetRepsMin: parseInt(rangeMatch[1], 10),
      targetRepsMax: parseInt(rangeMatch[2], 10),
    }
  }

  const singleMatch = trimmed.match(/(\d+)/)
  if (singleMatch) {
    const repsValue = parseInt(singleMatch[1], 10)
    return { targetRepsMin: repsValue, targetRepsMax: repsValue }
  }

  return { targetRepsMin: null, targetRepsMax: null }
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
      id: 'log_meal',
      text: 'Log Meal',
      icon: 'nutrition',
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
const FOOD_LOG_BLOCK_REGEX = /<food_log>([\s\S]*?)<\/food_log>/i

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
  const name = userName ? ` ${userName}` : ''

  switch (coachId) {
    case 'kino':
      return `Hey${name}. This is your training hub — no fluff, just results. Ask me to build your workout, swap exercises, or coach your technique. Log meals and I'll track your calories and macros in real time. Tap ⚡ Generate Workout, or tell me what you're training today.`
    case 'maya':
      return `Hey${name}! ✨ Think of this as your personal fitness co-pilot. I can build your workouts, log your meals, track your calories and macros, and answer any training or nutrition question — just ask! Hit ⚡ Generate Workout to kick things off, or type anything to get started.`
    case 'ross':
    default:
      return `Hey${name}. I'm here to make every session count. Ask me to generate a workout plan, log a meal, track your daily calories and macros, break down your form, or anything fitness-related. Use the quick buttons below, or just type — I'm ready when you are.`
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
    } catch {
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

const getLocalDateString = (): string => {
  const now = new Date()
  const year = now.getFullYear()
  const month = `${now.getMonth() + 1}`.padStart(2, '0')
  const day = `${now.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

const stripFoodLogBlock = (content: string): string =>
  content
    .replace(/<food_log>[\s\S]*?<\/food_log>/gi, '')
    .replace(/<food_log>[\s\S]*$/i, '')
    .trim()

const getVisibleAssistantMessageText = (content: string): string =>
  stripFoodLogBlock(content)
    .replace(JSON_BLOCK_REGEX, '')
    .replace(/```(?:json|).*/gs, '')
    .replace(/\[\s*\{.*/gs, '')
    .replace(/\{\s*"exercises".*/gs, '')
    .replace(/\{\s*"title".*/gs, '')
    .trim()

const parseFoodLogPayload = (content: string): FoodLogPayload | null => {
  const match = content.match(FOOD_LOG_BLOCK_REGEX)
  if (!match?.[1]) return null

  try {
    const parsed = JSON.parse(match[1])
    const action: FoodLogAction =
      parsed?.action === 'update_last' ? 'update_last' : 'log'
    const confidence: FoodLogConfidence =
      parsed?.confidence === 'low' || parsed?.confidence === 'high'
        ? parsed.confidence
        : 'medium'
    const source: FoodLogSource =
      parsed?.source === 'photo' ||
      parsed?.source === 'voice' ||
      parsed?.source === 'manual' ||
      parsed?.source === 'correction'
        ? parsed.source
        : 'text'

    const summary = (parsed?.summary || '').toString().trim()
    if (!summary) return null

    const toSafe = (value: unknown) => {
      const num = Number(value)
      if (!Number.isFinite(num)) return 0
      return Math.max(0, Number(num.toFixed(1)))
    }

    const payload = {
      action,
      summary,
      calories: toSafe(parsed?.calories),
      protein_g: toSafe(parsed?.protein_g),
      carbs_g: toSafe(parsed?.carbs_g),
      fat_g: toSafe(parsed?.fat_g),
      confidence,
      source,
    }
    console.log('[FoodLog] Parsed payload from assistant response:', {
      action: payload.action,
      summary: payload.summary,
      calories: payload.calories,
      protein_g: payload.protein_g,
      carbs_g: payload.carbs_g,
      fat_g: payload.fat_g,
      confidence: payload.confidence,
      source: payload.source,
    })
    return payload
  } catch {
    console.warn('[FoodLog] Failed to parse <food_log> payload block')
    return null
  }
}

const roundMacro = (value: number): number => Math.round(value)

const formatFoodConfidenceLabel = (confidence: FoodLogConfidence): string => {
  if (confidence === 'high') return 'High'
  if (confidence === 'low') return 'Low'
  return 'Medium'
}

const getFoodCardMealLabel = (
  payload: FoodLogPayload,
  currentMealCount: number,
): string => {
  if (payload.action === 'update_last') {
    const mealNumber = Math.max(1, currentMealCount)
    return `Meal ${mealNumber}`
  }

  const nextMealNumber = Math.max(1, currentMealCount + 1)
  return `Meal ${nextMealNumber}`
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
  const messagesListRef = useRef<FlashListRef<Message>>(null)
  const inputRef = useRef<TextInput>(null)
  const launchCameraRef = useRef<() => Promise<void>>(async () => {})
  const launchLibraryRef = useRef<() => Promise<void>>(async () => {})
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [inputHeight, setInputHeight] = useState(0)
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
  const [exerciseActionState, setExerciseActionState] = useState<
    Record<string, 'idle' | 'saving' | 'saved' | 'error'>
  >({})
  const { coachId, profile, isLoading: isProfileLoading } = useProfile()
  const maintenanceCalories = useMemo(
    () => calculateMaintenanceCalories(profile ?? null),
    [profile],
  )
  const coach = getCoach(coachId)
  const [suggestionMode, setSuggestionMode] = useState<SuggestionMode>('main')
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false)
  const [
    loadedDraftContext,
    setLoadedDraftContext,
  ] = useState<WorkoutContext | null>(null)
  const [hasLoadedWelcome, setHasLoadedWelcome] = useState(false)
  const [isCoachSheetVisible, setIsCoachSheetVisible] = useState(false)
  const [isDailyMacrosSheetVisible, setIsDailyMacrosSheetVisible] = useState(
    false,
  )
  const [isFoodScannerVisible, setIsFoodScannerVisible] = useState(false)
  const [navGlassKey, setNavGlassKey] = useState(0)
  const [composerGlassKey, setComposerGlassKey] = useState(0)
  const hasRunInitialComposerRecoveryRef = useRef(false)
  const [
    dailyLogSummary,
    setDailyLogSummary,
  ] = useState<DailyLogSummaryState | null>(null)
  const [latestLoggedMealId, setLatestLoggedMealId] = useState<string | null>(
    null,
  )
  const [foodActionState, setFoodActionState] = useState<
    Record<string, 'idle' | 'saving' | 'saved'>
  >({})
  const [loggedMealIdByMessage, setLoggedMealIdByMessage] = useState<
    Record<string, string>
  >({})
  const { user, session } = useAuth()
  const { isProMember } = useSubscription()
  const { canUseTrial, consumeTrial, completeStep } = useTutorial()
  const { trackEvent } = useAnalytics()
  const themedColors = useThemedColors()
  const colors = useMemo(
    () =>
      ({
        ...themedColors,
        bg: mode === 'sheet' ? themedColors.surfaceSheet : themedColors.bg,
      } as any),
    [themedColors, mode],
  )
  const { isDark } = useTheme()
  const { weightUnit } = useWeightUnits()
  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()
  const tabBarVisibility = useTabBarVisibility()

  const closeWizardAndRestoreTabBar = useCallback(() => {
    tabBarVisibility?.setHideForFullscreenOverlay(false)
    setPlanningState({
      isActive: false,
      step: 'none',
      data: {},
      commonMuscles: [],
    })
  }, [tabBarVisibility])

  useEffect(() => {
    const wizardVisible =
      planningState.isActive && planningState.step === 'wizard'
    tabBarVisibility?.setHideForFullscreenOverlay(wizardVisible)
    return () => {
      tabBarVisibility?.setHideForFullscreenOverlay(false)
    }
  }, [planningState.isActive, planningState.step, tabBarVisibility])

  const {
    isRecording,
    isTranscribing,
    toggleRecording,
    stopRecording,
  } = useAudioTranscription({
    weightUnit,
    onTranscriptionComplete: (text) => {
      const transcribedText = text.trim()
      if (transcribedText) {
        // Send directly to chat
        const combinedText = input.trim()
          ? `${input.trim()} ${transcribedText}`
          : transcribedText

        setInput('')
        setInputHeight(0)
        handleSendMessage(undefined, { overrideInput: combinedText })
      }
    },
  })
  const bottomSafeInset =
    Platform.OS === 'ios' ? Math.min(insets.bottom, 34) : insets.bottom
  // Native tab bar height (49pt on iOS) — not part of RN layout, so we must account for it manually
  const nativeTabBarHeight =
    mode === 'fullscreen' && Platform.OS === 'ios' ? 49 : 0
  // Compact phones (e.g. iPhone SE) need less clearance above the tab bar.
  const isCompactIOSFullscreen =
    mode === 'fullscreen' && Platform.OS === 'ios' && windowHeight <= 700
  const closedTabBarTopGap = isCompactIOSFullscreen ? 28 : 16
  // Extra padding for the floating tab bar when keyboard is closed.
  const closedTabBarPadding =
    mode === 'fullscreen' && Platform.OS === 'ios'
      ? isCompactIOSFullscreen
        ? closedTabBarTopGap
        : nativeTabBarHeight + closedTabBarTopGap
      : 0
  const keyboardVerticalOffset = isCompactIOSFullscreen ? 0 : nativeTabBarHeight

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

  // Initialize exercise lookup cache on mount
  useEffect(() => {
    exerciseLookup.initialize().catch((err) => {
      console.error('[WorkoutChat] Failed to initialize exercise lookup:', err)
    })
  }, [])

  // Show welcome message for first-time users (fullscreen mode only)
  useEffect(() => {
    // Wait for profile to load before showing welcome message so we have the user's name
    if (
      mode !== 'fullscreen' ||
      hasLoadedWelcome ||
      !user?.id ||
      isProfileLoading
    )
      return

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
  }, [
    mode,
    hasLoadedWelcome,
    user?.id,
    coachId,
    profile?.display_name,
    isProfileLoading,
  ])

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
        } catch {
          // console.error('[WorkoutChat] Failed to load workout draft:', error)
        }
      }

      loadDraftContext()
    }, [workoutContext]),
  )

  // Recover native glass on focus and then autofocus once recovery has settled.
  useFocusEffect(
    useCallback(() => {
      setNavGlassKey((prev) => prev + 1)
      setComposerGlassKey((prev) => prev + 1)

      // Only on first focus: run one extra remount before focusing input.
      const needsInitialComposerRetry = !hasRunInitialComposerRecoveryRef.current
      hasRunInitialComposerRecoveryRef.current = true

      let composerRetryTimeout: ReturnType<typeof setTimeout> | null = null
      if (needsInitialComposerRetry) {
        composerRetryTimeout = setTimeout(() => {
          setComposerGlassKey((prev) => prev + 1)
        }, 80)
      }

      const focusTimeout = setTimeout(
        () => {
          inputRef.current?.focus()
        },
        needsInitialComposerRetry ? 180 : 100,
      )

      return () => {
        if (composerRetryTimeout) clearTimeout(composerRetryTimeout)
        clearTimeout(focusTimeout)
      }
    }, []),
  )

  const refreshDailyLogSummary = useCallback(async () => {
    if (!user?.id) {
      setDailyLogSummary(null)
      setLatestLoggedMealId(null)
      return
    }

    try {
      const today = getLocalDateString()
      const [summary, latestMeal] = await Promise.all([
        database.dailyLog.getDaySummary(user.id, today),
        database.dailyLog.getLatestMeal(user.id, today),
      ])
      console.log('[FoodLog] Refreshed daily log summary:', {
        logDate: summary.logDate,
        totals: summary.totals,
        goals: summary.goals,
        latestMealId: latestMeal?.id ?? null,
      })
      setDailyLogSummary(summary as DailyLogSummaryState)
      setLatestLoggedMealId(latestMeal?.id ?? null)
    } catch (error) {
      console.error('[WorkoutChat] Failed to load daily log summary:', error)
    }
  }, [user?.id])

  const handleUpdateCalorieGoal = useCallback(
    async (goal: number) => {
      if (!user?.id) return
      try {
        await database.dailyLog.updateDay(user.id, { calorieGoal: goal })
        await refreshDailyLogSummary()
      } catch (error) {
        console.error('[WorkoutChat] Failed to update calorie goal:', error)
        throw error
      }
    },
    [user?.id, refreshDailyLogSummary],
  )

  useFocusEffect(
    useCallback(() => {
      refreshDailyLogSummary()

      let cancelled = false

      const applyFoodLibraryPrefill = async () => {
        try {
          const pendingText = await consumePendingFoodLibraryChatText()
          if (!pendingText || cancelled) return

          setInput((prev) =>
            prev.trim() ? `${prev.trim()} ${pendingText}` : pendingText,
          )
          setTimeout(() => {
            if (!cancelled) inputRef.current?.focus()
          }, 120)
        } catch (error) {
          console.error(
            '[WorkoutChat] Failed to apply food library prompt:',
            error,
          )
        }
      }

      applyFoodLibraryPrefill()

      const applyAttachmentHandoff = async () => {
        try {
          const pending = await consumePendingChatAttachment()
          if (!pending || cancelled) return
          if (pending.action === 'launch_camera') {
            void launchCameraRef.current()
          } else if (pending.action === 'launch_library') {
            void launchLibraryRef.current()
          } else if (pending.action === 'photo_selected') {
            if (selectedImages.length < MAX_IMAGES) {
              setSelectedImages((prev) => [...prev, pending.uri])
            } else {
              Alert.alert(
                'Maximum Images Reached',
                `You can only add up to ${MAX_IMAGES} images per message.`,
              )
            }
          } else if (pending.action === 'scan_food') {
            setIsFoodScannerVisible(true)
          } else if (pending.action === 'generate_workout') {
            setPlanningState((prev) => ({
              ...prev,
              isActive: true,
              step: 'wizard',
            }))
          }
        } catch (error) {
          console.error(
            '[WorkoutChat] Failed to apply attachment handoff:',
            error,
          )
        }
      }

      applyAttachmentHandoff()

      return () => {
        cancelled = true
      }
    }, [refreshDailyLogSummary, selectedImages.length]),
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
    messagesListRef.current?.scrollToEnd({ animated: true })
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
        scrollToBottom()
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
        const isHiddenStream =
          /^\s*(\[|```)/.test(acc) ||
          acc.includes('```json') ||
          acc.includes('\n[')
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

      // Complete tutorial step for all users, but only consume trial for non-Pro
      completeStep('generate_workout')
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

  // Open native iOS attachment sheet
  const showImagePickerActionSheet = () => {
    haptic('light')
    Keyboard.dismiss()
    router.push('/chat-attachment')
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

  launchCameraRef.current = launchCamera
  launchLibraryRef.current = launchLibrary

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

  const handleAddExercise = async (suggestion: ExerciseSuggestion) => {
    const suggestionKey = getExerciseSuggestionKey(suggestion)
    const currentState = exerciseActionState[suggestionKey]
    if (currentState === 'saving' || currentState === 'saved') {
      return
    }

    setExerciseActionState((prev) => ({ ...prev, [suggestionKey]: 'saving' }))

    try {
      if (onAddExercise) {
        await Promise.resolve(onAddExercise(suggestion))
      } else {
        const draft = await loadWorkoutDraft()
        const structuredData = draft?.structuredData || []
        const alreadyExists = structuredData.some(
          (exercise) =>
            exercise.name.trim().toLowerCase() ===
            suggestion.name.trim().toLowerCase(),
        )

        if (!alreadyExists) {
          const { targetRepsMin, targetRepsMax } = parseRepRangeFromSuggestion(
            suggestion.reps,
          )

          const newExercise: StructuredExerciseDraft = {
            id:
              Date.now().toString(36) + Math.random().toString(36).slice(2, 10),
            name: suggestion.name,
            sets: Array.from({ length: Math.max(1, suggestion.sets) }, () => ({
              weight: '',
              reps: '',
              isWarmup: false,
              lastWorkoutWeight: null,
              lastWorkoutReps: null,
              targetRepsMin,
              targetRepsMax,
              targetRestSeconds: null,
            })),
          }

          await saveDraft({
            notes: draft?.notes || '',
            title: draft?.title || '',
            structuredData: [...structuredData, newExercise],
            isStructuredMode: true,
            selectedRoutineId: draft?.selectedRoutineId ?? null,
            timerStartedAt: draft?.timerStartedAt ?? null,
            timerElapsedSeconds: draft?.timerElapsedSeconds ?? 0,
            updatedAt: Date.now(),
          })

          setLoadedDraftContext((prev) => {
            if (!prev) {
              return {
                title: draft?.title || '',
                notes: draft?.notes || '',
                exercises: [
                  {
                    name: suggestion.name,
                    setsCount: suggestion.sets,
                    sets: [],
                  },
                ],
              }
            }

            const hasExercise = prev.exercises.some(
              (exercise) =>
                exercise.name.trim().toLowerCase() ===
                suggestion.name.trim().toLowerCase(),
            )
            if (hasExercise) {
              return prev
            }

            return {
              ...prev,
              exercises: [
                ...prev.exercises,
                {
                  name: suggestion.name,
                  setsCount: suggestion.sets,
                  sets: [],
                },
              ],
            }
          })
        }
      }

      setProposedWorkout((prev) => {
        const alreadyAdded = prev.some(
          (exercise) => getExerciseSuggestionKey(exercise) === suggestionKey,
        )
        return alreadyAdded ? prev : [...prev, suggestion]
      })

      setExerciseActionState((prev) => ({ ...prev, [suggestionKey]: 'saved' }))
      hapticSuccess()
    } catch (error) {
      console.error('[WorkoutChat] Failed to add exercise suggestion:', error)
      setExerciseActionState((prev) => ({ ...prev, [suggestionKey]: 'error' }))
      Alert.alert('Unable to add exercise', 'Please try again.')
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

  const handleFoodLogAction = async (
    messageId: string,
    payload: FoodLogPayload,
  ) => {
    if (!user?.id) {
      Alert.alert('Sign In Required', 'Please sign in to save food logs.')
      return
    }

    setFoodActionState((prev) => ({ ...prev, [messageId]: 'saving' }))
    console.log('[FoodLog] Log action started:', {
      messageId,
      action: payload.action,
      summary: payload.summary,
      source: payload.source,
      confidence: payload.confidence,
    })

    try {
      const today = getLocalDateString()
      const mealPayload = {
        description: payload.summary,
        calories: payload.calories,
        protein_g: payload.protein_g,
        carbs_g: payload.carbs_g,
        fat_g: payload.fat_g,
        source:
          payload.action === 'update_last'
            ? ('correction' as const)
            : payload.source,
        confidence: payload.confidence,
        metadata: { from: 'chat_food_log' },
        logDate: today,
      }

      let savedMealId: string
      if (payload.action === 'update_last') {
        const mealIdToUpdate =
          loggedMealIdByMessage[messageId] || latestLoggedMealId
        console.log('[FoodLog] Update-last resolution:', {
          messageId,
          mealIdFromMessage: loggedMealIdByMessage[messageId] ?? null,
          latestLoggedMealId,
          resolvedMealId: mealIdToUpdate ?? null,
        })
        if (mealIdToUpdate) {
          const updated = await database.dailyLog.updateMeal(
            user.id,
            mealIdToUpdate,
            mealPayload,
          )
          savedMealId = updated.id
          console.log('[FoodLog] Updated existing meal:', {
            mealId: updated.id,
            daily_log_entry_id: updated.daily_log_entry_id,
          })
        } else {
          const inserted = await database.dailyLog.logMeal(user.id, mealPayload)
          savedMealId = inserted.id
          console.log('[FoodLog] No meal to update; inserted new meal:', {
            mealId: inserted.id,
            daily_log_entry_id: inserted.daily_log_entry_id,
          })
        }
      } else {
        const inserted = await database.dailyLog.logMeal(user.id, mealPayload)
        savedMealId = inserted.id
        console.log('[FoodLog] Inserted meal:', {
          mealId: inserted.id,
          daily_log_entry_id: inserted.daily_log_entry_id,
        })
      }

      setLoggedMealIdByMessage((prev) => ({
        ...prev,
        [messageId]: savedMealId,
      }))
      setLatestLoggedMealId(savedMealId)
      await refreshDailyLogSummary()
      setFoodActionState((prev) => ({ ...prev, [messageId]: 'saved' }))
      console.log('[FoodLog] Log action completed:', {
        messageId,
        savedMealId,
      })
      hapticSuccess()
    } catch (error) {
      console.error('[WorkoutChat] Failed to save meal log:', error)
      setFoodActionState((prev) => ({ ...prev, [messageId]: 'idle' }))
      Alert.alert('Could not save meal', 'Please try again.')
    }
  }

  const handleCopyMessage = (text: string) => {
    const copyText = text.trim()
    if (!copyText) return

    Clipboard.setString(copyText)
    haptic('light')
    if (Platform.OS === 'android') {
      ToastAndroid.show('Copied to clipboard', ToastAndroid.SHORT)
    }
  }

  const handleSendMessage = async (
    hiddenPrompt?: string,
    options?: {
      existingUserMessageId?: string
      existingUserContent?: string
      existingUserImages?: string[]
      forceImages?: string[] // bypass selectedImages state for immediate sends
      overrideInput?: string // bypass input state for immediate sends
      scanMode?: 'food_label' // routes request to Gemini OCR instead of GPT-4o
    },
  ) => {
    const isResend = Boolean(options?.existingUserMessageId)
    const effectiveImages =
      options?.forceImages ??
      (isResend ? options?.existingUserImages ?? [] : selectedImages)
    const hasImages = effectiveImages.length > 0
    const typedInput =
      options?.overrideInput?.trim() ||
      (isResend ? options?.existingUserContent?.trim() || '' : input.trim())
    const messageContent =
      hiddenPrompt || typedInput || (hasImages ? 'Please log this meal.' : '')
    if ((!messageContent && !hasImages) || isLoading) return

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
    const imagesToSend = options?.forceImages
      ? [...options.forceImages]
      : isResend
      ? [...(options?.existingUserImages || [])]
      : [...selectedImages]

    // Clear input immediately after validation if not hidden prompt and not overriding
    if (!hiddenPrompt && !isResend && !options?.overrideInput) {
      setInput('')
      setInputHeight(0)
      setSelectedImages([])
      inputRef.current?.clear()
      Keyboard.dismiss()
    }

    const userMessageId =
      options?.existingUserMessageId || Date.now().toString()
    const userMessage: Message = {
      id: userMessageId,
      role: 'user',
      content: messageContent,
      images: imagesToSend.length > 0 ? imagesToSend : undefined,
      status: hiddenPrompt ? undefined : 'sending',
    }

    // Show or update user message only for visible user sends
    if (!hiddenPrompt) {
      if (isResend) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === userMessage.id
              ? {
                  ...m,
                  content: userMessage.content,
                  images: userMessage.images,
                  status: 'sending',
                }
              : m,
          ),
        )
      } else {
        setMessages((prev) => [...prev, userMessage])
      }
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

      const requestMessages = isResend
        ? messages.map((m) =>
            m.id === userMessage.id
              ? {
                  ...m,
                  content: userMessage.content,
                  images: userMessage.images,
                  status: 'sending',
                }
              : m,
          )
        : [...messages, userMessage]

      const formattedMessages = [systemMessage, ...requestMessages].map(
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
        coachSystemPrompt?: string
        workoutContext?: {
          title?: string
          notes?: string
          exercises?: unknown
        }
        dailyLogSummary?: {
          logDate?: string
          totals?: {
            calories?: number
            protein_g?: number
            carbs_g?: number
            fat_g?: number
            meal_count?: number
          }
          goals?: {
            calorie_goal?: number | null
            protein_goal_g?: number | null
          }
        }
        images?: { type: string; image_url: { url: string } }[]
        scanMode?: 'food_label'
      }
      const requestBody: ChatRequestBody = {
        messages: formattedMessages,
        userId: user?.id,
        weightUnit,
        coachSystemPrompt: getCoach(coachId).systemPrompt,
        dailyLogSummary: dailyLogSummary
          ? {
              logDate: dailyLogSummary.logDate,
              totals: dailyLogSummary.totals,
              goals: dailyLogSummary.goals,
            }
          : undefined,
        // Include current workout context so AI knows what workout is in progress
        workoutContext: effectiveWorkoutContext
          ? {
              title: effectiveWorkoutContext.title,
              notes: effectiveWorkoutContext.notes,
              exercises: effectiveWorkoutContext.exercises,
            }
          : undefined,
        ...(options?.scanMode ? { scanMode: options.scanMode } : {}),
      }
      console.log('[FoodLog] Sending chat request context:', {
        hasDailyLogSummary: Boolean(requestBody.dailyLogSummary),
        dailyTotals: requestBody.dailyLogSummary?.totals,
        hasImages: imageBase64Array.length > 0,
        messageLength: messageContent.length,
      })

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

      if (!hiddenPrompt) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === userMessage.id ? { ...m, status: 'sent' } : m,
          ),
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
      setMessages((prev) => {
        const withUserStatus: Message[] = hiddenPrompt
          ? prev
          : prev.map((m) =>
              m.id === userMessage.id ? { ...m, status: 'failed' } : m,
            )

        return [
          ...withUserStatus,
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

  const handleResendMessage = (messageId: string) => {
    if (isLoading) return

    const failedMessage = messages.find(
      (message) =>
        message.id === messageId &&
        message.role === 'user' &&
        message.status === 'failed',
    )

    if (!failedMessage) return

    haptic('light')
    handleSendMessage(undefined, {
      existingUserMessageId: failedMessage.id,
      existingUserContent: failedMessage.content,
      existingUserImages: failedMessage.images,
    })
  }

  const handleNewChat = () => {
    haptic('light')
    closeWizardAndRestoreTabBar()
    setMessages([])
    setInput('')
    setInputHeight(0)
    setSelectedImages([])
    setFoodActionState({})
    setLoggedMealIdByMessage({})
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

      if (item.id === 'log_meal') {
        haptic('light')
        setIsFoodScannerVisible(true)
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
    closeWizardAndRestoreTabBar()

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
    const finalPrompt = buildWorkoutCreationPrompt(
      data,
      equipmentLabel,
      trainingGuidelines,
    )

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
        coachSystemPrompt: getCoach(coachId).systemPrompt,
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

          // Complete tutorial step for all users, but only consume trial for non-Pro
          if (parsed) {
            completeStep('generate_workout')
            if (!isProMember) {
              consumeTrial('ai_workout')
            }
          }
        }, 0)
      } else {
        // Stream silently - no placeholder message initially
        const fullContent = await processStreamingResponse(
          reader,
          null, // No ID, so it won't update messages during stream
          { silent: true },
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
        .is('created_by', null)

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

  const styles = createStyles(colors, { bottom: bottomSafeInset }, isDark, mode)

  return (
    <>
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.bg }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={keyboardVerticalOffset}
        onLayout={(e) => logLayout('root', e.nativeEvent.layout)}
      >
        <Modal
          visible={planningState.isActive && planningState.step === 'wizard'}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={closeWizardAndRestoreTabBar}
        >
          <WorkoutPlanningWizard
            colors={colors}
            onComplete={handleWizardComplete}
            onCancel={closeWizardAndRestoreTabBar}
            initialData={planningState.data}
            commonMuscles={planningState.commonMuscles}
          />
        </Modal>
        {!(planningState.isActive && planningState.step === 'wizard') && (
          <>
            {/* Top Left Menu Button - Toggles between Settings (if empty) and Clear (if messages) */}
            {mode === 'fullscreen' && (
              <>
                <LiquidGlassSurface
                  key={`plan-actions-glass-${navGlassKey}`}
                  debugLabel="plan-actions-group"
                  style={[styles.headerActionGroupGlass, { top: 8 }]}
                >
                  <View style={styles.headerActionGroup}>
                    <TouchableOpacity
                      style={styles.foodToggleButton}
                      onPress={() => {
                        haptic('light')
                        Keyboard.dismiss()
                        if (Platform.OS === 'ios' && dailyLogSummary) {
                          router.push({
                            pathname: '/daily-macros-detail',
                            params: {
                              logDate: dailyLogSummary.logDate,
                              entryId: dailyLogSummary.entryId || undefined,
                              totalsJson: JSON.stringify(
                                dailyLogSummary.totals,
                              ),
                              goalsJson: JSON.stringify(dailyLogSummary.goals),
                            },
                          })
                          return
                        }
                        setIsDailyMacrosSheetVisible(true)
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="nutrition"
                        size={24}
                        color={colors.brandPrimary}
                      />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.newChatButton}
                      onPress={
                        messages.length > 0
                          ? handleNewChat
                          : () => {
                              haptic('light')
                              if (Platform.OS === 'ios') {
                                router.push('/chat-settings')
                                return
                              }
                              setIsCoachSheetVisible(true)
                            }
                      }
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={
                          messages.length > 0
                            ? 'create-outline'
                            : 'settings-sharp'
                        }
                        size={24}
                        color={colors.brandPrimary}
                      />
                    </TouchableOpacity>
                  </View>
                </LiquidGlassSurface>
              </>
            )}
            <FlashList<Message>
              ref={messagesListRef}
              style={styles.messagesContainer}
              data={messages}
              keyExtractor={(item: Message) => item.id}
              getItemType={(item: Message) => item.role}
              estimatedItemSize={260}
              renderItem={({ item: message }: { item: Message }) => (
                <View
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
                            {message.images.map(
                              (imageUri: string, index: number) => (
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
                                    contentFit="cover"
                                  />
                                </TouchableOpacity>
                              ),
                            )}
                          </View>
                        )}
                        <TouchableOpacity
                          activeOpacity={0.9}
                          onLongPress={() => handleCopyMessage(message.content)}
                          delayLongPress={220}
                        >
                          <Text style={styles.userMessageText}>
                            {message.content}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {message.status === 'failed' && (
                        <View style={styles.userMessageMetaRow}>
                          <Text
                            style={[
                              styles.messageMetaStatusText,
                              styles.messageMetaStatusErrorText,
                            ]}
                          >
                            Failed to send
                          </Text>
                          <TouchableOpacity
                            style={styles.messageMetaActionButton}
                            onPress={() => handleResendMessage(message.id)}
                            disabled={isLoading}
                            activeOpacity={0.7}
                          >
                            <Ionicons
                              name="refresh"
                              size={13}
                              color={colors.statusError}
                            />
                            <Text
                              style={[
                                styles.messageMetaActionText,
                                styles.messageMetaActionErrorText,
                              ]}
                            >
                              Resend
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}
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
                                username={profile?.display_name}
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
                        const foodLogPayload = parseFoodLogPayload(
                          message.content,
                        )

                        // Calculate progress for chart rings
                        const { calorie_goal, protein_goal_g } =
                          dailyLogSummary?.goals || {}
                        const safeCalGoal = resolveCalorieGoal(
                          calorie_goal,
                          profile ?? null,
                        )
                        const safeProtGoal = protein_goal_g || 150
                        const safeCarbGoal = 250
                        const safeFatGoal = 70

                        const calProgress = foodLogPayload
                          ? Math.min(foodLogPayload.calories / safeCalGoal, 1)
                          : 0
                        const protProgress = foodLogPayload
                          ? Math.min(foodLogPayload.protein_g / safeProtGoal, 1)
                          : 0
                        const carbProgress = foodLogPayload
                          ? Math.min(foodLogPayload.carbs_g / safeCarbGoal, 1)
                          : 0
                        const fatProgress = foodLogPayload
                          ? Math.min(foodLogPayload.fat_g / safeFatGoal, 1)
                          : 0
                        const mealCountToday =
                          dailyLogSummary?.totals.meal_count ?? 0
                        const foodCardLabel = foodLogPayload
                          ? getFoodCardMealLabel(foodLogPayload, mealCountToday)
                          : `Meal ${Math.max(1, mealCountToday + 1)}`
                        const foodConfidenceLabel = foodLogPayload
                          ? formatFoodConfidenceLabel(foodLogPayload.confidence)
                          : 'Medium'
                        const confidenceTone =
                          foodLogPayload?.confidence || 'medium'
                        const {
                          bg: foodConfidenceBadgeBg,
                          border: foodConfidenceBadgeBorder,
                        } =
                          confidenceTone === 'high'
                            ? isDark
                              ? {
                                  bg: 'rgba(52, 199, 89, 0.14)',
                                  border: 'rgba(52, 199, 89, 0.28)',
                                }
                              : {
                                  bg: 'rgba(52, 199, 89, 0.12)',
                                  border: 'rgba(52, 199, 89, 0.22)',
                                }
                            : confidenceTone === 'low'
                            ? isDark
                              ? {
                                  bg: 'rgba(255, 159, 10, 0.14)',
                                  border: 'rgba(255, 159, 10, 0.28)',
                                }
                              : {
                                  bg: 'rgba(255, 159, 10, 0.12)',
                                  border: 'rgba(255, 159, 10, 0.22)',
                                }
                            : isDark
                            ? {
                                bg: 'rgba(255,255,255,0.06)',
                                border: 'rgba(255,255,255,0.16)',
                              }
                            : {
                                bg: 'rgba(255,255,255,0.52)',
                                border: 'rgba(255,255,255,0.38)',
                              }
                        const foodConfidenceColor =
                          confidenceTone === 'high'
                            ? '#34C759'
                            : confidenceTone === 'low'
                            ? '#FF9F0A'
                            : colors.textSecondary

                        const calCircumference = 28 * 2 * Math.PI
                        const smallCircumference = 16 * 2 * Math.PI
                        const displayContent = getVisibleAssistantMessageText(
                          message.content,
                        )

                        const exerciseSuggestions = parseExerciseSuggestions(
                          message.content,
                        )

                        // Don't render empty bubbles (prevents glitch when streaming JSON)
                        if (
                          !displayContent &&
                          exerciseSuggestions.length === 0 &&
                          !foodLogPayload
                        ) {
                          return null
                        }

                        return (
                          <>
                            <View style={styles.assistantMessageContent}>
                              {displayContent && (
                                <View style={styles.assistantCoachRow}>
                                  <View style={styles.messageAvatarContainer}>
                                    <Image
                                      source={coach.image}
                                      style={styles.messageAvatar}
                                    />
                                  </View>
                                  <View style={styles.assistantCoachBubbleWrap}>
                                    <TouchableOpacity
                                      activeOpacity={1}
                                      onLongPress={() =>
                                        handleCopyMessage(displayContent)
                                      }
                                      delayLongPress={220}
                                    >
                                      <View
                                        style={styles.assistantMessageBubble}
                                      >
                                        <Markdown
                                          style={{
                                            body: {
                                              fontSize: 16,
                                              lineHeight: 23,
                                              color: colors.textPrimary,
                                              margin: 0,
                                            },
                                            paragraph: {
                                              marginTop: 0,
                                              marginBottom: 2,
                                            },
                                            heading1: {
                                              fontSize: 22,
                                              fontWeight: '700',
                                              color: colors.textPrimary,
                                              marginTop: 16,
                                              marginBottom: 8,
                                            },
                                            heading2: {
                                              fontSize: 20,
                                              fontWeight: '700',
                                              color: colors.textPrimary,
                                              marginTop: 14,
                                              marginBottom: 6,
                                            },
                                            heading3: {
                                              fontSize: 18,
                                              fontWeight: '600',
                                              color: colors.textPrimary,
                                              marginTop: 12,
                                              marginBottom: 6,
                                            },
                                            code_inline: {
                                              backgroundColor: colors.bg,
                                              paddingHorizontal: 4,
                                              paddingVertical: 2,
                                              borderRadius: 4,
                                              fontSize: 15,
                                              fontFamily:
                                                Platform.OS === 'ios'
                                                  ? 'Menlo'
                                                  : 'monospace',
                                              color: colors.textPrimary,
                                            },
                                            code_block: {
                                              backgroundColor: colors.bg,
                                              padding: 12,
                                              borderRadius: 12,
                                              fontSize: 15,
                                              fontFamily:
                                                Platform.OS === 'ios'
                                                  ? 'Menlo'
                                                  : 'monospace',
                                              color: colors.textPrimary,
                                              marginVertical: 8,
                                              overflow: 'hidden',
                                            },
                                            fence: {
                                              backgroundColor: colors.bg,
                                              padding: 12,
                                              borderRadius: 12,
                                              fontSize: 15,
                                              fontFamily:
                                                Platform.OS === 'ios'
                                                  ? 'Menlo'
                                                  : 'monospace',
                                              color: colors.textPrimary,
                                              marginVertical: 8,
                                            },
                                            strong: {
                                              fontWeight: '600',
                                              color: colors.textPrimary,
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
                                              borderLeftColor:
                                                colors.brandPrimary,
                                              paddingLeft: 12,
                                              marginVertical: 8,
                                              backgroundColor: colors.bg,
                                              paddingVertical: 8,
                                              paddingRight: 8,
                                              borderRadius: 4,
                                            },
                                            link: {
                                              color: colors.brandPrimary,
                                              textDecorationLine: 'underline',
                                            },
                                          }}
                                        >
                                          {displayContent}
                                        </Markdown>
                                      </View>
                                    </TouchableOpacity>
                                  </View>
                                </View>
                              )}

                              {foodLogPayload && (
                                <TouchableOpacity
                                  activeOpacity={0.9}
                                  onPress={() => {
                                    if (dailyLogSummary?.logDate) {
                                      router.push({
                                        pathname: '/body-log/daily-food-log',
                                        params: {
                                          entryId:
                                            dailyLogSummary.entryId || 'new',
                                          logDate: dailyLogSummary.logDate,
                                          totalsJson: JSON.stringify(
                                            dailyLogSummary.totals,
                                          ),
                                          goalsJson: JSON.stringify(
                                            dailyLogSummary.goals,
                                          ),
                                        },
                                      })
                                    } else {
                                      router.push('/body-log/daily-food-log')
                                    }
                                  }}
                                  style={[
                                    styles.foodLogCard,
                                    !displayContent &&
                                      styles.foodLogCardStandalone,
                                  ]}
                                >
                                  <View style={styles.foodLogHeaderRow}>
                                    <View
                                      style={[
                                        styles.foodConfidenceBadge,
                                        {
                                          backgroundColor: isDark
                                            ? 'rgba(255,255,255,0.06)'
                                            : 'rgba(255,255,255,0.52)',
                                          borderWidth: 1,
                                          borderColor: isDark
                                            ? 'rgba(255,255,255,0.16)'
                                            : 'rgba(255,255,255,0.38)',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          marginRight: 10,
                                        },
                                      ]}
                                    >
                                      <Text style={styles.foodLogEyebrow}>
                                        {foodCardLabel}
                                      </Text>
                                    </View>
                                    <TouchableOpacity
                                      activeOpacity={0.7}
                                      style={[
                                        styles.foodConfidenceBadge,
                                        {
                                          backgroundColor: foodConfidenceBadgeBg,
                                          borderWidth: 1,
                                          borderColor: foodConfidenceBadgeBorder,
                                          flexDirection: 'row',
                                          alignItems: 'center',
                                          gap: 4,
                                        },
                                      ]}
                                      onPress={() => {
                                        haptic('light')
                                        Alert.alert(
                                          'AI Confidence',
                                          'This indicates how certain the AI is about its nutritional estimate based on your input: \n\n• High: Very certain (e.g., clear photo, exact description). \n• Medium: Good estimate, standard portion assumption.\n• Low: Best guess, details unclear.',
                                          [{ text: 'Got it' }],
                                        )
                                      }}
                                    >
                                      <Text
                                        style={[
                                          styles.foodConfidenceText,
                                          { color: foodConfidenceColor },
                                        ]}
                                      >
                                        {foodConfidenceLabel}
                                      </Text>
                                      <Ionicons
                                        name="information-circle-outline"
                                        size={14}
                                        color={foodConfidenceColor}
                                      />
                                    </TouchableOpacity>
                                  </View>

                                  {/* Calories Row (Full Width) */}
                                  <View style={styles.foodCaloriesCard}>
                                    <View>
                                      <Text style={styles.foodCaloriesValue}>
                                        {roundMacro(foodLogPayload.calories)}
                                      </Text>
                                      <Text style={styles.foodCaloriesLabel}>
                                        Calories
                                      </Text>
                                    </View>
                                    <View style={styles.chartContainer}>
                                      <Svg width={70} height={70}>
                                        <G rotation="-90" origin="35, 35">
                                          <Circle
                                            cx="35"
                                            cy="35"
                                            r="28"
                                            stroke={
                                              isDark ? colors.border : '#E5E5E5'
                                            }
                                            strokeWidth="6"
                                            fill="transparent"
                                          />
                                          <Circle
                                            cx="35"
                                            cy="35"
                                            r="28"
                                            stroke={colors.textPrimary}
                                            strokeWidth="6"
                                            fill="transparent"
                                            strokeDasharray={`${calCircumference}`}
                                            strokeDashoffset={`${
                                              calCircumference *
                                              (1 - calProgress)
                                            }`}
                                            strokeLinecap="round"
                                          />
                                        </G>
                                      </Svg>
                                      <View style={styles.chartIcon}>
                                        <Ionicons
                                          name="flame"
                                          size={20}
                                          color={colors.textPrimary}
                                        />
                                      </View>
                                    </View>
                                  </View>

                                  {/* Macros Grid (3 Cols) */}
                                  <View style={styles.foodMacroGrid}>
                                    {/* Protein */}
                                    <View style={styles.foodMacroCard}>
                                      <Text style={styles.foodMacroValueSmall}>
                                        {roundMacro(foodLogPayload.protein_g)}g
                                      </Text>
                                      <Text style={styles.foodMacroLabelSmall}>
                                        Protein
                                      </Text>
                                      <View style={styles.smallChartContainer}>
                                        <Svg width={40} height={40}>
                                          <G rotation="-90" origin="20, 20">
                                            <Circle
                                              cx="20"
                                              cy="20"
                                              r="16"
                                              stroke="rgba(248, 113, 113, 0.2)"
                                              strokeWidth="4"
                                              fill="transparent"
                                            />
                                            <Circle
                                              cx="20"
                                              cy="20"
                                              r="16"
                                              stroke="#F87171"
                                              strokeWidth="4"
                                              fill="transparent"
                                              strokeDasharray={`${smallCircumference}`}
                                              strokeDashoffset={`${
                                                smallCircumference *
                                                (1 - protProgress)
                                              }`}
                                              strokeLinecap="round"
                                            />
                                          </G>
                                        </Svg>
                                        <View style={styles.chartIcon}>
                                          <MaterialCommunityIcons
                                            name="food-drumstick"
                                            size={12}
                                            color="#F87171"
                                          />
                                        </View>
                                      </View>
                                    </View>

                                    {/* Carbs */}
                                    <View style={styles.foodMacroCard}>
                                      <Text style={styles.foodMacroValueSmall}>
                                        {roundMacro(foodLogPayload.carbs_g)}g
                                      </Text>
                                      <Text style={styles.foodMacroLabelSmall}>
                                        Carbs
                                      </Text>
                                      <View style={styles.smallChartContainer}>
                                        <Svg width={40} height={40}>
                                          <G rotation="-90" origin="20, 20">
                                            <Circle
                                              cx="20"
                                              cy="20"
                                              r="16"
                                              stroke="rgba(251, 191, 36, 0.2)"
                                              strokeWidth="4"
                                              fill="transparent"
                                            />
                                            <Circle
                                              cx="20"
                                              cy="20"
                                              r="16"
                                              stroke="#FBBF24"
                                              strokeWidth="4"
                                              fill="transparent"
                                              strokeDasharray={`${smallCircumference}`}
                                              strokeDashoffset={`${
                                                smallCircumference *
                                                (1 - carbProgress)
                                              }`}
                                              strokeLinecap="round"
                                            />
                                          </G>
                                        </Svg>
                                        <View style={styles.chartIcon}>
                                          <Ionicons
                                            name="nutrition"
                                            size={12}
                                            color="#FBBF24"
                                          />
                                        </View>
                                      </View>
                                    </View>

                                    {/* Fat */}
                                    <View style={styles.foodMacroCard}>
                                      <Text style={styles.foodMacroValueSmall}>
                                        {roundMacro(foodLogPayload.fat_g)}g
                                      </Text>
                                      <Text style={styles.foodMacroLabelSmall}>
                                        Fats
                                      </Text>
                                      <View style={styles.smallChartContainer}>
                                        <Svg width={40} height={40}>
                                          <G rotation="-90" origin="20, 20">
                                            <Circle
                                              cx="20"
                                              cy="20"
                                              r="16"
                                              stroke="rgba(96, 165, 250, 0.2)"
                                              strokeWidth="4"
                                              fill="transparent"
                                            />
                                            <Circle
                                              cx="20"
                                              cy="20"
                                              r="16"
                                              stroke="#60A5FA"
                                              strokeWidth="4"
                                              fill="transparent"
                                              strokeDasharray={`${smallCircumference}`}
                                              strokeDashoffset={`${
                                                smallCircumference *
                                                (1 - fatProgress)
                                              }`}
                                              strokeLinecap="round"
                                            />
                                          </G>
                                        </Svg>
                                        <View style={styles.chartIcon}>
                                          <Ionicons
                                            name="water"
                                            size={12}
                                            color="#60A5FA"
                                          />
                                        </View>
                                      </View>
                                    </View>
                                  </View>

                                  {(() => {
                                    const state =
                                      foodActionState[message.id] || 'idle'
                                    const isSaving = state === 'saving'
                                    const isSaved = state === 'saved'

                                    // Only show 'Update' if the LLM thinks it's an update AND there's actually a meal we can update
                                    // (either logged via this specific message before, or a previous one)
                                    const canActuallyUpdate = !!(
                                      loggedMealIdByMessage[message.id] ||
                                      latestLoggedMealId
                                    )
                                    const isUpdateAction =
                                      foodLogPayload.action === 'update_last' &&
                                      canActuallyUpdate

                                    const buttonLabel = isSaved
                                      ? 'Logged'
                                      : isUpdateAction
                                      ? 'Update'
                                      : 'Log Meal'

                                    return (
                                      <TouchableOpacity
                                        style={[
                                          styles.foodLogActionButton,
                                          isSaved &&
                                            styles.foodLogActionButtonDone,
                                        ]}
                                        onPress={() =>
                                          handleFoodLogAction(
                                            message.id,
                                            foodLogPayload,
                                          )
                                        }
                                        disabled={isSaving || isSaved}
                                        activeOpacity={0.85}
                                      >
                                        {isSaving ? (
                                          <ActivityIndicator
                                            size="small"
                                            color={colors.bg}
                                          />
                                        ) : (
                                          <Ionicons
                                            name={
                                              isSaved
                                                ? 'checkmark-circle'
                                                : 'add-circle'
                                            }
                                            size={24}
                                            color={colors.bg}
                                          />
                                        )}
                                        <Text
                                          style={styles.foodLogActionButtonText}
                                        >
                                          {isSaving
                                            ? 'Logging...'
                                            : buttonLabel}
                                        </Text>
                                      </TouchableOpacity>
                                    )
                                  })()}
                                </TouchableOpacity>
                              )}

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
                                      const suggestionKey = getExerciseSuggestionKey(
                                        suggestion,
                                      )
                                      const addState =
                                        exerciseActionState[suggestionKey] ||
                                        'idle'
                                      const isSavingAdd = addState === 'saving'
                                      const isAdded = addState === 'saved'
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
                                          style={[
                                            styles.exerciseCard,
                                            isLast
                                              ? null
                                              : styles.exerciseCardSpacing,
                                          ]}
                                        >
                                          <TouchableOpacity
                                            style={[
                                              styles.exerciseCardThumbnail,
                                              gifUrl
                                                ? styles.exerciseCardThumbnailImage
                                                : null,
                                            ]}
                                            onPress={handleNavigateToExercise}
                                            disabled={
                                              !canNavigate || mode === 'sheet'
                                            }
                                            activeOpacity={
                                              canNavigate && mode !== 'sheet'
                                                ? 0.7
                                                : 1
                                            }
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

                                          <View style={styles.exerciseCardInfo}>
                                            <TouchableOpacity
                                              onPress={handleNavigateToExercise}
                                              disabled={
                                                !canNavigate || mode === 'sheet'
                                              }
                                              activeOpacity={
                                                canNavigate && mode !== 'sheet'
                                                  ? 0.7
                                                  : 1
                                              }
                                            >
                                              <Text
                                                style={styles.exerciseCardName}
                                              >
                                                {suggestion.name}
                                              </Text>
                                            </TouchableOpacity>
                                            <Text
                                              style={styles.exerciseCardDetails}
                                            >
                                              {suggestion.sets} sets ×{' '}
                                              {suggestion.reps} reps
                                            </Text>
                                          </View>
                                          <TouchableOpacity
                                            style={[
                                              styles.addExerciseButton,
                                              isAdded &&
                                                styles.addExerciseButtonSaved,
                                            ]}
                                            onPress={() => {
                                              if (exerciseToReplace) {
                                                handleReplaceExercise(
                                                  suggestion,
                                                )
                                                return
                                              }

                                              handleAddExercise(suggestion)
                                            }}
                                            disabled={isSavingAdd || isAdded}
                                          >
                                            {isSavingAdd ? (
                                              <ActivityIndicator
                                                size="small"
                                                color={colors.surface}
                                              />
                                            ) : (
                                              <Ionicons
                                                name={
                                                  isAdded
                                                    ? 'checkmark'
                                                    : exerciseToReplace
                                                    ? 'swap-horizontal'
                                                    : 'add'
                                                }
                                                size={20}
                                                color={colors.surface}
                                              />
                                            )}
                                          </TouchableOpacity>
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
              )}
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
              onLayout={(e: LayoutChangeEvent) =>
                logLayout('scrollView', e.nativeEvent.layout)
              }
              onContentSizeChange={() => {
                ;(messages.length > 0 || isLoading) && scrollToBottom()
              }}
              ListEmptyComponent={
                messages.length === 0 && !isLoading && !input.trim() ? (
                  <View style={styles.emptyState}>
                    {mode === 'fullscreen' && (
                      <View style={styles.welcomeSection}>
                        <View style={styles.coachWelcomeContainer}>
                          <Image
                            source={getCoach(coachId).image}
                            style={styles.coachWelcomeImage}
                            contentFit="cover"
                          />
                        </View>
                        <Text style={styles.welcomeDescription}>
                          Create personalized workouts, log meals, and track
                          macros
                        </Text>
                      </View>
                    )}
                  </View>
                ) : null
              }
              ListFooterComponent={
                <>
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
                  <View style={styles.chatMessages} />
                </>
              }
            />

            {/* Suggestions Row */}
            {!generatedPlanContent &&
              !planningState.isActive &&
              !messages.some((m) => m.role === 'user') &&
              !input.trim() && (
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
                              (item.id === 'tell_me_about' ||
                                item.id === 'how_to') && {
                                borderWidth: 0,
                                borderColor: 'transparent',
                              },
                            ]}
                            textStyle={[
                              styles.suggestionText,
                              (item.id === 'plan_workout' ||
                                item.id === 'adjust_workout') &&
                                styles.planWorkoutText,
                            ]}
                            icon={
                              item.icon ? (
                                <Ionicons
                                  name={
                                    item.id === 'plan_workout' ||
                                    item.id === 'adjust_workout'
                                      ? 'flash'
                                      : (item.icon as any)
                                  }
                                  size={16}
                                  color={
                                    item.id === 'plan_workout' ||
                                    item.id === 'adjust_workout'
                                      ? colors.brandPrimary
                                      : colors.textPrimary
                                  }
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
                                color={colors.brandPrimary}
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
                      ? Math.max(bottomSafeInset, 16) +
                        (isKeyboardVisible ? 10 : 0)
                      : isKeyboardVisible
                      ? Math.max(bottomSafeInset, 12)
                      : Math.max(bottomSafeInset, 12) + closedTabBarPadding,
                },
              ]}
              onLayout={(e) =>
                logLayout('inputContainer', e.nativeEvent.layout)
              }
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
                        contentFit="cover"
                      />
                      <TouchableOpacity
                        style={styles.removeImageButton}
                        onPress={() => removeImage(index)}
                      >
                        <Ionicons
                          name="close"
                          size={14}
                          color={colors.surface}
                        />
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
                {/* Left button: cancel during recording or image picker otherwise */}
                {isRecording || isTranscribing ? (
                  <LiquidGlassSurface
                    key={`plan-cancel-glass-${composerGlassKey}`}
                    style={styles.addImageButtonGlass}
                    debugLabel="plan-cancel-button"
                  >
                    <TouchableOpacity
                      style={styles.addImageButton}
                      onPress={stopRecording}
                      disabled={isTranscribing}
                    >
                      <Ionicons
                        name="square"
                        size={14}
                        color={colors.textSecondary}
                      />
                    </TouchableOpacity>
                  </LiquidGlassSurface>
                ) : (
                  !hideImagePicker && (
                    <LiquidGlassSurface
                      key={`plan-image-button-glass-${composerGlassKey}`}
                      style={styles.addImageButtonGlass}
                      debugLabel="plan-image-button"
                    >
                      <TouchableOpacity
                        style={styles.addImageButton}
                        onPress={showImagePickerActionSheet}
                        disabled={isLoading}
                      >
                        <Ionicons
                          name="add"
                          size={22}
                          color={
                            isLoading
                              ? colors.textPlaceholder
                              : colors.textPrimary
                          }
                        />
                      </TouchableOpacity>
                    </LiquidGlassSurface>
                  )
                )}

                {/* Main input pill — always LiquidGlassSurface */}
                <LiquidGlassSurface
                  key={`plan-chat-input-glass-${composerGlassKey}`}
                  style={styles.textInputGlass}
                  debugLabel="plan-chat-input"
                >
                  <View
                    style={[
                      styles.textInputContainer,
                      isRecording && styles.textInputContainerRecording,
                    ]}
                  >
                    {/* Content area: visualizer OR text input */}
                    {isRecording ? (
                      <RecordingIndicator colors={colors} />
                    ) : (
                      <View style={styles.inputInnerWrapper}>
                        <TextInput
                          ref={inputRef}
                          style={styles.input}
                          placeholder={
                            generatedPlanContent
                              ? 'Make changes to your plan...'
                              : 'Ask anything'
                          }
                          placeholderTextColor={colors.textPlaceholder}
                          value={input}
                          onChangeText={setInput}
                          multiline
                          maxLength={500}
                          returnKeyType="send"
                          onSubmitEditing={() => handleSendMessage()}
                          blurOnSubmit={false}
                          editable={!isLoading && !isTranscribing}
                          onContentSizeChange={(e) => {
                            const h = e.nativeEvent.contentSize.height
                            setInputHeight(Math.min(Math.max(h, 22), 120))
                          }}
                          scrollEnabled={inputHeight >= 120}
                        />
                        {/* Mic icon — visible only when input is empty */}
                        {!input.trim() && (
                          <TouchableOpacity
                            style={styles.micButtonInside}
                            onPress={toggleRecording}
                            disabled={isLoading}
                          >
                            <Ionicons
                              name="mic-outline"
                              size={19}
                              color={colors.textPlaceholder}
                            />
                          </TouchableOpacity>
                        )}
                      </View>
                    )}

                    {/* Right action button */}
                    {isRecording ? (
                      <TouchableOpacity
                        style={[
                          styles.sendButton,
                          styles.recordingSendButton,
                          { backgroundColor: colors.textPrimary },
                        ]}
                        onPress={toggleRecording}
                        disabled={isTranscribing}
                      >
                        {isTranscribing ? (
                          <ActivityIndicator
                            size="small"
                            color={colors.surface}
                          />
                        ) : (
                          <Ionicons
                            name="arrow-up"
                            size={17}
                            color={colors.surface}
                          />
                        )}
                      </TouchableOpacity>
                    ) : isTranscribing ? (
                      <TouchableOpacity
                        style={[
                          styles.sendButton,
                          { backgroundColor: colors.textPrimary },
                        ]}
                        onPress={toggleRecording}
                        disabled={isTranscribing}
                      >
                        {isTranscribing ? (
                          <ActivityIndicator
                            size="small"
                            color={colors.surface}
                          />
                        ) : (
                          <Ionicons
                            name="arrow-up"
                            size={17}
                            color={colors.surface}
                          />
                        )}
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={[
                          styles.sendButton,
                          ((!input.trim() && selectedImages.length === 0) ||
                            isLoading) &&
                            styles.sendButtonDisabled,
                        ]}
                        onPress={() => handleSendMessage()}
                        disabled={
                          (!input.trim() && selectedImages.length === 0) ||
                          isLoading
                        }
                      >
                        {isLoading ? (
                          <ActivityIndicator
                            size="small"
                            color={colors.surface}
                          />
                        ) : (
                          <Ionicons
                            name="arrow-up"
                            size={17}
                            color={colors.surface}
                          />
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                </LiquidGlassSurface>
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
                  <Ionicons name="close" size={28} color={colors.surface} />
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
                            contentFit="contain"
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

      <FoodScannerModal
        visible={isFoodScannerVisible}
        onClose={() => setIsFoodScannerVisible(false)}
        onScanFood={(imageUri) => {
          setIsFoodScannerVisible(false)
          if (selectedImages.length < MAX_IMAGES) {
            setSelectedImages((prev) => [...prev, imageUri])
          } else {
            Alert.alert(
              'Maximum Images Reached',
              `You can only add up to ${MAX_IMAGES} images per message.`,
            )
          }
        }}
        onScanFoodLabel={(imageUri) => {
          setIsFoodScannerVisible(false)
          const prompt = `I've scanned a nutrition label. Please read the label in this image and tell me: the product name, the serving size, and the macros per serving (calories, protein, carbs, fat). Then ask me how many servings I had so you can log the correct amount. Do NOT output a <food_log> block yet — wait for me to tell you the quantity first.`
          handleSendMessage(prompt, {
            forceImages: [imageUri],
            scanMode: 'food_label',
          })
        }}
        onScanBarcode={(productData) => {
          setIsFoodScannerVisible(false)
          if (productData.error || productData.not_found) {
            Alert.alert(
              'Barcode Not Found',
              "We couldn't find food data for this barcode.",
            )
            return
          }

          const name = productData.product_name || 'Item'
          const brand = productData.brands ? ` (${productData.brands})` : ''
          const serving = productData.serving_size || '1 serving'

          const cals =
            productData.nutriments?.['energy-kcal'] ||
            productData.nutriments?.['energy-kcal_100g'] ||
            0
          const protein =
            productData.nutriments?.proteins ||
            productData.nutriments?.proteins_value ||
            0
          const carbs =
            productData.nutriments?.carbohydrates ||
            productData.nutriments?.carbohydrates_value ||
            0
          const fat =
            productData.nutriments?.fat ||
            productData.nutriments?.fat_value ||
            0

          setInput(
            `Log ${serving} of ${name}${brand} (${cals} kcal, ${protein}p, ${carbs}c, ${fat}f)`,
          )
          setTimeout(() => inputRef.current?.focus(), 500)
        }}
      />

      <CoachSelectionSheet
        visible={isCoachSheetVisible}
        onClose={() => setIsCoachSheetVisible(false)}
        currentCalorieGoal={
          dailyLogSummary?.goals.calorie_goal ?? maintenanceCalories ?? null
        }
        onUpdateCalorieGoal={handleUpdateCalorieGoal}
      />
      {dailyLogSummary && Platform.OS !== 'ios' && (
        <DailyMacrosSheet
          visible={isDailyMacrosSheetVisible}
          onClose={() => setIsDailyMacrosSheetVisible(false)}
          totals={dailyLogSummary.totals}
          goals={dailyLogSummary.goals}
          maintenanceCalories={maintenanceCalories}
          onUpdateCalorieGoal={handleUpdateCalorieGoal}
        />
      )}
    </>
  )
}

function createStyles(
  colors: ReturnType<typeof useThemedColors>,
  insets: { bottom: number },
  isDark: boolean,
  mode: 'fullscreen' | 'sheet',
) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    newChatButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 0,
    },
    newChatButtonGlass: {
      position: 'absolute',
      right: 16,
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 10,
    },
    headerActionGroupGlass: {
      position: 'absolute',
      right: 20,
      width: 104,
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 10,
    },
    headerActionGroup: {
      width: '100%',
      height: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
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
      backgroundColor: colors.brandPrimary,
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
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.brandPrimary,
      shadowOpacity: 0.05,
    },
    actionButtonText: {
      color: colors.surface,
      fontSize: 15,
      fontWeight: '600',
    },
    secondaryActionButtonText: {
      color: colors.brandPrimary,
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
    welcomeDescription: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 16,
      paddingHorizontal: 24,
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
      alignItems: 'flex-start',
      marginBottom: 16,
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
      backgroundColor: colors.surfaceSubtle,
    },
    userMessageBubble: {
      maxWidth: '80%',
    },
    userMessageContent: {
      backgroundColor: colors.textPrimary,
      paddingVertical: 9,
      paddingHorizontal: 11,
      borderRadius: 18,
      borderBottomRightRadius: 4,
    },
    userMessageText: {
      fontSize: 16,
      lineHeight: 22,
      color: isDark ? colors.bg : colors.surface,
    },
    userMessageMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 6,
      paddingRight: 2,
    },
    assistantMessageContent: {
      width: '100%',
      paddingVertical: 0,
    },
    assistantCoachRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
    },
    assistantCoachBubbleWrap: {
      maxWidth: '85%',
    },
    assistantMessageMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 6,
      paddingLeft: 2,
    },
    messageMetaActionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 2,
      paddingHorizontal: 4,
      borderRadius: 10,
    },
    messageMetaActionText: {
      fontSize: 12,
      color: colors.textTertiary,
      fontWeight: '500',
    },
    messageMetaActionErrorText: {
      color: colors.statusError,
    },
    messageMetaStatusText: {
      fontSize: 12,
      color: colors.textTertiary,
      fontWeight: '500',
    },
    messageMetaStatusErrorText: {
      color: colors.statusError,
    },
    workoutCardContainer: {
      flex: 1,
      width: '100%',
    },
    assistantMessageBubble: {
      backgroundColor: isDark ? '#2C2C2E' : colors.surfaceSubtle,
      paddingVertical: 9,
      paddingHorizontal: 11,
      borderRadius: 18,
      borderBottomLeftRadius: 4,
    },
    foodLogCard: {
      marginTop: 12,
      width: '100%',
      borderRadius: 24,
      backgroundColor: isDark ? colors.surfaceCard : '#F2F2F7', // matches app surfaceCard
      padding: 16,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 4,
      borderWidth: 1,
      borderColor: isDark ? colors.border : '#E5E5E5',
    },
    foodLogCardStandalone: {
      marginTop: 0,
    },
    foodLogHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    foodLogHeaderText: {
      flex: 1,
      marginRight: 10,
    },
    foodLogEyebrow: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginBottom: 0,
    },
    foodConfidenceBadge: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
    },
    foodConfidenceText: {
      fontSize: 12,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      color: colors.textSecondary,
    },
    foodCaloriesCard: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: isDark ? colors.surfaceSubtle : '#FFFFFF',
      borderRadius: 20,
      padding: 20,
      marginBottom: 10,
      width: '100%',
    },
    foodCaloriesValue: {
      fontSize: 32,
      fontWeight: '800',
      color: colors.textPrimary,
      letterSpacing: -1,
      marginBottom: 4,
    },
    foodCaloriesLabel: {
      fontSize: 15,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    chartContainer: {
      position: 'relative',
      justifyContent: 'center',
      alignItems: 'center',
    },
    chartIcon: {
      position: 'absolute',
      justifyContent: 'center',
      alignItems: 'center',
    },
    smallChartContainer: {
      marginTop: 12,
      position: 'relative',
      justifyContent: 'center',
      alignItems: 'center',
    },
    foodMacroGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      width: '100%',
      gap: 10,
    },
    foodMacroCard: {
      flex: 1,
      backgroundColor: isDark ? colors.surfaceSubtle : '#FFFFFF',
      borderRadius: 20,
      paddingVertical: 16,
      paddingHorizontal: 12,
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    foodMacroValueSmall: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 4,
    },
    foodMacroLabelSmall: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    foodLogActionButton: {
      marginTop: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: 20,
      paddingVertical: 16,
      backgroundColor: colors.textPrimary, // Contrast button
      width: '100%',
    },
    foodLogActionButtonDone: {
      backgroundColor: colors.statusSuccess,
    },
    foodLogActionButtonText: {
      color: colors.bg,
      fontSize: 16,
      fontWeight: '700',
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
      backgroundColor: `${colors.brandPrimary}12`,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.brandPrimary,
      gap: 5,
      marginHorizontal: 2,
    },
    welcomeHintButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.brandPrimary,
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
    textInputGlass: {
      flex: 1,
      borderRadius: 20,
    },
    textInputContainer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingLeft: 14,
      paddingRight: 4,
      paddingBottom: 4,
      paddingTop: 4,
      minHeight: 40,
    },
    textInputContainerRecording: {
      alignItems: 'center',
      paddingLeft: 4,
    },
    input: {
      flex: 1,
      fontSize: 16,
      lineHeight: 22,
      color: colors.textPrimary,
      minHeight: 32,
      maxHeight: 120,
      textAlignVertical: 'top',
      paddingTop: Platform.OS === 'ios' ? 5 : 0,
      paddingBottom: Platform.OS === 'ios' ? 5 : 0,
      marginRight: 6,
    },
    inputInnerWrapper: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'flex-end',
    },
    recordingSendButton: {
      marginLeft: 4,
    },
    recordingText: {
      fontSize: 15,
      color: colors.textSecondary,
      marginRight: 6,
    },
    micButtonInside: {
      padding: 6,
      justifyContent: 'center',
      alignItems: 'center',
    },
    sendButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.textPrimary,
      justifyContent: 'center',
      alignItems: 'center',
      flexShrink: 0,
    },
    sendButtonDisabled: {
      backgroundColor: colors.textPlaceholder,
      opacity: 0.4,
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
      backgroundColor: isDark ? '#2C2C2E' : colors.surfaceSubtle,
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
      backgroundColor: colors.bg,
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
      backgroundColor: isDark
        ? mode === 'sheet'
          ? colors.surfaceSubtle
          : colors.surfaceCard
        : '#f4f4f5',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 24,
      borderWidth: 0,
    },
    planWorkoutBubble: {
      backgroundColor: `${colors.brandPrimary}15`,
    },
    planWorkoutText: {
      color: colors.brandPrimary,
      fontWeight: '600',
    },
    suggestionBackBubble: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: isDark
        ? mode === 'sheet'
          ? colors.surfaceSubtle
          : colors.surfaceCard
        : '#f4f4f5',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 0,
    },
    suggestionText: {
      fontSize: 15,
      color: colors.textPrimary,
      fontWeight: '600',
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
      borderRadius: 12,
    },
    removeImageButton: {
      position: 'absolute',
      top: -6,
      right: -6,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.statusError || '#FF3B30',
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
      backgroundColor: colors.surfaceSubtle,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    imageCountText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    addImageButtonGlass: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    addImageButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
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
      borderRadius: 12,
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
      backgroundColor: colors.bg,
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
      backgroundColor: colors.surface,
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
      color: colors.textPrimary,
      marginBottom: 16,
      textAlign: 'center',
    },
    bottomSheetOption: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      backgroundColor: colors.surfaceSubtle,
      borderRadius: 12,
      marginBottom: 8,
    },
    bottomSheetOptionIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    bottomSheetOptionText: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.textPrimary,
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
      color: colors.surface,
      fontSize: 16,
      fontWeight: '600',
    },
    // Exercise suggestion cards (for sheet mode with onAddExercise)
    exerciseCardsContainer: {
      marginTop: 12,
      alignSelf: 'stretch',
    },
    exerciseCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceSubtle,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    exerciseCardSpacing: {
      marginBottom: 8,
    },
    exerciseCardThumbnail: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: colors.bg,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: 10,
    },
    exerciseCardThumbnailImage: {
      overflow: 'hidden',
      borderWidth: 0,
      padding: 0,
    },
    exerciseCardInfo: {
      flex: 1,
    },
    exerciseCardName: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textPrimary,
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
      backgroundColor: colors.brandPrimary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    addExerciseButtonSaved: {
      backgroundColor: '#34C759',
    },
    suggestionThumbnailImage: {
      width: '100%',
      height: '100%',
    },
    foodToggleButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 0,
    },
    foodToggleButtonGlass: {
      position: 'absolute',
      left: 16,
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 10,
    },
  })
}
