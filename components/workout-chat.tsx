import { ExerciseMediaThumbnail } from '@/components/ExerciseMedia'
import { CoachSelectionSheet } from '@/components/coach-selection-sheet'
import { FoodScannerModal } from '@/components/food-scanner'
import { LiquidGlassSurface } from '@/components/liquid-glass-surface'
import {
  ManualFoodLogData,
  ManualFoodLogSheet,
} from '@/components/manual-food-log-sheet'
import { Paywall } from '@/components/paywall'
import { ProgramCard } from '@/components/program-card'
import { WorkoutCard } from '@/components/workout-card'
import {
  DEFAULT_WORKOUT_DURATION,
  EQUIPMENT_PREF_KEY,
  WORKOUT_PLANNING_PREFS_KEY,
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
import { trimChatMessagesForRequest } from '@/lib/ai/chat-history'
import {
  ParsedWorkoutDisplay,
  ParsedProgramDisplay,
  parseProgramForDisplay,
  parseWorkoutForDisplay,
} from '@/lib/ai/workoutParsing'
import { callChatFunction, mapChatApiErrorToMessage } from '@/lib/api/chat'
import {
  buildProgramModificationSuffix,
  buildWorkoutCreationPrompt,
  buildWorkoutModificationSuffix,
} from '@/lib/ai/workoutPrompt'
import { consumePendingChatAttachment } from '@/lib/chat-attachment-handoff'
import { getCoach, getCoachTrainingGuidelines } from '@/lib/coaches'
import { database } from '@/lib/database'
import { consumePendingFoodLibraryChatText } from '@/lib/food-library-handoff'
import { haptic, hapticSuccess } from '@/lib/haptics'
import {
  resolveCalorieGoal,
} from '@/lib/nutrition'
import { getWeeklyCommitmentTarget } from '@/lib/commitment'
import { exerciseLookup } from '@/lib/services/exerciseLookup'
import { supabase } from '@/lib/supabase'
import { withDailyLogMealImagePath } from '@/lib/utils/daily-log-meals'
import { findExerciseByName } from '@/lib/utils/exercise-matcher'
import { uploadMealImage } from '@/lib/utils/meal-image-storage'
import {
  loadDraft as loadWorkoutDraft,
  saveDraft,
  StructuredExerciseDraft,
} from '@/lib/utils/workout-draft'
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useFocusEffect, useIsFocused } from '@react-navigation/native'
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

const GOAL_PROMPT_LABELS: Record<string, string> = {
  build_muscle: 'building muscle',
  lose_fat: 'losing fat',
  gain_strength: 'getting stronger',
  improve_cardio: 'improving conditioning',
  become_flexible: 'improving mobility',
  general_fitness: 'improving overall fitness',
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  images?: string[] // Image URIs for display
  linkedUserMessageId?: string
  createdAt?: string
  status?: 'sending' | 'sent' | 'failed'
}

type StreamingResponseResult = {
  content: string
  interrupted: boolean
}

type ParsedRepTargets = {
  repsMin: number | null
  repsMax: number | null
}

type FoodLogAction = 'log' | 'update_last'
type FoodLogConfidence = 'low' | 'medium' | 'high'
type FoodLogSource = 'text' | 'photo' | 'voice' | 'manual' | 'correction'
type StatsTrend = 'up' | 'down' | 'flat'
type ChatEquipmentPreference =
  | 'full_gym'
  | 'home_minimal'
  | 'dumbbells_only'
  | 'bodyweight'
  | 'barbell_only'

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

const parseRepTargets = (reps: string): ParsedRepTargets => {
  const rangeMatch = reps.match(/(\d+)\s*[-–]\s*(\d+)/)
  if (rangeMatch) {
    return {
      repsMin: parseInt(rangeMatch[1], 10),
      repsMax: parseInt(rangeMatch[2], 10),
    }
  }

  const singleRep = parseInt(reps, 10)
  if (!Number.isNaN(singleRep)) {
    return {
      repsMin: singleRep,
      repsMax: singleRep,
    }
  }

  return {
    repsMin: null,
    repsMax: null,
  }
}

interface StatsReportMetric {
  id: string
  label: string
  value: string
  delta?: string
  trend?: StatsTrend
}

interface StatsReportLift {
  exercise: string
  value: string
  delta?: string
  trend?: StatsTrend
}

interface StatsReportMuscle {
  muscle_group: string
  percentage: number
}

interface StatsReportPayload {
  version: number
  title?: string
  period_label?: string
  summary?: string
  highlights: StatsReportMetric[]
  top_lifts: StatsReportLift[]
  muscle_balance: StatsReportMuscle[]
  focus_areas: string[]
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

type SuggestionPromptOption = {
  text: string
  prompt: string
}

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

function normalizeWizardGoal(goal?: string | null): string | undefined {
  if (!goal) return undefined

  switch (goal) {
    case 'Strength':
    case 'Bodybuilding':
    case 'Powerlifting':
    case 'CrossFit':
    case 'Calisthenics':
      return goal
    case 'Hypertrophy':
      return 'Bodybuilding'
    case 'Fat Loss / HIIT':
    case 'Endurance':
      return 'CrossFit'
    case 'General Fitness':
      return 'Calisthenics'
    default:
      return undefined
  }
}

function getDefaultWizardGoalFromProfileGoals(
  goals?: string[] | null,
): string {
  switch (goals?.[0]) {
    case 'build_muscle':
      return 'Bodybuilding'
    case 'gain_strength':
      return 'Strength'
    case 'lose_fat':
    case 'improve_cardio':
      return 'CrossFit'
    case 'become_flexible':
      return 'Calisthenics'
    case 'general_fitness':
      return 'Strength'
    default:
      return 'Strength'
  }
}

function getDefaultWizardIntensity(experienceLevel?: string | null): string {
  switch (experienceLevel) {
    case 'advanced':
      return 'High'
    case 'intermediate':
      return 'Moderate'
    default:
      return 'Basic'
  }
}

function normalizeWizardEquipment(
  equipment?: string | null,
): WorkoutPlanningData['equipment'] | undefined {
  if (
    equipment === 'full_gym' ||
    equipment === 'home_minimal' ||
    equipment === 'dumbbells_only' ||
    equipment === 'bodyweight'
  ) {
    return equipment
  }

  if (equipment === 'barbell_only') {
    return 'full_gym'
  }

  return undefined
}

function getDefaultWizardMuscles(
  commitmentTarget: number,
  experienceLevel?: string | null,
): string {
  if (experienceLevel === 'beginner' || commitmentTarget <= 3) {
    return 'Full'
  }

  return 'Upper, Lower'
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

export interface WorkoutContextStats {
  exerciseCount?: number
  totalSetCount?: number
  workingSetCount?: number
  durationSeconds?: number | null
  volumeKg?: number | null
  completedAt?: string | null
}

export interface WorkoutContextPr {
  exerciseName: string
  kind: 'heaviest-weight' | 'best-1rm' | 'best-set-volume'
  label: string
  value: number
  previousValue?: number
  weight: number
  currentReps: number
  isCurrent: boolean
}

export interface WorkoutContext {
  sessionId?: string
  mode?: 'planning' | 'analysis'
  title: string
  notes?: string
  exercises: WorkoutContextExercise[]
  stats?: WorkoutContextStats
  prs?: WorkoutContextPr[]
}

// Custom suggestions config
export interface SuggestionsConfig {
  main: { id: string; text: string; icon: string }[]
  tell_me_about?: SuggestionPromptOption[]
  how_to?: SuggestionPromptOption[]
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

function buildDefaultSuggestions(input: {
  primaryGoalLabel: string
  hasWorkout: boolean
  currentWorkoutExercises: string[]
}): SuggestionsConfig {
  const { primaryGoalLabel, hasWorkout, currentWorkoutExercises } = input
  const currentWorkoutLabel =
    hasWorkout && currentWorkoutExercises.length > 0
      ? currentWorkoutExercises.slice(0, 3).join(', ')
      : null

  return {
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
        id: 'view_stats',
        text: 'Get Stats',
        icon: 'stats-chart-outline',
      },
      {
        id: 'tell_me_about',
        text: 'My Progress',
        icon: 'trending-up-outline',
      },
      {
        id: 'how_to',
        text: 'My Training',
        icon: 'barbell-outline',
      },
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
      {
        text: 'What to fix?',
        prompt: 'What should I improve most right now based on my real data?',
      },
      {
        text: 'Am I on track?',
        prompt: `Am I on track for ${primaryGoalLabel}?`,
      },
      {
        text: 'Next level-up?',
        prompt: 'Which lift is closest to leveling up next?',
      },
      {
        text: 'Best vs weak',
        prompt: 'Where am I strongest and weakest right now?',
      },
      {
        text: 'What is holding me back?',
        prompt: 'What is holding back my progress the most?',
      },
    ],
    how_to: [
      {
        text: 'Train better',
        prompt: currentWorkoutLabel
          ? `How can I improve the way I'm training right now, especially in workouts like ${currentWorkoutLabel}?`
          : `How can I train better right now for ${primaryGoalLabel}?`,
      },
      {
        text: 'Too much volume?',
        prompt:
          'Am I doing too much volume anywhere, like too many chest exercises or sets?',
      },
      {
        text: 'Rep ranges okay?',
        prompt: 'Are my rep ranges right for my goal, or should I change them?',
      },
      {
        text: 'Program okay?',
        prompt: 'Does my recent program structure look balanced and effective?',
      },
      {
        text: 'Biggest change?',
        prompt: 'What is the biggest training change I should make this week?',
      },
    ],
  }
}

const MAX_IMAGES = 10

const JSON_BLOCK_REGEX = /(?:```(?:json)?\s*)?(\[\s*\{[\s\S]*?\}\s*\])(?:\s*```)?/
const FOOD_LOG_BLOCK_REGEX = /<food_log>([\s\S]*?)<\/food_log>/i
const STATS_REPORT_BLOCK_REGEX = /<stats_report>([\s\S]*?)<\/stats_report>/i

const getStatsSnapshotPrompt = (weightUnit: 'kg' | 'lb'): string =>
  `
Generate a training stats snapshot for the last 30 days using only my real app data and tool outputs.
Do not guess. If a metric is unavailable, omit it. Use period_label "Last 30 days".
Use ${weightUnit === 'lb' ? 'lb' : 'kg'} for weight-based stats.
Use the stats tools as needed (especially strength progress, strength score, and muscle balance) before finalizing values.

Respond in two parts:
1) A short coach summary (2-4 lines max, plain language).
2) Append exactly one machine-readable block at the very end:
<stats_report>{
  "version": 1,
  "title": "Stats Snapshot",
  "period_label": "Last 30 days",
  "summary": "One sentence trend summary.",
  "highlights": [
    { "id": "strength_score", "label": "Strength Score", "value": "742", "delta": "+28", "trend": "up" },
    { "id": "workouts", "label": "Workouts", "value": "14", "delta": "+2", "trend": "flat" },
    { "id": "duration", "label": "Time Trained", "value": "18h 30m", "delta": "+2h", "trend": "up" },
    { "id": "volume", "label": "Volume", "value": "92,400 lb", "delta": "+12%", "trend": "up" }
  ],
  "top_lifts": [
    { "exercise": "Bench Press", "value": "225 lb", "delta": "+5 lb", "trend": "up" }
  ],
  "muscle_balance": [
    { "muscle_group": "Chest", "percentage": 24 },
    { "muscle_group": "Back", "percentage": 22 },
    { "muscle_group": "Shoulders", "percentage": 14 }
  ],
  "focus_areas": ["Hamstrings", "Rear Delts"]
}</stats_report>

Required core stats to include when available (Heavy-style):
- Strength score trend
- Workout consistency (workouts count) and total training duration
- Total training volume trend
- Top 3 lifts by 1RM (value as plain number + unit only, e.g. "225 lb" or "102 kg")
- Muscle balance split with percentages
- Focus areas (lagging muscles based on balance data, e.g., "Back (18% below target) — Add 2-3 extra sets/week")

Deltas: change only (e.g. "+5 lb", "+12%", "+28"); no timeline suffix like "vs 30d" or "vs prior" - period_label defines the timeframe for all stats.
`.trim()

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
  const name = userName && userName !== 'Guest' ? ` ${userName}` : ''

  switch (coachId) {
    case 'kino':
      return `Hey${name}. Let's plan your first workout together. Tell me what you want to train, what equipment you have, or how much time you've got, and I'll build the session with you. Tap ⚡ Generate Workout below or just type your goal.`
    case 'maya':
      return `Hey${name}! ✨ Let's plan your first workout together. Tell me what you want to focus on, how long you want to train, or what equipment you have, and I'll map it out with you. Hit ⚡ Generate Workout below or send me a quick goal to get started.`
    case 'ross':
    default:
      return `Hey${name}. Let's plan your first workout together. Tell me what you're training today, how much time you have, or what equipment you're working with, and I'll build the session with you. Use ⚡ Generate Workout below or type your goal when you're ready.`
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

const stripStatsReportBlock = (content: string): string =>
  content
    .replace(/<stats_report>[\s\S]*?<\/stats_report>/gi, '')
    .replace(/<stats_report>[\s\S]*$/i, '')
    .trim()

const getVisibleAssistantMessageText = (content: string): string =>
  stripStatsReportBlock(stripFoodLogBlock(content))
    .replace(JSON_BLOCK_REGEX, '')
    .replace(/```(?:json|).*/gs, '')
    .replace(/\[\s*\{.*/gs, '')
    .replace(/\{\s*"exercises".*/gs, '')
    .replace(/\{\s*"title".*/gs, '')
    .trim()

const WORKOUT_ANALYSIS_LABELS = [
  'Workout Score',
  'Overview',
  'Top Win',
  'Main Fix',
  'Next Step',
  'Summary',
  'What Went Well',
  'Needs Work',
  'Exercise Notes',
  'Next Session Focus',
] as const

function formatWorkoutAnalysisForDisplay(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return trimmed

  const hasWorkoutAnalysisLabel = WORKOUT_ANALYSIS_LABELS.some((label) =>
    trimmed.includes(`${label}:`),
  )

  if (!hasWorkoutAnalysisLabel) return trimmed

  const lines = trimmed
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const formatted: string[] = []

  for (const line of lines) {
    const scoreMatch = line.match(/^Workout Score:\s*(.+)$/i)
    if (scoreMatch) {
      formatted.push(`## Workout Score\n\n**${scoreMatch[1].trim()}**`)
      continue
    }

    const overviewMatch = line.match(/^(Overview|Summary):\s*(.+)$/i)
    if (overviewMatch) {
      formatted.push(`### ${overviewMatch[1]}\n\n${overviewMatch[2].trim()}`)
      continue
    }

    const singleBulletSectionMatch = line.match(
      /^(Top Win|Main Fix|Next Step):\s*(.+)$/i,
    )
    if (singleBulletSectionMatch) {
      formatted.push(
        `### ${singleBulletSectionMatch[1]}\n\n- ${singleBulletSectionMatch[2].trim()}`,
      )
      continue
    }

    const sectionHeaderMatch = line.match(
      /^(What Went Well|Needs Work|Exercise Notes|Next Session Focus):$/i,
    )
    if (sectionHeaderMatch) {
      formatted.push(`### ${sectionHeaderMatch[1]}`)
      continue
    }

    if (/^[•·⋅]/.test(line)) {
      formatted.push(`- ${line.replace(/^[•·⋅]\s*/, '').trim()}`)
      continue
    }

    formatted.push(line)
  }

  return formatted.join('\n\n').replace(/\n{3,}/g, '\n\n').trim()
}

const formatAssistantMessageForDisplay = (content: string): string =>
  formatWorkoutAnalysisForDisplay(getVisibleAssistantMessageText(content))

function createCoachMarkdownStyle(
  colors: ReturnType<typeof useThemedColors>,
): any {
  return {
    body: {
      fontSize: 16,
      lineHeight: 23,
      color: colors.textPrimary,
      margin: 0,
    },
    paragraph: {
      marginTop: 0,
      marginBottom: 10,
    },
    heading1: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.textPrimary,
      marginTop: 18,
      marginBottom: 10,
    },
    heading2: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
      marginTop: 16,
      marginBottom: 8,
    },
    heading3: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.textPrimary,
      marginTop: 14,
      marginBottom: 8,
    },
    code_inline: {
      backgroundColor: colors.bg,
      paddingHorizontal: 4,
      paddingVertical: 2,
      borderRadius: 4,
      fontSize: 15,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      color: colors.textPrimary,
    },
    code_block: {
      backgroundColor: colors.bg,
      padding: 12,
      borderRadius: 12,
      fontSize: 15,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      color: colors.textPrimary,
      marginVertical: 8,
      overflow: 'hidden',
    },
    fence: {
      backgroundColor: colors.bg,
      padding: 12,
      borderRadius: 12,
      fontSize: 15,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      color: colors.textPrimary,
      marginVertical: 8,
    },
    strong: {
      fontWeight: '700',
      color: colors.textPrimary,
    },
    em: {
      fontStyle: 'italic',
    },
    bullet_list: {
      marginTop: 2,
      marginBottom: 14,
    },
    ordered_list: {
      marginTop: 2,
      marginBottom: 14,
    },
    list_item: {
      marginTop: 6,
      marginBottom: 6,
    },
    hr: {
      backgroundColor: colors.border,
      height: 1,
      marginVertical: 16,
    },
    blockquote: {
      borderLeftWidth: 3,
      borderLeftColor: colors.brandPrimary,
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
  }
}

const getFirstSentence = (text: string): string => {
  const trimmed = text.trim()
  if (!trimmed) return ''

  const sentenceMatch = trimmed.match(/^(.+?[.!?])(?:\s|$)/)
  return sentenceMatch?.[1]?.trim() || trimmed
}

const getStructuredPlanIntroText = ({
  content,
  parsedProgram,
  parsedWorkout,
}: {
  content: string
  parsedProgram: ParsedProgramDisplay | null
  parsedWorkout: ParsedWorkoutDisplay | null
}): string => {
  const visibleText = getVisibleAssistantMessageText(content)
  if (visibleText) return visibleText

  if (parsedProgram) {
    return (
      getFirstSentence(parsedProgram.description) ||
      `I put together a ${parsedProgram.title} for you.`
    )
  }

  if (parsedWorkout) {
    return (
      getFirstSentence(parsedWorkout.description) ||
      `I put together a ${parsedWorkout.title} for you.`
    )
  }

  return ''
}

const toNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const toStatsTrend = (value: unknown): StatsTrend | undefined => {
  if (value === 'up' || value === 'down' || value === 'flat') return value
  return undefined
}

const parseStatsReportPayload = (
  content: string,
): StatsReportPayload | null => {
  const match = content.match(STATS_REPORT_BLOCK_REGEX)
  if (!match?.[1]) return null

  try {
    const parsed = JSON.parse(match[1]) as Record<string, unknown>
    const highlights = Array.isArray(parsed.highlights)
      ? parsed.highlights.reduce<StatsReportMetric[]>((acc, item) => {
          if (!item || typeof item !== 'object') return acc
          const row = item as Record<string, unknown>
          const label = toNonEmptyString(row.label)
          const value = toNonEmptyString(row.value)
          if (!label || !value) return acc
          acc.push({
            id: toNonEmptyString(row.id) || label.toLowerCase(),
            label,
            value,
            delta: toNonEmptyString(row.delta) || undefined,
            trend: toStatsTrend(row.trend),
          })
          return acc
        }, [])
      : []

    const topLifts = Array.isArray(parsed.top_lifts)
      ? parsed.top_lifts.reduce<StatsReportLift[]>((acc, item) => {
          if (!item || typeof item !== 'object') return acc
          const row = item as Record<string, unknown>
          const exercise = toNonEmptyString(row.exercise)
          const value = toNonEmptyString(row.value)
          if (!exercise || !value) return acc
          acc.push({
            exercise,
            value,
            delta: toNonEmptyString(row.delta) || undefined,
            trend: toStatsTrend(row.trend),
          })
          return acc
        }, [])
      : []

    const muscleBalance = Array.isArray(parsed.muscle_balance)
      ? parsed.muscle_balance.reduce<StatsReportMuscle[]>((acc, item) => {
          if (!item || typeof item !== 'object') return acc
          const row = item as Record<string, unknown>
          const muscleGroup = toNonEmptyString(row.muscle_group)
          const percentageRaw = Number(row.percentage)
          if (!muscleGroup || !Number.isFinite(percentageRaw)) return acc
          acc.push({
            muscle_group: muscleGroup,
            percentage: Math.max(0, Math.min(100, Math.round(percentageRaw))),
          })
          return acc
        }, [])
      : []

    const focusAreas = Array.isArray(parsed.focus_areas)
      ? parsed.focus_areas
          .map((item) => toNonEmptyString(item))
          .filter((item): item is string => Boolean(item))
      : []

    if (
      highlights.length === 0 &&
      topLifts.length === 0 &&
      muscleBalance.length === 0
    ) {
      return null
    }

    return {
      version:
        typeof parsed.version === 'number' && Number.isFinite(parsed.version)
          ? parsed.version
          : 1,
      title: toNonEmptyString(parsed.title) || undefined,
      period_label: toNonEmptyString(parsed.period_label) || undefined,
      summary: toNonEmptyString(parsed.summary) || undefined,
      highlights: highlights.slice(0, 4),
      top_lifts: topLifts.slice(0, 3),
      muscle_balance: muscleBalance.slice(0, 6),
      focus_areas: focusAreas.slice(0, 4),
    }
  } catch {
    console.warn('[WorkoutChat] Failed to parse <stats_report> payload block')
    return null
  }
}

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

    return payload
  } catch {
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
  const suggestionsScrollRef = useRef<ScrollView>(null)
  const inputRef = useRef<TextInput>(null)
  const imageViewerListRef = useRef<FlatList<string>>(null)
  const autoSendMessageRef = useRef<(message: string) => void>(() => {})
  const launchCameraRef = useRef<() => Promise<void>>(async () => {})
  const launchLibraryRef = useRef<() => Promise<void>>(async () => {})
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [inputHeight, setInputHeight] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isSavingProgram, setIsSavingProgram] = useState(false)
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
  const [parsedProgram, setParsedProgram] = useState<ParsedProgramDisplay | null>(
    null,
  )
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
  const coach = getCoach(coachId)
  const [suggestionMode, setSuggestionMode] = useState<SuggestionMode>('main')
  const [hasChatStarted, setHasChatStarted] = useState(false)
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false)
  const [
    loadedDraftContext,
    setLoadedDraftContext,
  ] = useState<WorkoutContext | null>(null)
  const [
    handoffWorkoutContext,
    setHandoffWorkoutContext,
  ] = useState<WorkoutContext | null>(null)
  const [hasLoadedWelcome, setHasLoadedWelcome] = useState(false)
  const [isWelcomeTyping, setIsWelcomeTyping] = useState(false)
  const [isCoachSheetVisible, setIsCoachSheetVisible] = useState(false)
  const [pendingAutoSendMessage, setPendingAutoSendMessage] = useState<
    string | null
  >(null)

  const [isFoodScannerVisible, setIsFoodScannerVisible] = useState(false)
  const [
    manualFoodData,
    setManualFoodData,
  ] = useState<ManualFoodLogData | null>(null)
  const [navGlassKey, setNavGlassKey] = useState(0)
  const [composerGlassKey, setComposerGlassKey] = useState(0)
  const [equipmentPreference, setEquipmentPreference] =
    useState<ChatEquipmentPreference | null>(null)
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
  const coachMarkdownStyle = useMemo(
    () => createCoachMarkdownStyle(colors),
    [colors],
  )
  const { isDark } = useTheme()
  const { weightUnit } = useWeightUnits()
  const insets = useSafeAreaInsets()
  const { width: windowWidth, height: windowHeight } = useWindowDimensions()
  const tabBarVisibility = useTabBarVisibility()
  const isFocused = useIsFocused()

  const closeWizardAndRestoreTabBar = useCallback(() => {
    tabBarVisibility?.setHideForFullscreenOverlay(false)
    setPlanningState({
      isActive: false,
      step: 'none',
      data: {},
      commonMuscles: [],
    })
  }, [tabBarVisibility])

  const openWorkoutPlanningWizard = useCallback(async () => {
    let storedPlanningPrefs: Partial<WorkoutPlanningData> = {}
    let storedEquipmentPreference: string | null = null

    try {
      const [planningPrefsRaw, equipmentPrefRaw] = await Promise.all([
        AsyncStorage.getItem(WORKOUT_PLANNING_PREFS_KEY),
        AsyncStorage.getItem(EQUIPMENT_PREF_KEY),
      ])

      if (planningPrefsRaw) {
        storedPlanningPrefs = JSON.parse(
          planningPrefsRaw,
        ) as Partial<WorkoutPlanningData>
      }

      if (equipmentPrefRaw) {
        storedEquipmentPreference = JSON.parse(equipmentPrefRaw) as string
      }
    } catch (error) {
      console.warn(
        '[WorkoutChat] Failed to load workout planning defaults',
        error,
      )
    }

    const commitmentTarget = getWeeklyCommitmentTarget({
      commitment: profile?.commitment,
      commitment_frequency: profile?.commitment_frequency,
    })

    const profileDefaults: Partial<WorkoutPlanningData> = {
      goal: getDefaultWizardGoalFromProfileGoals(profile?.goals),
      muscles: getDefaultWizardMuscles(
        commitmentTarget,
        profile?.experience_level,
      ),
      duration: DEFAULT_WORKOUT_DURATION,
      equipment:
        normalizeWizardEquipment(storedEquipmentPreference) ?? 'full_gym',
      specifics: `Intensity: ${getDefaultWizardIntensity(
        profile?.experience_level,
      )}`,
    }

    const initialWizardData: Partial<WorkoutPlanningData> = {
      goal:
        normalizeWizardGoal(storedPlanningPrefs.goal) ?? profileDefaults.goal,
      muscles: storedPlanningPrefs.muscles || profileDefaults.muscles,
      duration: storedPlanningPrefs.duration || profileDefaults.duration,
      equipment:
        normalizeWizardEquipment(storedPlanningPrefs.equipment) ??
        profileDefaults.equipment,
      specifics: storedPlanningPrefs.specifics || profileDefaults.specifics,
    }

    setPlanningState((prev) => ({
      ...prev,
      isActive: true,
      step: 'wizard',
      data: initialWizardData,
    }))
  }, [
    profile?.commitment,
    profile?.commitment_frequency,
    profile?.experience_level,
    profile?.goals,
  ])

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

  const welcomeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Show welcome message for first-time users (fullscreen mode only)
  useEffect(() => {
    // Wait for profile to load before showing welcome message so we have the user's name
    if (
      mode !== 'fullscreen' ||
      !isFocused ||
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
          // Show typing indicator first (like create-post coach sheet)
          setIsWelcomeTyping(true)

          const welcomeContent = getWelcomeMessage(
            coachId,
            profile?.display_name?.split(' ')[0], // First name only
          )

          const welcomeMessage: Message = {
            id: 'welcome-message',
            role: 'assistant',
            content: welcomeContent,
          }

          // Delay ~1.2s before revealing message for a more realistic feel
          welcomeTimerRef.current = setTimeout(() => {
            welcomeTimerRef.current = null
            setIsWelcomeTyping(false)
            setMessages([welcomeMessage])
            setHasLoadedWelcome(true)
            AsyncStorage.setItem(storageKey, 'true')
          }, 1200)
        } else {
          setHasLoadedWelcome(true)
        }
      } catch (error) {
        console.error('[WorkoutChat] Error checking welcome message:', error)
        setIsWelcomeTyping(false)
        setHasLoadedWelcome(true)
      }
    }

    checkAndShowWelcome()

    return () => {
      if (welcomeTimerRef.current) {
        clearTimeout(welcomeTimerRef.current)
        welcomeTimerRef.current = null
      }
    }
  }, [
    mode,
    isFocused,
    hasLoadedWelcome,
    user?.id,
    coachId,
    profile?.display_name,
    isProfileLoading,
  ])

  // Update welcome message when the real display name arrives (fixes race with "Guest" default)
  useEffect(() => {
    const firstName = profile?.display_name?.split(' ')[0]
    if (!firstName || firstName === 'Guest' || !hasLoadedWelcome) return

    setMessages((prev) => {
      if (prev.length > 0 && prev[0].id === 'welcome-message') {
        const updatedContent = getWelcomeMessage(coachId, firstName)
        if (prev[0].content === updatedContent) return prev
        return [{ ...prev[0], content: updatedContent }, ...prev.slice(1)]
      }
      return prev
    })
  }, [profile?.display_name, coachId, hasLoadedWelcome])

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
      setDailyLogSummary(summary as DailyLogSummaryState)
      setLatestLoggedMealId(latestMeal?.id ?? null)
    } catch (error) {
      console.error('[WorkoutChat] Failed to load daily log summary:', error)
    }
  }, [user?.id])

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
          } else if (pending.action === 'photos_selected') {
            setSelectedImages((prev) => {
              const combined = [...prev, ...pending.uris]
              return combined.slice(0, MAX_IMAGES)
            })
          } else if (pending.action === 'scan_food') {
            setIsFoodScannerVisible(true)
          } else if (pending.action === 'generate_workout') {
            void openWorkoutPlanningWizard()
          } else if (pending.action === 'analyze_workout') {
            setHandoffWorkoutContext(pending.workoutContext)
            setPendingAutoSendMessage(pending.prompt)
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
    }, [openWorkoutPlanningWizard, refreshDailyLogSummary, selectedImages.length]),
  )

  // Combined context: prefer an explicitly provided workout, then handoff context,
  // then fall back to the current draft.
  const effectiveWorkoutContext =
    workoutContext || handoffWorkoutContext || loadedDraftContext || undefined

  // Combine initial context exercises with any proposed exercises for the "current workout" state
  const currentWorkoutExercises = useMemo(
    () => [
      ...(effectiveWorkoutContext?.exercises.map((e) => e.name) || []),
      ...proposedWorkout.map((e) => e.name),
    ],
    [effectiveWorkoutContext, proposedWorkout],
  )

  const hasWorkout = currentWorkoutExercises.length > 0

  const primaryGoalLabel = useMemo(() => {
    const primaryGoal = profile?.goals?.[0]
    if (!primaryGoal) return 'your goal'
    return GOAL_PROMPT_LABELS[primaryGoal] || primaryGoal.replace(/_/g, ' ')
  }, [profile?.goals])

  const suggestions: SuggestionsConfig = useMemo(
    () =>
      customSuggestions ||
      buildDefaultSuggestions({
        primaryGoalLabel,
        hasWorkout,
        currentWorkoutExercises,
      }),
    [customSuggestions, currentWorkoutExercises, hasWorkout, primaryGoalLabel],
  )

  // Update suggestions based on state
  const activeSuggestions = useMemo(
    () => ({
      ...suggestions,
      main: (hasWorkout
        ? [
            {
              id: 'adjust_workout',
              text: 'Adjust Workout',
              icon: 'options-outline',
            },
            ...suggestions.main.filter((s) => s.id !== 'plan_workout'),
          ]
        : suggestions.main
      ).filter((s) => (s as { id?: string }).id !== 'view_stats'),
    }),
    [suggestions, hasWorkout],
  )

  useEffect(() => {
    if (
      generatedPlanContent ||
      planningState.isActive ||
      isLoading ||
      hasChatStarted ||
      messages.some((m) => m.role === 'user') ||
      input.trim()
    ) {
      return
    }

    requestAnimationFrame(() => {
      suggestionsScrollRef.current?.scrollTo({ x: 0, animated: false })
    })
  }, [
    activeSuggestions,
    generatedPlanContent,
    hasChatStarted,
    input,
    isLoading,
    messages,
    planningState.isActive,
    suggestionMode,
  ])

  useEffect(() => {
    let isMounted = true

    const loadEquipmentPreference = async () => {
      try {
        const stored = await AsyncStorage.getItem(EQUIPMENT_PREF_KEY)
        if (!stored || !isMounted) return

        const parsed = JSON.parse(stored) as unknown
        if (
          parsed === 'full_gym' ||
          parsed === 'home_minimal' ||
          parsed === 'dumbbells_only' ||
          parsed === 'bodyweight' ||
          parsed === 'barbell_only'
        ) {
          setEquipmentPreference(parsed)
        }
      } catch (error) {
        console.warn('[WorkoutChat] Failed to load equipment preference', error)
      }
    }

    void loadEquipmentPreference()

    return () => {
      isMounted = false
    }
  }, [])

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
  ): Promise<StreamingResponseResult> => {
    const decoder = new TextDecoder()
    let buffer = ''
    let acc = ''
    let ndjsonMode: boolean | null = null
    let hasDisabledLoading = false

    try {
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
            acc.includes(': {') ||
            acc.includes('<food_log>') ||
            acc.includes('<stats_report>')

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
            acc.includes(': {') ||
            acc.includes('<food_log>') ||
            acc.includes('<stats_report>')

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
            acc.includes('\n[') ||
            acc.includes('<food_log>') ||
            acc.includes('<stats_report>')
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
    } catch (error) {
      console.error('Chat stream error:', error)

      if (!options?.silent && assistantMessageId) {
        if (!hasDisabledLoading) {
          setIsLoading(false)
        }

        const interruptionMessage = acc.trim()
          ? `${acc}\n\nThe response was interrupted. You can resend your message.`
          : 'The response was interrupted. Please resend your message.'

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId
              ? { ...m, content: interruptionMessage }
              : m,
          ),
        )
      }

      return {
        content: acc,
        interrupted: true,
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

    const parsedWorkoutPlan = parseWorkoutForDisplay(acc)
    const parsedProgramPlan = parsedWorkoutPlan
      ? null
      : parseProgramForDisplay(acc)

    if (parsedWorkoutPlan) {
      setGeneratedPlanContent(acc)
      setParsedWorkout(parsedWorkoutPlan)
      setParsedProgram(null)

      // Complete tutorial step for all users, but only consume trial for non-Pro
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

    if (parsedProgramPlan) {
      setGeneratedPlanContent(acc)
      setParsedWorkout(null)
      setParsedProgram(parsedProgramPlan)

      if (!isProMember) {
        consumeTrial('ai_workout')
      }
    }

    // Auto-update proposed workout if it's a direct instruction?
    // No, the requirement says "Clicking '+' adds to proposedWorkout state".

    return {
      content: acc,
      interrupted: false,
    }
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

  useEffect(() => {
    if (
      viewerImageIndex === null ||
      viewerImages.length === 0 ||
      !imageViewerListRef.current
    ) {
      return
    }

    requestAnimationFrame(() => {
      imageViewerListRef.current?.scrollToIndex({
        index: viewerImageIndex,
        animated: false,
      })
    })
  }, [viewerImageIndex, viewerImages, windowWidth])

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

    try {
      const today = getLocalDateString()
      let mealImagePath: string | null = null
      const assistantMessageIndex = messages.findIndex(
        (message) => message.id === messageId,
      )

      if (assistantMessageIndex >= 0) {
        const assistantMessage = messages[assistantMessageIndex]
        const linkedUserImages = assistantMessage.linkedUserMessageId
          ? messages.find(
              (message) => message.id === assistantMessage.linkedUserMessageId,
            )?.images
          : undefined

        let sourceImageUri = linkedUserImages?.[0] ?? null

        if (!sourceImageUri) {
          for (
            let index = assistantMessageIndex - 1;
            index >= 0 && assistantMessageIndex - index <= 8;
            index -= 1
          ) {
            const candidate = messages[index]
            if (candidate.role !== 'user' || !candidate.images?.length) {
              continue
            }

            sourceImageUri = candidate.images[0] ?? null
            if (sourceImageUri) break
          }
        }

        if (sourceImageUri) {
          try {
            mealImagePath = await uploadMealImage(sourceImageUri, user.id)
          } catch (error) {
            console.error(
              '[FoodLog] Failed to persist source image for meal:',
              error,
            )
          }
        }
      }

      const mealMetadata = withDailyLogMealImagePath(
        { from: 'chat_food_log' },
        mealImagePath,
      )

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
        metadata: mealMetadata,
        logDate: today,
      }

      let savedMealId: string
      if (payload.action === 'update_last') {
        const mealIdToUpdate =
          loggedMealIdByMessage[messageId] || latestLoggedMealId
        if (mealIdToUpdate) {
          const updated = await database.dailyLog.updateMeal(
            user.id,
            mealIdToUpdate,
            mealPayload,
          )
          savedMealId = updated.id
        } else {
          const inserted = await database.dailyLog.logMeal(user.id, mealPayload)
          savedMealId = inserted.id
        }
      } else {
        const inserted = await database.dailyLog.logMeal(user.id, mealPayload)
        savedMealId = inserted.id
      }

      setLoggedMealIdByMessage((prev) => ({
        ...prev,
        [messageId]: savedMealId,
      }))
      setLatestLoggedMealId(savedMealId)
      await refreshDailyLogSummary()
      setFoodActionState((prev) => ({ ...prev, [messageId]: 'saved' }))
      trackEvent(AnalyticsEvents.FOOD_LOGGED, {
        source: payload.action === 'update_last' ? 'chat_correction' : 'chat',
        action: payload.action,
        calories: payload.calories,
        has_macros: Boolean(
          payload.protein_g || payload.carbs_g || payload.fat_g,
        ),
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

    setHasChatStarted(true)

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

      const trimmedRequestMessages = trimChatMessagesForRequest(
        requestMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      )

      const formattedMessages = [systemMessage, ...trimmedRequestMessages].map(
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
          lastMsg.content += parsedProgram
            ? buildProgramModificationSuffix()
            : buildWorkoutModificationSuffix()
        }
      }

      // Prepare request body with images as separate field
      type ChatRequestBody = {
        messages: { role: string; content: string }[]
        userId: string | undefined
        weightUnit: string
        coachSystemPrompt?: string
        equipmentPreference?: ChatEquipmentPreference
        workoutContext?: {
          sessionId?: string
          mode?: 'planning' | 'analysis'
          title?: string
          notes?: string
          exercises?: unknown
          stats?: {
            exerciseCount?: number
            totalSetCount?: number
            workingSetCount?: number
            durationSeconds?: number | null
            volumeKg?: number | null
            completedAt?: string | null
          }
          prs?: {
            exerciseName?: string
            kind?: 'heaviest-weight' | 'best-1rm' | 'best-set-volume'
            label?: string
            value?: number
            previousValue?: number
            weight?: number
            currentReps?: number
            isCurrent?: boolean
          }[]
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
        equipmentPreference: equipmentPreference ?? undefined,
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
              sessionId: effectiveWorkoutContext.sessionId,
              mode: effectiveWorkoutContext.mode,
              title: effectiveWorkoutContext.title,
              notes: effectiveWorkoutContext.notes,
              exercises: effectiveWorkoutContext.exercises,
              stats: effectiveWorkoutContext.stats,
              prs: effectiveWorkoutContext.prs,
            }
          : undefined,
        ...(options?.scanMode ? { scanMode: options.scanMode } : {}),
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

      const response = await callChatFunction(requestBody, {
        accessToken: session?.access_token,
        retryCount: 1,
      })

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
        {
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          linkedUserMessageId: hiddenPrompt ? undefined : userMessageId,
        },
      ])

      const responseMode = response.headers.get('x-chat-response-mode')
      const reader =
        responseMode === 'text' ? null : response.body?.getReader() ?? null
      if (!reader) {
        // Boring and reliable path: plain text, non-streaming response.
        const assistantContent = await response.text()
        const messageParsedWorkout = parseWorkoutForDisplay(assistantContent)
        const messageParsedProgram = messageParsedWorkout
          ? null
          : parseProgramForDisplay(assistantContent)

        if (messageParsedWorkout || messageParsedProgram) {
          setGeneratedPlanContent(assistantContent)
          setParsedWorkout(messageParsedWorkout)
          setParsedProgram(messageParsedProgram)
        }

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
        const streamResult = await processStreamingResponse(
          reader,
          assistantMessageId,
        )
        if (!streamResult.interrupted && !streamResult.content.trim()) {
          throw new Error('Chat response stream completed without any text')
        }
        if (streamResult.interrupted && !streamResult.content.trim()) {
          if (!hiddenPrompt) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === userMessage.id ? { ...m, status: 'failed' } : m,
              ),
            )
          }
          return
        }
      }
    } catch (error) {
      console.error('Chat error:', error)
      const errorMessage = mapChatApiErrorToMessage(error)
      setMessages((prev) => {
        const withUserStatus: Message[] = hiddenPrompt
          ? prev
          : prev.map((m) =>
              m.id === userMessage.id ? { ...m, status: 'failed' } : m,
            )

        const lastMsg = withUserStatus[withUserStatus.length - 1]
        if (lastMsg?.role === 'assistant' && lastMsg.content === '') {
          return withUserStatus.map((message, index) =>
            index === withUserStatus.length - 1
              ? { ...message, content: errorMessage }
              : message,
          )
        }

        return [
          ...withUserStatus,
          {
            id: Date.now().toString(),
            role: 'assistant',
            content: errorMessage,
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

  autoSendMessageRef.current = (message: string) => {
    void handleSendMessage(message)
  }

  useEffect(() => {
    if (!pendingAutoSendMessage || !effectiveWorkoutContext || isLoading) return

    setPendingAutoSendMessage(null)
    autoSendMessageRef.current(pendingAutoSendMessage)
  }, [effectiveWorkoutContext, isLoading, pendingAutoSendMessage])

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
    setHasChatStarted(false)
    setInput('')
    setInputHeight(0)
    setSelectedImages([])
    setFoodActionState({})
    setLoggedMealIdByMessage({})
    setGeneratedPlanContent(null)
    setParsedWorkout(null)
    setParsedProgram(null)
    setHandoffWorkoutContext(null)
    setPendingAutoSendMessage(null)
    setSuggestionMode('main')
    inputRef.current?.clear()
    Keyboard.dismiss()
  }

  const handleSuggestionPress = (
    item:
      | string
      | SuggestionPromptOption
      | { id: string; text: string; icon: string },
  ) => {
    // 1. Handle object-based menu items (Main, Adjust Workout)
    if (typeof item === 'object') {
      if ('prompt' in item) {
        handleSendMessage(item.prompt)
        setSuggestionMode('main')
        return
      }

      if (item.id === 'plan_workout') {
        haptic('light')
        void openWorkoutPlanningWizard()
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

      if (item.id === 'view_stats') {
        haptic('light')
        handleSendMessage(getStatsSnapshotPrompt(weightUnit))
        setSuggestionMode('main')
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

    try {
      await Promise.all([
        AsyncStorage.setItem(WORKOUT_PLANNING_PREFS_KEY, JSON.stringify(data)),
        AsyncStorage.setItem(EQUIPMENT_PREF_KEY, JSON.stringify(data.equipment)),
      ])
    } catch (error) {
      console.warn(
        '[WorkoutChat] Failed to persist workout planning defaults',
        error,
      )
    }

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
      const systemMessage = {
        role: 'system',
        content: getCoach(coachId).systemPrompt,
      }

      const trimmedRequestMessages = trimChatMessagesForRequest([
        ...messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
        { role: 'user' as const, content: finalPrompt },
      ])

      const formattedMessages = [systemMessage, ...trimmedRequestMessages]

      const requestBody = {
        messages: formattedMessages,
        userId: user?.id,
        weightUnit,
        coachSystemPrompt: getCoach(coachId).systemPrompt,
      }

      const response = await callChatFunction(requestBody, {
        accessToken: session?.access_token,
        retryCount: 1,
      })

      const assistantMessageId = (Date.now() + 1).toString()

      const responseMode = response.headers.get('x-chat-response-mode')
      const reader =
        responseMode === 'text' ? null : response.body?.getReader() ?? null
      if (!reader) {
        const assistantContent = await response.text()

        // Use timeout to step out of current stack for state updates
        setTimeout(() => {
          setGeneratedPlanContent(assistantContent)

          // Parse workout for structured display
          const parsed = parseWorkoutForDisplay(assistantContent)
          setParsedWorkout(parsed)
          setParsedProgram(null)

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
            if (!isProMember) {
              consumeTrial('ai_workout')
            }
          }
        }, 0)
      } else {
        // Stream silently - no placeholder message initially
        const streamResult = await processStreamingResponse(
          reader,
          null, // No ID, so it won't update messages during stream
          { silent: true },
        )

        if (streamResult.interrupted || !streamResult.content.trim()) {
          throw new Error('Workout generation stream was interrupted')
        }

        // Once complete, add the message
        setMessages((prev) => [
          ...prev,
          {
            id: assistantMessageId,
            role: 'assistant',
            content: streamResult.content,
          },
        ])
      }
    } catch (error) {
      console.error('Chat error:', error)
      const errorMessage = mapChatApiErrorToMessage(error)
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
                  content: errorMessage,
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
            content: errorMessage,
          },
        ]
      })
    } finally {
      setIsLoading(false)
    }
  }

  type RoutineTemplateInput = {
    title: string
    description?: string
    exercises: {
      name: string
      sets: {
        reps?: string
        repsMin?: number | null
        repsMax?: number | null
        restSeconds?: number | null
      }[]
    }[]
  }

  type SavedRoutineTemplate = {
    id: string
    name: string
    exercises: {
      id: string
      name: string
      orderIndex: number
      sets: {
        setNumber: number
        repsMin: number | null
        repsMax: number | null
        restSeconds: number | null
      }[]
    }[]
  }

  const createRoutineFromTemplate = async (
    userId: string,
    routineData: RoutineTemplateInput,
    options?: {
      programId?: string
      notes?: string
    },
  ): Promise<SavedRoutineTemplate> => {
    let createdRoutineId: string | null = null

    try {
      const routine = await database.workoutRoutines.create(
        userId,
        routineData.title || 'AI Generated Routine',
        {
          notes:
            options?.notes ??
            routineData.description ??
            'Generated from AI Chat',
          programId: options?.programId ?? undefined,
        },
      )
      createdRoutineId = routine.id

      const exerciseNames = routineData.exercises.map((exercise) => exercise.name)
      const { data: dbExercises, error: resolveError } = await supabase
        .from('exercises')
        .select('id, name')
        .in('name', exerciseNames)
        .is('created_by', null)

      if (resolveError) {
        throw new Error(`Failed to resolve exercises: ${resolveError.message}`)
      }

      const exerciseIdMap = new Map<string, string>()
      dbExercises?.forEach((exercise) => {
        if (exercise.name) {
          exerciseIdMap.set(exercise.name.toLowerCase(), exercise.id)
        }
      })

      const routineExercisesToInsert = routineData.exercises.reduce<
        {
          routine_id: string
          exercise_id: string
          order_index: number
          notes: null
        }[]
      >((acc, exercise, index) => {
        const dbId = exerciseIdMap.get(exercise.name.toLowerCase())
        if (!dbId) {
          console.warn(`Could not find DB exercise for: ${exercise.name}`)
          return acc
        }

        acc.push({
          routine_id: routine.id,
          exercise_id: dbId,
          order_index: index,
          notes: null,
        })
        return acc
      }, [])

      if (routineExercisesToInsert.length === 0) {
        throw new Error('No valid exercises found in the database.')
      }

      const { data: insertedExercises, error: insertedExercisesError } =
        await supabase
          .from('workout_routine_exercises')
          .insert(routineExercisesToInsert)
          .select('id, order_index, exercise:exercises(name)')

      if (insertedExercisesError || !insertedExercises) {
        throw new Error(
          `Failed to create routine exercises: ${
            insertedExercisesError?.message || 'Unknown error'
          }`,
        )
      }

      const insertedExerciseIdByOrderIndex = new Map<number, string>()
      insertedExercises.forEach((exercise) => {
        insertedExerciseIdByOrderIndex.set(exercise.order_index, exercise.id)
      })

      const routineSets = routineData.exercises.reduce<
        {
          routine_exercise_id: string
          set_number: number
          reps_min: number | null
          reps_max: number | null
          rest_seconds: number | null
        }[]
      >((acc, exercise, exerciseIndex) => {
        const routineExerciseId = insertedExerciseIdByOrderIndex.get(
          exerciseIndex,
        )
        if (!routineExerciseId) {
          return acc
        }

        exercise.sets.forEach((set, setIndex) => {
          let repsMin =
            set.repsMin !== undefined && set.repsMin !== null
              ? set.repsMin
              : null
          let repsMax =
            set.repsMax !== undefined && set.repsMax !== null
              ? set.repsMax
              : null

          if (repsMin === null && repsMax === null && set.reps) {
            const parsedTargets = parseRepTargets(set.reps)
            repsMin = parsedTargets.repsMin
            repsMax = parsedTargets.repsMax
          }

          acc.push({
            routine_exercise_id: routineExerciseId,
            set_number: setIndex + 1,
            reps_min: repsMin,
            reps_max: repsMax,
            rest_seconds: set.restSeconds ?? null,
          })
        })

        return acc
      }, [])

      if (routineSets.length > 0) {
        const { error: setsError } = await supabase
          .from('workout_routine_sets')
          .insert(routineSets)

        if (setsError) {
          throw setsError
        }
      }

      return {
        id: routine.id,
        name: routine.name,
        exercises: routineData.exercises
          .map((exercise, index) => {
            const routineExerciseId = insertedExerciseIdByOrderIndex.get(index)
            if (!routineExerciseId) {
              return null
            }

            return {
              id: routineExerciseId,
              name: exercise.name,
              orderIndex: index,
              sets: exercise.sets.map((set, setIndex) => {
                const parsedTargets =
                  set.repsMin !== undefined || set.repsMax !== undefined
                    ? {
                        repsMin: set.repsMin ?? null,
                        repsMax: set.repsMax ?? null,
                      }
                    : parseRepTargets(set.reps || '')

                return {
                  setNumber: setIndex + 1,
                  repsMin: parsedTargets.repsMin,
                  repsMax: parsedTargets.repsMax,
                  restSeconds: set.restSeconds ?? null,
                }
              }),
            }
          })
          .filter(
            (
              exercise,
            ): exercise is SavedRoutineTemplate['exercises'][number] =>
              Boolean(exercise),
          ),
      }
    } catch (error) {
      if (createdRoutineId) {
        try {
          await database.workoutRoutines.delete(createdRoutineId)
        } catch (cleanupError) {
          console.error('Failed to cleanup orphaned routine:', cleanupError)
        }
      }
      throw error
    }
  }

  const buildRoutineTemplateFromProgramRoutine = (
    routine: ParsedProgramDisplay['routines'][number],
  ): RoutineTemplateInput => ({
    title: routine.title,
    description: routine.duration
      ? `${routine.title} · ${routine.duration}`
      : routine.description || routine.title,
    exercises: routine.exercises.map((exercise) => ({
      name: exercise.name,
      sets: exercise.sets.map((set) => {
        const parsedTargets = parseRepTargets(set.reps)
        return {
          reps: set.reps,
          repsMin: parsedTargets.repsMin,
          repsMax: parsedTargets.repsMax,
          restSeconds: set.rest > 0 ? set.rest : null,
        }
      }),
    })),
  })

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

    try {
      if (!user?.id) throw new Error('User not found')

      let routineData: RoutineTemplateInput

      if (parsedWorkout) {
        routineData = {
          title: parsedWorkout.title,
          description: parsedWorkout.description,
          exercises: parsedWorkout.exercises.map((ex) => ({
            name: ex.name,
            sets: ex.sets.map((s) => {
              const parsedTargets = parseRepTargets(s.reps)

              return {
                reps: s.reps,
                repsMin: parsedTargets.repsMin,
                repsMax: parsedTargets.repsMax,
                restSeconds: s.rest,
              }
            }),
          })),
        }
      } else {
        const converted = await convertAiPlanToRoutine({
          text: generatedPlanContent,
          userId: user.id,
          weightUnit,
          token: session?.access_token,
        })
        routineData = converted
      }

      const routine = await createRoutineFromTemplate(user.id, routineData)

      // Consume trial or complete tutorial step
      if (!isProMember) {
        console.log(
          '[WorkoutChat] Saving AI routine. Consuming create_routine trial.',
        )
        consumeTrial('create_routine')
      } else {
        console.log(
          '[WorkoutChat] Saving AI routine. Completing save_routine tutorial step.',
        )
        completeStep('save_routine')
      }

      // Navigate directly to the routine detail page
      router.push({
        pathname: '/routine/[routineId]',
        params: { routineId: routine.id },
      })
    } catch (error) {
      console.error('Error creating routine:', error)

      const errorMessage =
        error instanceof Error ? error.message : 'Failed to create routine'
      Alert.alert('Error', `${errorMessage}. Please try again.`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveProgram = async (
    programOverride?: ParsedProgramDisplay | null,
  ) => {
    const programToSave = programOverride ?? parsedProgram
    if (isSavingProgram || !programToSave) return

    const canAccessCreateRoutine = isProMember || canUseTrial('create_routine')
    if (!canAccessCreateRoutine) {
      setShowPaywall(true)
      trackEvent(AnalyticsEvents.PAYWALL_SHOWN, {
        feature: 'create_routine_from_chat',
      })
      return
    }

    setIsSavingProgram(true)
    haptic('medium')

    let createdProgramId: string | null = null
    const createdRoutineIds: string[] = []

    try {
      if (!user?.id) {
        throw new Error('User not found')
      }

      const savedProgram = await database.userPrograms.create(
        user.id,
        programToSave.title,
        {
          description: programToSave.description || undefined,
        },
      )
      createdProgramId = savedProgram.id

      for (const routine of programToSave.routines) {
        const savedRoutine = await createRoutineFromTemplate(
          user.id,
          buildRoutineTemplateFromProgramRoutine(routine),
          {
            programId: savedProgram.id,
            notes: programToSave.description || routine.title,
          },
        )
        createdRoutineIds.push(savedRoutine.id)
      }

      if (!isProMember) {
        consumeTrial('create_routine')
      } else {
        completeStep('save_routine')
      }

      hapticSuccess()
      await new Promise((resolve) => setTimeout(resolve, 450))
      router.push('/routines')
    } catch (error) {
      console.error('Error saving program:', error)

      for (const routineId of createdRoutineIds) {
        try {
          await database.workoutRoutines.delete(routineId)
        } catch (cleanupError) {
          console.error('Failed to cleanup saved program routine:', cleanupError)
        }
      }

      if (createdProgramId) {
        try {
          await database.userPrograms.delete(createdProgramId)
        } catch (cleanupError) {
          console.error('Failed to cleanup saved program:', cleanupError)
        }
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Failed to save program'
      Alert.alert('Error', `${errorMessage}. Please try again.`)
    } finally {
      setIsSavingProgram(false)
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
                      style={styles.newChatButton}
                      onPress={
                        messages.length > 0
                          ? handleNewChat
                          : () => {
                              haptic('light')
                              Keyboard.dismiss()
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
              extraData={{
                isLoading,
                isWelcomeTyping,
                input: input.trim(),
                mode,
                coachId,
                coachName: profile?.display_name ?? '',
              }}
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
                      {/* Check if this message contains a parsed workout/program plan */}
                      {(() => {
                        const messageParsedProgram = parseProgramForDisplay(
                          message.content,
                        )
                        const messageParsedWorkout = parseWorkoutForDisplay(
                          message.content,
                        )
                        const structuredPlanIntroText = getStructuredPlanIntroText(
                          {
                            content: message.content,
                            parsedProgram: messageParsedProgram,
                            parsedWorkout: messageParsedWorkout,
                          },
                        )

                        if (messageParsedProgram || messageParsedWorkout) {
                          return (
                            <View style={styles.assistantMessageContent}>
                              {structuredPlanIntroText ? (
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
                                        handleCopyMessage(structuredPlanIntroText)
                                      }
                                      delayLongPress={220}
                                    >
                                      <View
                                        style={styles.assistantMessageBubble}
                                      >
                                        <Markdown style={coachMarkdownStyle}>
                                          {structuredPlanIntroText}
                                        </Markdown>
                                      </View>
                                    </TouchableOpacity>
                                  </View>
                                </View>
                              ) : null}

                              <View
                                style={[
                                  styles.workoutCardContainer,
                                  structuredPlanIntroText &&
                                    styles.structuredCardWithIntro,
                                ]}
                              >
                                {messageParsedProgram ? (
                                  <ProgramCard
                                    program={messageParsedProgram}
                                    coachImage={coach.image}
                                    username={profile?.display_name}
                                    onSaveProgram={async () => {
                                      setParsedWorkout(null)
                                      setParsedProgram(messageParsedProgram)
                                      setGeneratedPlanContent(message.content)
                                      await handleSaveProgram(
                                        messageParsedProgram,
                                      )
                                    }}
                                  />
                                ) : messageParsedWorkout ? (
                                  <WorkoutCard
                                    workout={messageParsedWorkout}
                                    coachImage={coach.image}
                                    username={profile?.display_name}
                                    onStartWorkout={() => {
                                      setParsedProgram(null)
                                      setParsedWorkout(messageParsedWorkout)
                                      setGeneratedPlanContent(message.content)
                                      setTimeout(handleStartWorkout, 0)
                                    }}
                                    onSaveRoutine={() => {
                                      setParsedProgram(null)
                                      setParsedWorkout(messageParsedWorkout)
                                      setGeneratedPlanContent(message.content)
                                      setTimeout(handleSaveRoutine, 0)
                                    }}
                                  />
                                ) : null}
                              </View>
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
                        const displayContent = formatAssistantMessageForDisplay(
                          message.content,
                        )

                        const exerciseSuggestions = parseExerciseSuggestions(
                          message.content,
                        )
                        const statsReportPayload = parseStatsReportPayload(
                          message.content,
                        )

                        const coachText =
                          statsReportPayload && displayContent
                            ? displayContent
                                .match(/^[^.!?\n]+[.!?]?/)?.[0]
                                ?.trim() || displayContent.slice(0, 120).trim()
                            : displayContent

                        // Don't render empty bubbles (prevents glitch when streaming JSON)
                        if (
                          !displayContent &&
                          exerciseSuggestions.length === 0 &&
                          !foodLogPayload &&
                          !statsReportPayload
                        ) {
                          return null
                        }

                        return (
                          <>
                            <View style={styles.assistantMessageContent}>
                              {coachText && (
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
                                        handleCopyMessage(
                                          displayContent || coachText,
                                        )
                                      }
                                      delayLongPress={220}
                                    >
                                      <View
                                        style={styles.assistantMessageBubble}
                                      >
                                        <Markdown style={coachMarkdownStyle}>
                                          {coachText}
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
                                      <View style={styles.foodLogActionsRow}>
                                        <TouchableOpacity
                                          style={[
                                            styles.foodLogActionButton,
                                            { flex: 1 },
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
                                            <>
                                              <Ionicons
                                                name={
                                                  isSaved
                                                    ? 'checkmark-circle'
                                                    : 'add-circle'
                                                }
                                                size={20}
                                                color={colors.bg}
                                              />
                                              <Text
                                                style={
                                                  styles.foodLogActionButtonText
                                                }
                                              >
                                                {buttonLabel}
                                              </Text>
                                            </>
                                          )}
                                        </TouchableOpacity>

                                        {isSaved && (
                                          <TouchableOpacity
                                            style={
                                              styles.foodLogSecondaryButton
                                            }
                                            onPress={() =>
                                              router.push(
                                                '/body-log/daily-food-log',
                                              )
                                            }
                                            activeOpacity={0.85}
                                          >
                                            <Ionicons
                                              name="nutrition"
                                              size={20}
                                              color={colors.textPrimary}
                                            />
                                            <Text
                                              style={
                                                styles.foodLogSecondaryButtonText
                                              }
                                            >
                                              Open Food Log
                                            </Text>
                                          </TouchableOpacity>
                                        )}
                                      </View>
                                    )
                                  })()}
                                </TouchableOpacity>
                              )}

                              {statsReportPayload &&
                                (() => {
                                  const stripDelta = (s: string | undefined) =>
                                    (s || '')
                                      .replace(/\s+vs\s+[\w\s]+$/i, '')
                                      .trim()
                                  const trendColor = (t?: string) =>
                                    t === 'up'
                                      ? '#34C759'
                                      : t === 'down'
                                      ? '#FF3B30'
                                      : undefined
                                  return (
                                    <View style={styles.statsGrid}>
                                      {/* Header */}
                                      <View style={styles.statsGridHeader}>
                                        <Text style={styles.statsGridTitle}>
                                          {statsReportPayload.title ||
                                            'Stats Snapshot'}
                                        </Text>
                                        {statsReportPayload.period_label ? (
                                          <Text style={styles.statsGridPeriod}>
                                            {statsReportPayload.period_label}
                                          </Text>
                                        ) : null}
                                      </View>

                                      {/* Highlights */}
                                      {statsReportPayload.highlights.length >
                                      0 ? (
                                        <View style={styles.statsGridSection}>
                                          <Text
                                            style={styles.statsGridSectionLabel}
                                          >
                                            Highlights
                                          </Text>
                                          {statsReportPayload.highlights.map(
                                            (metric, idx) => (
                                              <View
                                                key={`${metric.id}-${idx}`}
                                                style={styles.statsGridRow}
                                              >
                                                <Text
                                                  style={
                                                    styles.statsGridRowLabel
                                                  }
                                                >
                                                  {metric.label}
                                                </Text>
                                                <Text
                                                  style={
                                                    styles.statsGridRowValue
                                                  }
                                                >
                                                  {metric.value}
                                                </Text>
                                                <Text
                                                  style={[
                                                    styles.statsGridRowDelta,
                                                    trendColor(metric.trend)
                                                      ? {
                                                          color: trendColor(
                                                            metric.trend,
                                                          ),
                                                        }
                                                      : null,
                                                  ]}
                                                >
                                                  {stripDelta(metric.delta) ||
                                                    ''}
                                                </Text>
                                              </View>
                                            ),
                                          )}
                                        </View>
                                      ) : null}

                                      {/* Top Lifts */}
                                      {statsReportPayload.top_lifts.length >
                                      0 ? (
                                        <View style={styles.statsGridSection}>
                                          <Text
                                            style={styles.statsGridSectionLabel}
                                          >
                                            Top Lifts
                                          </Text>
                                          {statsReportPayload.top_lifts.map(
                                            (lift, idx) => (
                                              <View
                                                key={`${lift.exercise}-${idx}`}
                                                style={styles.statsGridRow}
                                              >
                                                <Text
                                                  style={
                                                    styles.statsGridRowLabel
                                                  }
                                                  numberOfLines={1}
                                                >
                                                  {lift.exercise}
                                                </Text>
                                                <Text
                                                  style={
                                                    styles.statsGridRowValue
                                                  }
                                                >
                                                  {lift.value}
                                                </Text>
                                                <Text
                                                  style={[
                                                    styles.statsGridRowDelta,
                                                    trendColor(lift.trend)
                                                      ? {
                                                          color: trendColor(
                                                            lift.trend,
                                                          ),
                                                        }
                                                      : null,
                                                  ]}
                                                >
                                                  {stripDelta(lift.delta) || ''}
                                                </Text>
                                              </View>
                                            ),
                                          )}
                                        </View>
                                      ) : null}

                                      {/* Muscle Balance */}
                                      {statsReportPayload.muscle_balance
                                        .length > 0 ? (
                                        <View style={styles.statsGridSection}>
                                          <Text
                                            style={styles.statsGridSectionLabel}
                                          >
                                            Muscle Balance
                                          </Text>
                                          {statsReportPayload.muscle_balance.map(
                                            (muscle, idx) => (
                                              <View
                                                key={`${muscle.muscle_group}-${idx}`}
                                                style={
                                                  styles.statsGridMuscleRow
                                                }
                                              >
                                                <Text
                                                  style={
                                                    styles.statsGridMuscleLabel
                                                  }
                                                >
                                                  {muscle.muscle_group}
                                                </Text>
                                                <View
                                                  style={
                                                    styles.statsGridMuscleTrack
                                                  }
                                                >
                                                  <View
                                                    style={[
                                                      styles.statsGridMuscleFill,
                                                      {
                                                        width: `${Math.max(
                                                          muscle.percentage,
                                                          2,
                                                        )}%`,
                                                      },
                                                    ]}
                                                  />
                                                </View>
                                                <Text
                                                  style={
                                                    styles.statsGridMusclePct
                                                  }
                                                >
                                                  {muscle.percentage}%
                                                </Text>
                                              </View>
                                            ),
                                          )}
                                        </View>
                                      ) : null}

                                      {/* Focus Areas */}
                                      {statsReportPayload.focus_areas &&
                                      statsReportPayload.focus_areas.length >
                                        0 ? (
                                        <View style={styles.statsGridSection}>
                                          <Text
                                            style={styles.statsGridSectionLabel}
                                          >
                                            Focus Areas
                                          </Text>
                                          {statsReportPayload.focus_areas.map(
                                            (area, idx) => (
                                              <View
                                                key={idx}
                                                style={styles.statsGridFocusRow}
                                              >
                                                <Text
                                                  style={
                                                    styles.statsGridFocusDot
                                                  }
                                                >
                                                  ·
                                                </Text>
                                                <Text
                                                  style={
                                                    styles.statsGridFocusText
                                                  }
                                                >
                                                  {area}
                                                </Text>
                                              </View>
                                            ),
                                          )}
                                        </View>
                                      ) : null}
                                    </View>
                                  )
                                })()}

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
                ;(messages.length > 0 || isLoading || isWelcomeTyping) &&
                  scrollToBottom()
              }}
              ListEmptyComponent={
                messages.length === 0 &&
                !isLoading &&
                !isWelcomeTyping &&
                !input.trim() ? (
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
                          Plan your next workout, dive into your stats, or log a
                          meal — just ask.
                        </Text>
                      </View>
                    )}
                  </View>
                ) : null
              }
              ListFooterComponent={
                <>
                  {(isLoading || isWelcomeTyping) && (
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
              !isLoading &&
              !isWelcomeTyping &&
              !hasChatStarted &&
              !messages.some((m) => m.role === 'user') &&
              !input.trim() && (
                <View style={styles.suggestionsContainer}>
                  <ScrollView
                    ref={suggestionsScrollRef}
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
                                  style={{ marginRight: 8 }}
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
                                style={{ marginRight: 8 }}
                              />
                            }
                            onPress={() => handleSuggestionPress(item)}
                          />
                        ))
                      : (
                          activeSuggestions[suggestionMode] || []
                        ).map((item, index) => (
                          <AnimatedSuggestion
                            key={typeof item === 'string' ? item : item.text}
                            index={index + 1}
                            text={typeof item === 'string' ? item : item.text}
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
                  style={StyleSheet.absoluteFillObject}
                  activeOpacity={1}
                  onPress={closeImageViewer}
                />

                {viewerImages.length > 0 && viewerImageIndex !== null && (
                  <View style={styles.imageViewerContent}>
                    <FlatList
                      ref={imageViewerListRef}
                      data={viewerImages}
                      horizontal
                      pagingEnabled
                      showsHorizontalScrollIndicator={false}
                      initialScrollIndex={viewerImageIndex}
                      getItemLayout={(_, index) => ({
                        length: windowWidth,
                        offset: windowWidth * index,
                        index,
                      })}
                      onMomentumScrollEnd={(event) => {
                        const nextIndex = Math.round(
                          event.nativeEvent.contentOffset.x / windowWidth,
                        )
                        if (nextIndex !== viewerImageIndex) {
                          setViewerImageIndex(nextIndex)
                        }
                      }}
                      onScrollToIndexFailed={(info) => {
                        requestAnimationFrame(() => {
                          imageViewerListRef.current?.scrollToOffset({
                            offset: info.index * windowWidth,
                            animated: false,
                          })
                        })
                      }}
                      renderItem={({ item }) => (
                        <View
                          style={[
                            styles.imageViewerSlide,
                            {
                              width: windowWidth,
                              height: windowHeight,
                            },
                          ]}
                        >
                          <Image
                            source={{ uri: item }}
                            style={styles.imageViewerImage}
                            contentFit="contain"
                          />
                        </View>
                      )}
                      keyExtractor={(_, index) => index.toString()}
                    />

                    <TouchableOpacity
                      style={[
                        styles.imageViewerCloseButton,
                        { top: insets.top + 12 },
                      ]}
                      onPress={closeImageViewer}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name="close"
                        size={28}
                        color={colors.surface}
                      />
                    </TouchableOpacity>

                    {viewerImages.length > 1 && (
                      <View
                        style={[
                          styles.imageViewerCounter,
                          { bottom: insets.bottom + 24 },
                        ]}
                      >
                        <Text style={styles.imageViewerCounterText}>
                          {viewerImageIndex + 1} of {viewerImages.length}
                        </Text>
                      </View>
                    )}
                  </View>
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

          setManualFoodData({
            name: `${name}${brand}`,
            calories: cals,
            protein,
            carbs,
            fat,
            servingSize: serving,
          })
        }}
      />

      <ManualFoodLogSheet
        visible={!!manualFoodData}
        foodData={manualFoodData}
        onClose={() => setManualFoodData(null)}
        onLog={async (data, quantity) => {
          setManualFoodData(null)
          if (!user?.id) {
            Alert.alert('Sign In Required', 'Please sign in to save food logs.')
            return
          }

          const summary = `${quantity}x ${data.servingSize || 'serving'} of ${
            data.name
          }`
          const cals = Math.round(data.calories * quantity)
          const protein = Math.round(data.protein * quantity)
          const carbs = Math.round(data.carbs * quantity)
          const fat = Math.round(data.fat * quantity)

          try {
            const today = getLocalDateString()
            const mealPayload = {
              description: summary,
              calories: cals,
              protein_g: protein,
              carbs_g: carbs,
              fat_g: fat,
              source: 'manual' as const,
              confidence: 'high' as const,
              metadata: { from: 'manual_barcode_log' },
              logDate: today,
            }

            const inserted = await database.dailyLog.logMeal(
              user.id,
              mealPayload,
            )
            setLatestLoggedMealId(inserted.id)
            await refreshDailyLogSummary()
            trackEvent(AnalyticsEvents.FOOD_LOGGED, {
              source: 'manual_barcode',
              action: 'log',
              calories: cals,
              has_macros: true,
            })
            hapticSuccess()

            // Optionally add a system message to the chat so the user sees it logged
            const systemMessage: Message = {
              id: Date.now().toString(),
              role: 'assistant',
              content: `Logged **${summary}** manually.\n\n<food_log>{"action":"log","summary":"${summary}","calories":${cals},"protein_g":${protein},"carbs_g":${carbs},"fat_g":${fat},"source":"manual","confidence":"high"}</food_log>`,
              createdAt: new Date().toISOString(),
            }
            setMessages((prev) => [...prev, systemMessage])
            setLoggedMealIdByMessage((prev) => ({
              ...prev,
              [systemMessage.id]: inserted.id,
            }))
            setFoodActionState((prev) => ({
              ...prev,
              [systemMessage.id]: 'saved',
            }))
          } catch (error) {
            console.error('[WorkoutChat] Failed to manually log meal:', error)
            Alert.alert('Could not save meal', 'Please try again.')
          }
        }}
      />

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
      right: 16,
      width: 48,
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
      justifyContent: 'center',
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
    structuredCardWithIntro: {
      marginTop: 12,
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
    foodLogActionsRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 16,
      width: '100%',
    },
    foodLogActionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: 16,
      paddingVertical: 14,
      backgroundColor: colors.textPrimary, // Contrast button
      minHeight: 52,
    },
    foodLogActionButtonDone: {
      backgroundColor: colors.statusSuccess,
    },
    foodLogActionButtonText: {
      color: colors.bg,
      fontSize: 15,
      fontWeight: '700',
    },
    foodLogSecondaryButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: 16,
      paddingVertical: 14,
      backgroundColor: colors.surfaceSubtle,
      borderWidth: 1,
      borderColor: colors.border,
      minHeight: 52,
    },
    foodLogSecondaryButtonText: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: '700',
    },
    statsCard: { width: 0, height: 0 },
    statsCardStandalone: { width: 0, height: 0 },
    statsGrid: {
      marginTop: 18,
      width: '100%',
      gap: 0,
    },
    statsGridHeader: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 8,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
    },
    statsGridTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    statsGridPeriod: {
      fontSize: 12,
      fontWeight: '400',
      color: colors.textTertiary,
    },
    statsGridSection: {
      paddingTop: 8,
      paddingBottom: 4,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    },
    statsGridSectionLabel: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 4,
    },
    statsGridRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 5,
    },
    statsGridRowLabel: {
      flex: 1,
      fontSize: 13,
      fontWeight: '400',
      color: colors.textSecondary,
      minWidth: 0,
    },
    statsGridRowValue: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textPrimary,
      marginRight: 8,
      minWidth: 60,
      textAlign: 'right',
    },
    statsGridRowDelta: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.textTertiary,
      minWidth: 40,
      textAlign: 'right',
    },
    statsGridMuscleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 5,
      gap: 10,
    },
    statsGridMuscleLabel: {
      width: 80,
      fontSize: 13,
      fontWeight: '400',
      color: colors.textSecondary,
    },
    statsGridMuscleTrack: {
      flex: 1,
      height: 3,
      backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)',
      overflow: 'hidden',
    },
    statsGridMuscleFill: {
      height: '100%',
      backgroundColor: colors.brandPrimary,
      opacity: 0.7,
    },
    statsGridMusclePct: {
      width: 36,
      textAlign: 'right',
      fontSize: 12,
      fontWeight: '500',
      color: colors.textTertiary,
    },
    statsGridFocusRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingVertical: 4,
      gap: 6,
    },
    statsGridFocusDot: {
      fontSize: 16,
      lineHeight: 20,
      color: colors.textTertiary,
    },
    statsGridFocusText: {
      flex: 1,
      fontSize: 13,
      fontWeight: '400',
      color: colors.textSecondary,
      lineHeight: 19,
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
      paddingHorizontal: 24,
      paddingVertical: 16,
      borderRadius: 100,
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
      width: 52,
      height: 52,
      borderRadius: 26,
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
    },
    imageViewerContent: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    imageViewerCloseButton: {
      position: 'absolute',
      right: 20,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 10,
      elevation: 10,
    },
    imageViewerSlide: {
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 32,
    },
    imageViewerImage: {
      width: '100%',
      height: '82%',
    },
    imageViewerCounter: {
      position: 'absolute',
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
  })
}
