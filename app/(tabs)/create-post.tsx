import {
  CreatePostTutorial,
  type TutorialStepConfig,
} from '@/components/CreatePostTutorial'
import { CustomNumericKeypad, type CustomNumericKeypadProps } from '@/components/custom-numeric-keypad'
import { EditorToolbar } from '@/components/editor-toolbar'
import { LiquidGlassSurface } from '@/components/liquid-glass-surface'
import { Paywall } from '@/components/paywall'
import { RestTimerOverlay } from '@/components/RestTimerOverlay'
import { SlideUpView } from '@/components/slide-up-view'
import { StructuredWorkoutInput } from '@/components/structured-workout-input'
import { WorkoutCoachSheet } from '@/components/WorkoutCoachSheet'
import { AnalyticsEvents } from '@/constants/analytics-events'
import { useAnalytics } from '@/contexts/analytics-context'
import { useAuth } from '@/contexts/auth-context'
import { useLiveActivity } from '@/contexts/live-activity-context'
import { useProfile } from '@/contexts/profile-context'
import { useRestTimerContext } from '@/contexts/rest-timer-context'
import { useScrollToTop } from '@/contexts/scroll-to-top-context'
import { useSubscription } from '@/contexts/subscription-context'
import { useSuccessOverlay } from '@/contexts/success-overlay-context'
import { useTutorial } from '@/contexts/tutorial-context'
import { useAudioTranscription } from '@/hooks/useAudioTranscription'
import {
  getExerciseSuggestion,
  parseRepRange,
  useExerciseAutocompleteGroup,
  useShowConvertButton,
} from '@/hooks/useExerciseAutocomplete'
import { useExerciseHistory } from '@/hooks/useExerciseHistory'
import { useExerciseSelection } from '@/hooks/useExerciseSelection'
import { useFreemiumLimits } from '@/hooks/useFreemiumLimits'
import { useImageTranscription } from '@/hooks/useImageTranscription'
import { useRoutineSelection } from '@/hooks/useRoutineSelection'
import { SubmitWorkoutError, useSubmitWorkout } from '@/hooks/useSubmitWorkout'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { useWorkoutTimer } from '@/hooks/useWorkoutTimer'
import { getCoach } from '@/lib/coaches'
import { database } from '@/lib/database'
import { haptic, hapticSuccess } from '@/lib/haptics'
import { clearExerciseHistoryCache } from '@/lib/services/exerciseHistoryService'
import {
  getToolbarButtons,
  getWarmupCalculatorEnabled,
  type ToolbarButtonId,
} from '@/lib/utils/create-post-settings'
import { runAfterInteractions } from '@/lib/utils/run-after-interactions'
import type { StructuredExerciseDraft } from '@/lib/utils/workout-draft'
import {
  clearDraft as clearWorkoutDraft,
  compactDraft as compactWorkoutDraft,
  loadPendingWorkout,
  loadDraft as loadWorkoutDraft,
  saveDraft as saveWorkoutDraft,
  saveDraftPatch as saveWorkoutDraftPatch,
} from '@/lib/utils/workout-draft'
import { buildHydrationPlan } from '@/lib/utils/workout-draft-hydration'
import {
  generateWorkoutMessage,
  parseCommitment,
} from '@/lib/utils/workout-messages'
import { formatVolume } from '@/lib/utils/workout-stats'
import {
  Exercise,
  WorkoutRoutineWithDetails,
  WorkoutSessionWithDetails,
} from '@/types/database.types'
import type { WorkoutSong } from '@/types/music'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  TabActions,
  useFocusEffect,
  useNavigation,
} from '@react-navigation/native'
import { router, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  Easing,
  Image,
  Keyboard,
  type LayoutChangeEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native'
import Reanimated, {
  cancelAnimation,
  Easing as ReanimatedEasing,
  runOnUI,
  useAnimatedKeyboard,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

const IS_DEV_RUNTIME =
  typeof (globalThis as { __DEV__?: boolean }).__DEV__ === 'boolean'
    ? ((globalThis as { __DEV__?: boolean }).__DEV__ as boolean)
    : process.env.NODE_ENV !== 'production'
const DEBUG_LOGS = false

type WindowRect = {
  x: number
  y: number
  width: number
  height: number
}

type ViewLayout = {
  x: number
  y: number
  width: number
  height: number
}

type ExerciseResolutionCandidate = {
  name: string
  score: number
  via: 'name' | 'alias'
  matchedText: string
  equipmentHints: string[]
}

type ExerciseResolutionResult = {
  resolvedName: string | null
  reason:
    | 'empty-query'
    | 'no-candidates'
    | 'exact-name'
    | 'exact-alias'
    | 'high-confidence'
    | 'ambiguous'
    | 'low-confidence'
  topCandidates: ExerciseResolutionCandidate[]
  margin: number
}

const EXERCISE_EQUIPMENT_HINTS = [
  'smith machine',
  'body weight',
  'bodyweight',
  'ez bar',
  'trap bar',
  'barbell',
  'dumbbell',
  'cable',
  'machine',
  'kettlebell',
] as const

function normalizeExerciseMatchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[()]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function tokenizeExerciseMatchText(value: string): string[] {
  return normalizeExerciseMatchText(value).split(/\s+/).filter(Boolean)
}

function extractEquipmentHints(value: string): string[] {
  const normalized = normalizeExerciseMatchText(value)
  return EXERCISE_EQUIPMENT_HINTS.filter((hint) => normalized.includes(hint))
}

function resolveStructuredExercise(
  typedName: string,
  exercises: Exercise[],
): ExerciseResolutionResult {
  const normalizedQuery = normalizeExerciseMatchText(typedName)
  if (!normalizedQuery) {
    return {
      resolvedName: null,
      reason: 'empty-query',
      topCandidates: [],
      margin: 0,
    }
  }

  const queryTokens = tokenizeExerciseMatchText(typedName)
  const queryTokenSet = new Set(queryTokens)
  const queryEquipmentHints = extractEquipmentHints(typedName)
  const candidates: ExerciseResolutionCandidate[] = []

  for (const exercise of exercises) {
    const entries: {
      raw: string
      via: 'name' | 'alias'
    }[] = [
      { raw: exercise.name, via: 'name' },
      ...((exercise.aliases ?? [])
        .filter((alias): alias is string => Boolean(alias?.trim()))
        .map((alias) => ({ raw: alias, via: 'alias' as const }))),
    ]

    let bestCandidate: ExerciseResolutionCandidate | null = null

    for (const entry of entries) {
      const normalizedCandidate = normalizeExerciseMatchText(entry.raw)
      if (!normalizedCandidate) continue

      const candidateEquipmentHints = extractEquipmentHints(
        `${entry.raw} ${exercise.equipment ?? ''} ${(exercise.equipments ?? []).join(' ')}`,
      )

      if (
        queryEquipmentHints.length > 0 &&
        !queryEquipmentHints.some((hint) => candidateEquipmentHints.includes(hint))
      ) {
        continue
      }

      if (normalizedCandidate === normalizedQuery) {
        bestCandidate = {
          name: exercise.name,
          score: 1,
          via: entry.via,
          matchedText: entry.raw,
          equipmentHints: candidateEquipmentHints,
        }
        break
      }

      const candidateTokens = tokenizeExerciseMatchText(entry.raw)
      if (candidateTokens.length === 0) continue

      const candidateTokenSet = new Set(candidateTokens)
      const commonTokenCount = queryTokens.filter((token) =>
        candidateTokenSet.has(token),
      ).length

      if (commonTokenCount === 0) continue

      const coverage = commonTokenCount / queryTokens.length
      const precision = commonTokenCount / candidateTokens.length
      const exactTokenSet =
        coverage === 1 &&
        precision === 1 &&
        candidateTokenSet.size === queryTokenSet.size

      let score = coverage * 0.65 + precision * 0.25

      if (exactTokenSet) {
        score = Math.max(score, 0.97)
      } else if (
        normalizedCandidate.includes(normalizedQuery) ||
        normalizedQuery.includes(normalizedCandidate)
      ) {
        score += 0.05
      }

      if (
        queryEquipmentHints.length > 0 &&
        queryEquipmentHints.some((hint) => candidateEquipmentHints.includes(hint))
      ) {
        score += 0.05
      }

      const candidate: ExerciseResolutionCandidate = {
        name: exercise.name,
        score: Math.min(score, 0.99),
        via: entry.via,
        matchedText: entry.raw,
        equipmentHints: candidateEquipmentHints,
      }

      if (!bestCandidate || candidate.score > bestCandidate.score) {
        bestCandidate = candidate
      }
    }

    if (bestCandidate) {
      candidates.push(bestCandidate)
    }
  }

  candidates.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))

  const topCandidates = candidates.slice(0, 3)
  const best = topCandidates[0]
  const runnerUp = topCandidates[1]
  const margin = best ? best.score - (runnerUp?.score ?? 0) : 0

  if (!best) {
    return {
      resolvedName: null,
      reason: 'no-candidates',
      topCandidates,
      margin,
    }
  }

  if (best.score === 1) {
    return {
      resolvedName: best.name,
      reason: best.via === 'alias' ? 'exact-alias' : 'exact-name',
      topCandidates,
      margin,
    }
  }

  if (best.score >= 0.93 && margin >= 0.12) {
    return {
      resolvedName: best.name,
      reason: 'high-confidence',
      topCandidates,
      margin,
    }
  }

  return {
    resolvedName: null,
    reason: margin < 0.12 ? 'ambiguous' : 'low-confidence',
    topCandidates,
    margin,
  }
}

function normalizeWindowRect(
  rect:
    | {
        x?: number
        y?: number
        width?: number
        height?: number
        left?: number
        top?: number
      }
    | null
    | undefined,
): WindowRect | null {
  if (!rect) return null

  const x = typeof rect.x === 'number' ? rect.x : rect.left
  const y = typeof rect.y === 'number' ? rect.y : rect.top
  const { width, height } = rect

  if (
    typeof x !== 'number' ||
    typeof y !== 'number' ||
    typeof width !== 'number' ||
    typeof height !== 'number' ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return null
  }

  return { x, y, width, height }
}

function formatDurationMinSec(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  if (safeSeconds < 60) return `${safeSeconds}s`
  const mins = Math.floor(safeSeconds / 60)
  const secs = safeSeconds % 60
  if (mins >= 60) {
    const hours = Math.floor(mins / 60)
    const m = mins % 60
    return `${hours}h ${m}min`
  }
  return secs > 0 ? `${mins}min ${secs}s` : `${mins}min`
}

const NEW_USER_STRUCTURED_PREVIEW: StructuredExerciseDraft[] = [
  {
    id: 'preview-bench-press',
    name: 'Bench Press',
    sets: [{ weight: '135', reps: '8' }],
  },
]

export default function CreatePostScreen() {
  const colors = useThemedColors()
  const { weightUnit, convertInputToKg } = useWeightUnits()
  const { scrollToTop } = useScrollToTop()
  const navigation = useNavigation()
  const { coachId } = useProfile()
  const coach = getCoach(coachId)
  const coachFirstName = coach.name.split(' ')[1] || coach.name
  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()
  const isIOS = Platform.OS === 'ios'
  const bottomSafeInset = isIOS ? Math.min(insets.bottom, 34) : insets.bottom
  const KEYBOARD_OVERLAY_ESTIMATED_HEIGHT = 330 + bottomSafeInset
  const KEYBOARD_CURSOR_CLEARANCE = 14
  const KEYBOARD_SCROLL_BUFFER = 8
  const NATIVE_KEYBOARD_EXTRA_ESCAPE = 20
  const CUSTOM_KEYBOARD_EXTRA_ESCAPE = 20
  const TOOLBAR_FALLBACK_HEIGHT = isIOS ? 60 : 50
  // Custom keypad actual height: paddingTop(8) + 4 rows×52 + 3 gaps×8 + paddingBottom(max(inset,10)+6)
  const CUSTOM_KEYPAD_HEIGHT = 246 + Math.max(bottomSafeInset, 10)

  // Exercise history hook for creating exercises with last performance data
  const {
    createExerciseWithHistory,
    createEmptySet,
    fetchSetHistory,
  } = useExerciseHistory()
  const {
    selectedRoutineId: selectedRoutineIdParam,
    refresh: refreshParam,
  } = useLocalSearchParams<{
    selectedRoutineId?: string
    refresh?: string
  }>()
  const selectedRoutineId = selectedRoutineIdParam ?? null
  const refresh = refreshParam ?? null

  // =============================================================================
  // BASIC WORKOUT INPUT STATE
  // =============================================================================
  const [notes, setNotes] = useState('')
  const [workoutTitle, setWorkoutTitle] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // =============================================================================
  // FINALIZE OVERLAY STATE
  // =============================================================================
  const [finalizeDescription, setFinalizeDescription] = useState('')
  const [finalizeDate, setFinalizeDate] = useState(new Date())

  // =============================================================================
  // UI STATE
  // =============================================================================
  const [userWorkoutCount, setUserWorkoutCount] = useState(-1)
  const [isNotesFocused, setIsNotesFocused] = useState(false)
  const [isStructuredInputFocused, setIsStructuredInputFocused] = useState(
    false,
  )
  const [pageTutorialToolbarMode, setPageTutorialToolbarMode] = useState<
    'default' | 'force-add'
  >('default')
  const [keypadProps, setKeypadProps] = useState<CustomNumericKeypadProps | null>(null)
  const [keypadTapShield, setKeypadTapShield] = useState(false)
  const [showPaywall, setShowPaywall] = useState(false)
  const [showCoachSheet, setShowCoachSheet] = useState(false)
  const [isFirstCoachOpen, setIsFirstCoachOpen] = useState(false)
  const [isCoachSheetFirstOpen, setIsCoachSheetFirstOpen] = useState(false)
  const [showPageTutorial, setShowPageTutorial] = useState(false)
  const chatButtonPulse = useSharedValue(1)
  const chatButtonRingOpacity = useSharedValue(0)
  const chatButtonRingScale = useSharedValue(1)
  const chatHandWave = useSharedValue(0)
  const [selectedSong, setSelectedSong] = useState<WorkoutSong | null>(null)
  const [warmupCalculatorEnabled, setWarmupCalculatorEnabled] = useState(() =>
    getWarmupCalculatorEnabled(),
  )
  const [toolbarVisibleButtons, setToolbarVisibleButtons] = useState<
    ToolbarButtonId[]
  >(() => getToolbarButtons())
  const handleStructuredPreviewChange = useCallback(() => {}, [])

  // =============================================================================
  // ROUTINE & STRUCTURED WORKOUT STATE
  // =============================================================================
  const [routines, setRoutines] = useState<WorkoutRoutineWithDetails[]>([])
  const [isStructuredMode, setIsStructuredMode] = useState(false)
  const [allExercises, setAllExercises] = useState<Exercise[]>([])
  const [
    selectedRoutine,
    setSelectedRoutine,
  ] = useState<WorkoutRoutineWithDetails | null>(null)
  const {
    elapsedSeconds: workoutElapsedSeconds,
    isRunning: isWorkoutTimerRunning,
    start: startWorkoutTimer,
    pause: pauseWorkoutTimer,
    reset: resetWorkoutTimer,
    hydrate: hydrateWorkoutTimer,
    getElapsedSeconds: getWorkoutElapsedSeconds,
    serializableState: workoutTimerSerializableState,
  } = useWorkoutTimer()

  const [showRestTimer, setShowRestTimer] = useState(false)
  const restTimer = useRestTimerContext()
  const [autoRestEnabled, setAutoRestEnabled] = useState(true)
  const [autoRestDuration, setAutoRestDuration] = useState(120)
  const {
    startWorkoutActivity,
    updateWorkoutActivity,
    stopWorkoutActivity,
  } = useLiveActivity()

  const [structuredData, setStructuredData] = useState<
    StructuredExerciseDraft[]
  >([])
  const [pendingDraftRoutineId, setPendingDraftRoutineId] = useState<
    string | null
  >(null)
  const [pendingRoutineSource, setPendingRoutineSource] = useState<
    'route' | 'draft' | null
  >(null)

  const hasStructuredEntries = useMemo(() => {
    if (!isStructuredMode) return false
    if (structuredData.length === 0) return false
    return structuredData.some((exercise) =>
      exercise.sets.some((set) => set.weight.trim() || set.reps.trim()),
    )
  }, [isStructuredMode, structuredData])

  const hasWorkoutDraftContent = useMemo(() => {
    const hasStructuredSkeleton = structuredData.length > 0
    return (
      Boolean(notes.trim()) ||
      Boolean(workoutTitle.trim()) ||
      hasStructuredSkeleton ||
      Boolean(selectedRoutine) ||
      Boolean(pendingDraftRoutineId)
    )
  }, [
    notes,
    pendingDraftRoutineId,
    selectedRoutine,
    structuredData,
    workoutTitle,
  ])

  // Context for the AI coach sheet
  const workoutContext = useMemo(
    () => ({
      title: workoutTitle,
      notes,
      exercises: structuredData.map((e) => ({
        name: e.name,
        setsCount: e.sets.length,
        sets: e.sets
          .map((set) => ({
            weight: set.weight || undefined,
            reps: set.reps || undefined,
          }))
          .filter((set) => set.weight || set.reps),
      })),
    }),
    [workoutTitle, notes, structuredData],
  )

  // Check if workout is empty (no notes, no structured workouts)
  const isWorkoutEmpty = useMemo(
    () => !notes.trim() && !workoutTitle.trim() && !hasStructuredEntries,
    [notes, workoutTitle, hasStructuredEntries],
  )


  const shouldShowWorkoutTimer =
    hasWorkoutDraftContent || workoutElapsedSeconds > 0

  const draftStats = useMemo(() => {
    const BODYWEIGHT_FALLBACK_KG = 1
    let volumeKg = 0
    let setsCount = 0
    structuredData.forEach((exercise) => {
      exercise.sets.forEach((set) => {
        const w = parseFloat(set.weight)
        const r = parseFloat(set.reps)
        if (!Number.isNaN(r) && r > 0) {
          const weightKg =
            !Number.isNaN(w) && w > 0
              ? (convertInputToKg(w) ?? w)
              : BODYWEIGHT_FALLBACK_KG
          volumeKg += weightKg * r
        }
        if (set.weight?.trim() || set.reps?.trim()) setsCount += 1
      })
    })
    return {
      volumeKg: Math.round(volumeKg),
      setsCount,
      durationDisplay: formatDurationMinSec(workoutElapsedSeconds ?? 0),
      volumeDisplay: formatVolume(volumeKg, weightUnit),
    }
  }, [structuredData, workoutElapsedSeconds, weightUnit, convertInputToKg])

  const handleStructuredDataChange = useCallback(
    (newData: StructuredExerciseDraft[]) => {
      setStructuredData(newData)
    },
    [],
  )

  const handleRestTimerStart = useCallback(
    (seconds: number) => {
      restTimer.start(seconds)
    },
    [restTimer],
  )

  const handleAutoRestChange = useCallback(
    (enabled: boolean, duration: number) => {
      setAutoRestEnabled(enabled)
      setAutoRestDuration(duration)
    },
    [],
  )

  const handleStructuredInputFocus = useCallback(() => {
    setIsStructuredInputFocused(true)
  }, [])

  const handleStructuredInputBlur = useCallback(() => {
    setIsStructuredInputFocused(false)
    setKeypadProps(null)
  }, [])

  const activateKeypadTapShield = useCallback((durationMs = 340) => {
    keypadTapShieldRef.current = true
    setKeypadTapShield(true)
    if (keypadTapShieldTimeoutRef.current) {
      clearTimeout(keypadTapShieldTimeoutRef.current)
    }
    keypadTapShieldTimeoutRef.current = setTimeout(() => {
      keypadTapShieldTimeoutRef.current = null
      keypadTapShieldRef.current = false
      setKeypadTapShield(false)
    }, durationMs)
  }, [])

  const handleStructuredKeypadStateChange = useCallback(
    (nextKeypadProps: CustomNumericKeypadProps | null) => {
      if (nextKeypadProps && keypadTapShieldRef.current) return
      setKeypadProps((previousKeypadProps) => {
        if (!nextKeypadProps && !previousKeypadProps) {
          return previousKeypadProps
        }

        if (
          nextKeypadProps &&
          previousKeypadProps &&
          nextKeypadProps.field === previousKeypadProps.field &&
          nextKeypadProps.onKeyPress === previousKeypadProps.onKeyPress &&
          nextKeypadProps.onNext === previousKeypadProps.onNext &&
          nextKeypadProps.onDone === previousKeypadProps.onDone
        ) {
          return previousKeypadProps
        }

        return nextKeypadProps
      })
      setIsStructuredInputFocused(Boolean(nextKeypadProps))
    },
    [],
  )

  useEffect(() => {
    return () => {
      if (keypadTapShieldTimeoutRef.current) {
        clearTimeout(keypadTapShieldTimeoutRef.current)
      }
      if (keyboardSettleTimeoutRef.current) {
        clearTimeout(keyboardSettleTimeoutRef.current)
        keyboardSettleTimeoutRef.current = null
      }
      if (toolbarInsetLockTimeoutRef.current) {
        clearTimeout(toolbarInsetLockTimeoutRef.current)
        toolbarInsetLockTimeoutRef.current = null
      }
      if (customSpacerReleaseTimeoutRef.current) {
        clearTimeout(customSpacerReleaseTimeoutRef.current)
        customSpacerReleaseTimeoutRef.current = null
      }
    }
  }, [])

  const scrollFrameAboveKeyboard = useCallback(
    (
      frame: { pageY: number; height: number },
      keyboardOverlayHeight: number,
      extraBottomSpacing = 0,
    ) => {
      if (!scrollViewRef.current || keyboardOverlayHeight <= 0) return

      const toolbarHeight = toolbarVisibleRef.current
        ? Math.max(toolbarBlockingHeightRef.current, TOOLBAR_FALLBACK_HEIGHT)
        : 0
      const blockedBottomHeight =
        keyboardOverlayHeight + toolbarHeight + extraBottomSpacing
      const visibleBottom =
        windowHeight - blockedBottomHeight - KEYBOARD_CURSOR_CLEARANCE
      const frameBottom = frame.pageY + frame.height

      if (frameBottom <= visibleBottom) return

      const delta = frameBottom - visibleBottom
      scrollViewRef.current.scrollTo({
        y: Math.max(0, scrollYRef.current + delta + KEYBOARD_SCROLL_BUFFER),
        animated: true,
      })
    },
    [
      KEYBOARD_CURSOR_CLEARANCE,
      KEYBOARD_SCROLL_BUFFER,
      TOOLBAR_FALLBACK_HEIGHT,
      windowHeight,
    ],
  )

  const ensureStructuredInputVisible = useCallback(
    (frame: { pageY: number; height: number }) => {
      if (keypadVisibleRef.current) {
        scrollFrameAboveKeyboard(
          frame,
          CUSTOM_KEYPAD_HEIGHT,
          CUSTOM_KEYBOARD_EXTRA_ESCAPE,
        )
        return
      }
      scrollFrameAboveKeyboard(frame, nativeKeyboardHeightRef.current)
    },
    [CUSTOM_KEYBOARD_EXTRA_ESCAPE, CUSTOM_KEYPAD_HEIGHT, scrollFrameAboveKeyboard],
  )

  // Navigate to exercise page if exercise exists in the database
  const handleExerciseNamePress = useCallback(
    (exerciseName: string) => {
      // Case-insensitive exact match
      const normalizedName = exerciseName.toLowerCase().trim()
      const matchedExercise = allExercises.find(
        (e) => e.name.toLowerCase().trim() === normalizedName,
      )

      if (matchedExercise) {
        router.push(`/exercise/${matchedExercise.id}`)
      }
      // If no match found, do nothing
    },
    [allExercises],
  )

  const [
    lastRoutineWorkout,
    setLastRoutineWorkout,
  ] = useState<WorkoutSessionWithDetails | null>(null)

  // =============================================================================
  // TEXT-TO-STRUCTURED CONVERSION STATE
  // =============================================================================
  const [cursorPosition, setCursorPosition] = useState(0)
  const [showEmptyExercisePrompt, setShowEmptyExercisePrompt] = useState(false)

  // Use hook for convert button visibility
  const showConvertButton = useShowConvertButton(
    notes,
    cursorPosition,
    isNotesFocused,
  )

  // =============================================================================
  // IMAGE ATTACHMENT STATE
  // =============================================================================
  const [attachedImageUri, setAttachedImageUri] = useState<string | null>(null)

  const { setPendingStreakData } = useSuccessOverlay()
  const spinValue = useRef(new Animated.Value(0)).current
  const buttonScaleAnim = useRef(new Animated.Value(1)).current
  const imageOpacity = useRef(new Animated.Value(0)).current

  const notesInputRef = useRef<TextInput>(null)
  const scrollViewRef = useRef<ScrollView>(null)
  const chatButtonRef = useRef<View>(null)
  const chatButtonTutorialRectRef = useRef<{
    x: number
    y: number
    width: number
    height: number
  } | null>(null)
  const keyboardViewLayoutRef = useRef<ViewLayout | null>(null)
  const titleInputContainerLayoutRef = useRef<ViewLayout | null>(null)
  const chatButtonLocalLayoutRef = useRef<ViewLayout | null>(null)
  const toolbarTimerRef = useRef<View>(null)
  const toolbarRoutineRef = useRef<View>(null)
  const toolbarSearchRef = useRef<View>(null)
  const toolbarAddRef = useRef<View>(null)
  const scrollYRef = useRef(0)
  const nativeKeyboardHeightRef = useRef(0)
  const keypadVisibleRef = useRef(false)
  const toolbarMeasuredHeightRef = useRef(0)
  const toolbarBlockingHeightRef = useRef(0)
  const toolbarVisibleRef = useRef(false)
  const keyboardSettleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toolbarInsetLockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const customSpacerReleaseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )
  const keypadTapShieldRef = useRef(false)
  const keypadTapShieldTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const emptyExercisePromptTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )
  const notesRef = useRef(notes)
  const titleRef = useRef(workoutTitle)
  const selectedSongRef = useRef<WorkoutSong | null>(selectedSong)
  const structuredDataRef = useRef(structuredData)
  const isStructuredModeRef = useRef(isStructuredMode)
  const selectedRoutineIdRef = useRef<string | null>(null)
  const pendingDraftRoutineIdRef = useRef<string | null>(null)
  const workoutTimerStateRef = useRef(workoutTimerSerializableState)
  const lastLocalEditAtRef = useRef(0)
  const lastDraftSavedAtRef = useRef(0)
  const lastRouteRoutineTokenRef = useRef<string | null>(null)
  const hasHydratedRef = useRef(false)
  const isScreenFocusedRef = useRef(false)
  const suppressLocalEditTrackingRef = useRef(false)
  // Skip counter - decrements each time auto-save would run, skips while > 0
  const skipPersistCountRef = useRef(0)
  const isHydratingRef = useRef(true)
  const isSubmittingRef = useRef(false)
  const hadWorkoutDraftContentRef = useRef(false)
  const [isToolbarInsetLocked, setIsToolbarInsetLocked] = useState(false)
  const { user } = useAuth()
  const { trackEvent } = useAnalytics()
  const { isProMember } = useSubscription()
  const { completeStep } = useTutorial()
  const { submitWorkout: queueWorkout } = useSubmitWorkout()
  const { canPostWorkout, refresh: refreshFreemiumLimits } = useFreemiumLimits()

  // Complete tutorial step when user actually starts a workout (has content)
  useEffect(() => {
    if (hasWorkoutDraftContent) {
      completeStep('create_workout')
    }
  }, [hasWorkoutDraftContent, completeStep])

  // Check if this is the user's first time opening the coach sheet
  const COACH_SHEET_SEEN_KEY = user?.id
    ? `coach_sheet_seen_${user.id}`
    : null

  useEffect(() => {
    if (!COACH_SHEET_SEEN_KEY) return
    AsyncStorage.getItem(COACH_SHEET_SEEN_KEY).then((val) => {
      if (!val) setIsFirstCoachOpen(true)
    })
  }, [COACH_SHEET_SEEN_KEY])

  // Check if user should see the create-post page tutorial
  const PAGE_TUTORIAL_SEEN_KEY = user?.id
    ? `create_post_tutorial_seen_${user.id}`
    : null

  useFocusEffect(
    useCallback(() => {
      if (!PAGE_TUTORIAL_SEEN_KEY) return

      let cancelled = false
      const t = setTimeout(() => {
        AsyncStorage.getItem(PAGE_TUTORIAL_SEEN_KEY).then((val) => {
          if (!cancelled) {
            setShowPageTutorial(!val)
          }
        })
      }, 600)

      return () => clearTimeout(t)
    }, [PAGE_TUTORIAL_SEEN_KEY]),
  )

  const readWindowRect = useCallback(
    (
      ref: React.RefObject<View | null>,
    ): WindowRect | null => {
      const rawRect = (
        ref.current as
          | (View & {
              getBoundingClientRect?: () => {
                x: number
                y: number
                width: number
                height: number
                left?: number
                top?: number
              }
            })
          | null
      )?.getBoundingClientRect?.()

      const rect = normalizeWindowRect(rawRect)
      return rect ?? null
    },
    [],
  )

  const measureInWindowRef = useCallback(
    (
      ref: React.RefObject<View | null>,
    ): Promise<WindowRect | null> =>
      new Promise((resolve) => {
        if (!ref.current) {
          resolve(null)
          return
        }

        ref.current.measureInWindow((x, y, width, height) => {
          const rect = normalizeWindowRect({ x, y, width, height })
          resolve(rect)
        })
      }),
    [],
  )

  const measureRef = useCallback(
    (
      ref: React.RefObject<View | null>,
    ): Promise<WindowRect | null> =>
      measureInWindowRef(ref).then((windowRect) => {
        if (windowRect) {
          return windowRect
        }

        return readWindowRect(ref)
      }),
    [measureInWindowRef, readWindowRect],
  )

  const getChatButtonTutorialRectFromLayout = useCallback((): WindowRect | null => {
    const keyboardViewLayout = keyboardViewLayoutRef.current
    const titleInputContainerLayout = titleInputContainerLayoutRef.current
    const chatButtonLocalLayout = chatButtonLocalLayoutRef.current

    if (!keyboardViewLayout || !titleInputContainerLayout || !chatButtonLocalLayout) {
      return null
    }

    const rect = normalizeWindowRect({
      x:
        insets.left +
        keyboardViewLayout.x +
        titleInputContainerLayout.x +
        chatButtonLocalLayout.x,
      y:
        insets.top +
        keyboardViewLayout.y +
        titleInputContainerLayout.y +
        chatButtonLocalLayout.y -
        scrollYRef.current,
      width: chatButtonLocalLayout.width,
      height: chatButtonLocalLayout.height,
    })

    return rect
  }, [insets.left, insets.top])

  const updateChatButtonTutorialRect = useCallback(() => {
    const layoutRect = getChatButtonTutorialRectFromLayout()
    if (layoutRect) {
      chatButtonTutorialRectRef.current = layoutRect
      return
    }

    void measureInWindowRef(chatButtonRef).then((windowRect) => {
      if (windowRect) {
        chatButtonTutorialRectRef.current = windowRect
        return
      }

      const syncRect = readWindowRect(chatButtonRef)
      chatButtonTutorialRectRef.current = syncRect
    })
  }, [getChatButtonTutorialRectFromLayout, measureInWindowRef, readWindowRect])

  const handleKeyboardViewLayout = useCallback(
    (event: LayoutChangeEvent) => {
      keyboardViewLayoutRef.current = event.nativeEvent.layout
      requestAnimationFrame(() => {
        updateChatButtonTutorialRect()
      })
    },
    [updateChatButtonTutorialRect],
  )

  const handleTitleInputContainerLayout = useCallback(
    (event: LayoutChangeEvent) => {
      titleInputContainerLayoutRef.current = event.nativeEvent.layout
      requestAnimationFrame(() => {
        updateChatButtonTutorialRect()
      })
    },
    [updateChatButtonTutorialRect],
  )

  const handleChatButtonLayout = useCallback(
    (event: LayoutChangeEvent) => {
      chatButtonLocalLayoutRef.current = event.nativeEvent.layout
      requestAnimationFrame(() => {
        updateChatButtonTutorialRect()
      })
    },
    [updateChatButtonTutorialRect],
  )

  useEffect(() => {
    if (!showPageTutorial) {
      setPageTutorialToolbarMode('default')
      return
    }

    const handle = runAfterInteractions(() => {
      requestAnimationFrame(() => {
        updateChatButtonTutorialRect()
      })
    })

    return () => {
      handle.cancel?.()
    }
  }, [showPageTutorial, updateChatButtonTutorialRect])

  const pageTutorialSteps: TutorialStepConfig[] = useMemo(
    () => [
      {
        id: 'coach_chat',
        title: 'AI Coach',
        description:
          'Chat with your coach to generate workouts, swap exercises, or get advice.',
        icon: 'chatbubble-ellipses-outline',
        measureTarget: async () => {
          const layoutRect = getChatButtonTutorialRectFromLayout()
          if (layoutRect) {
            chatButtonTutorialRectRef.current = layoutRect
            return layoutRect
          }

          const freshRect = await measureRef(chatButtonRef)
          if (freshRect) {
            chatButtonTutorialRectRef.current = freshRect
            return freshRect
          }

          return chatButtonTutorialRectRef.current
        },
      },
      {
        id: 'add_exercise',
        title: 'Add Exercise',
        description:
          'When you type an exercise name, tap + to turn it into a structured exercise you can log.',
        icon: 'add-outline',
        measureTarget: () =>
          measureRef(Platform.OS === 'ios' ? toolbarAddRef : toolbarSearchRef),
      },
      {
        id: 'search_exercise',
        title: 'Search Exercises',
        description:
          'Find and add exercises from a library of 600+.',
        icon: 'search-outline',
        measureTarget: () => measureRef(toolbarSearchRef),
      },
      {
        id: 'routines',
        title: 'Routines',
        description:
          'Load a saved routine to auto-fill your workout.',
        icon: 'albums-outline',
        measureTarget: () => measureRef(toolbarRoutineRef),
      },
      {
        id: 'rest_timer',
        title: 'Rest Timer',
        description:
          'Time your rest between sets with notifications.',
        icon: 'stopwatch-outline',
        measureTarget: () => measureRef(toolbarTimerRef),
      },
      {
        id: 'logging',
        title: 'Log workouts how you like!',
        description: '',
        icon: 'create-outline',
        bullets: [
          { icon: 'create-outline', label: 'Notes', detail: 'Log it like Apple Notes, free-form' },
          { icon: 'add-outline', label: 'Structured', detail: 'Type an exercise name and tap +' },
          { icon: 'search-outline', label: 'Search exercises', detail: 'Tap search to see exercises and videos' },
        ],
        footer: 'No matter how you log, after you save, AI detects your exercises and saves them correctly.',
      },
    ],
    [getChatButtonTutorialRectFromLayout, measureRef],
  )

  const handlePageTutorialStepPress = useCallback((stepId: string) => {
    if (stepId === 'coach_chat') {
      setPageTutorialToolbarMode('force-add')
      return
    }

    if (stepId === 'add_exercise') {
      setPageTutorialToolbarMode('default')
    }
  }, [])

  const handlePageTutorialComplete = useCallback(() => {
    setPageTutorialToolbarMode('default')
    setShowPageTutorial(false)
    if (PAGE_TUTORIAL_SEEN_KEY) {
      AsyncStorage.setItem(PAGE_TUTORIAL_SEEN_KEY, 'true')
    }
  }, [PAGE_TUTORIAL_SEEN_KEY])

  // Wave animation for coach avatar button on first open
  useEffect(() => {
    if (!isFirstCoachOpen) {
      runOnUI(() => {
        'worklet'
        cancelAnimation(chatHandWave)
        chatHandWave.value = 0
      })()
      return
    }
    runOnUI(() => {
      'worklet'
      chatHandWave.value = withRepeat(
        withSequence(
          withTiming(-25, { duration: 180, easing: ReanimatedEasing.inOut(ReanimatedEasing.ease) }),
          withTiming(15, { duration: 180, easing: ReanimatedEasing.inOut(ReanimatedEasing.ease) }),
          withTiming(-20, { duration: 160, easing: ReanimatedEasing.inOut(ReanimatedEasing.ease) }),
          withTiming(10, { duration: 160, easing: ReanimatedEasing.inOut(ReanimatedEasing.ease) }),
          withTiming(0, { duration: 200, easing: ReanimatedEasing.out(ReanimatedEasing.ease) }),
          withTiming(0, { duration: 900 }), // pause between waves
        ),
        -1,
      )
    })()
  }, [isFirstCoachOpen, chatHandWave])

  const startToolbarInsetHandoff = useCallback(() => {
    setIsToolbarInsetLocked(true)
    if (toolbarInsetLockTimeoutRef.current) {
      clearTimeout(toolbarInsetLockTimeoutRef.current)
    }
    // Keep toolbar inset pinned while native keyboard starts animating in.
    toolbarInsetLockTimeoutRef.current = setTimeout(() => {
      toolbarInsetLockTimeoutRef.current = null
      setIsToolbarInsetLocked(false)
    }, 420)
  }, [])

  const ensureNotesCursorVisible = useCallback(
    (keyboardHeight?: number) => {
      if (!isNotesFocused || !notesInputRef.current) return

      const overlayHeight =
        typeof keyboardHeight === 'number'
          ? keyboardHeight
          : keypadVisibleRef.current
          ? CUSTOM_KEYPAD_HEIGHT
          : nativeKeyboardHeightRef.current
      if (overlayHeight <= 0) return
      const nativeExtraBottomSpacing = keypadVisibleRef.current
        ? CUSTOM_KEYBOARD_EXTRA_ESCAPE
        : NATIVE_KEYBOARD_EXTRA_ESCAPE

      const lineIndex = Math.max(1, notes.slice(0, cursorPosition).split('\n').length)
      const lineHeight = 24
      const inputPaddingTop =
        isStructuredMode && (structuredData.length > 0 || selectedRoutine) ? 8 : 16

      notesInputRef.current.measureInWindow((_x, y, _width, height) => {
        if (height <= 0 || y <= 0) return

        const cursorBottom = y + inputPaddingTop + lineIndex * lineHeight
        scrollFrameAboveKeyboard(
          { pageY: cursorBottom - lineHeight, height: lineHeight },
          overlayHeight,
          nativeExtraBottomSpacing,
        )
      })
    },
    [
      CUSTOM_KEYPAD_HEIGHT,
      CUSTOM_KEYBOARD_EXTRA_ESCAPE,
      cursorPosition,
      isNotesFocused,
      isStructuredMode,
      NATIVE_KEYBOARD_EXTRA_ESCAPE,
      notes,
      scrollFrameAboveKeyboard,
      selectedRoutine,
      structuredData.length,
    ],
  )

  useEffect(() => {
    keypadVisibleRef.current = Boolean(keypadProps)
  }, [keypadProps])

  useEffect(() => {
    const nextIsToolbarVisible =
      toolbarVisibleButtons.length > 0 &&
      (!isStructuredInputFocused || Boolean(keypadProps))

    toolbarVisibleRef.current = nextIsToolbarVisible
    if (!nextIsToolbarVisible) {
      toolbarBlockingHeightRef.current = 0
      return
    }

    toolbarBlockingHeightRef.current =
      toolbarMeasuredHeightRef.current > 0
        ? toolbarMeasuredHeightRef.current
        : TOOLBAR_FALLBACK_HEIGHT
  }, [
    TOOLBAR_FALLBACK_HEIGHT,
    isStructuredInputFocused,
    keypadProps,
    toolbarVisibleButtons.length,
  ])

  const handleToolbarLayout = useCallback((event: LayoutChangeEvent) => {
    const measuredHeight = Math.max(0, event.nativeEvent.layout.height)
    if (!measuredHeight) return

    toolbarMeasuredHeightRef.current = measuredHeight
    if (toolbarVisibleRef.current) {
      toolbarBlockingHeightRef.current = measuredHeight
    }
  }, [])

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'

    const handleKeyboardShow = (event: {
      endCoordinates?: { height?: number }
    }) => {
      const keyboardHeight = Math.max(0, event.endCoordinates?.height ?? 0)
      nativeKeyboardHeightRef.current = keyboardHeight
      if (toolbarInsetLockTimeoutRef.current) {
        clearTimeout(toolbarInsetLockTimeoutRef.current)
        toolbarInsetLockTimeoutRef.current = null
      }
      setIsToolbarInsetLocked(false)
      if (keyboardSettleTimeoutRef.current) {
        clearTimeout(keyboardSettleTimeoutRef.current)
      }

      requestAnimationFrame(() => {
        ensureNotesCursorVisible(keyboardHeight)
      })
      keyboardSettleTimeoutRef.current = setTimeout(() => {
        const settledHeight = nativeKeyboardHeightRef.current
        if (settledHeight <= 0) return

        ensureNotesCursorVisible(settledHeight)
      }, 160)
    }

    const handleKeyboardHide = () => {
      nativeKeyboardHeightRef.current = 0
      if (toolbarInsetLockTimeoutRef.current) {
        clearTimeout(toolbarInsetLockTimeoutRef.current)
        toolbarInsetLockTimeoutRef.current = null
      }
      setIsToolbarInsetLocked(false)
      if (keyboardSettleTimeoutRef.current) {
        clearTimeout(keyboardSettleTimeoutRef.current)
        keyboardSettleTimeoutRef.current = null
      }
    }

    const showSub = Keyboard.addListener(showEvent, handleKeyboardShow)
    const hideSub = Keyboard.addListener(hideEvent, handleKeyboardHide)
    const frameSub =
      Platform.OS === 'ios'
        ? Keyboard.addListener('keyboardWillChangeFrame', handleKeyboardShow)
        : null

    return () => {
      if (keyboardSettleTimeoutRef.current) {
        clearTimeout(keyboardSettleTimeoutRef.current)
        keyboardSettleTimeoutRef.current = null
      }
      if (toolbarInsetLockTimeoutRef.current) {
        clearTimeout(toolbarInsetLockTimeoutRef.current)
        toolbarInsetLockTimeoutRef.current = null
      }
      showSub.remove()
      hideSub.remove()
      frameSub?.remove()
    }
  }, [ensureNotesCursorVisible])

  const logDraftDebug = useCallback(
    (_event: string, _payload?: Record<string, unknown>) => {
      if (!DEBUG_LOGS || !IS_DEV_RUNTIME) return
    },
    [],
  )

  const buildDraftMetrics = useCallback((data: StructuredExerciseDraft[]) => {
    let setsWithData = 0
    data.forEach((exercise) => {
      exercise.sets.forEach((set) => {
        if (set.weight?.trim() || set.reps?.trim()) {
          setsWithData += 1
        }
      })
    })

    return {
      structuredExercisesCount: data.length,
      structuredSetsWithDataCount: setsWithData,
    }
  }, [])

  const persistDraft = useCallback(
    (source: 'unmount' | 'background' | 'blur') => {
      // Never persist while hydration is in progress; this can overwrite a valid
      // on-disk draft with initial empty state during app lifecycle transitions.
      if (isHydratingRef.current || !hasHydratedRef.current) {
        logDraftDebug('persist-skipped', {
          source,
          isHydrating: isHydratingRef.current,
          hasHydrated: hasHydratedRef.current,
        })
        return
      }

      const routineIdToSave =
        selectedRoutineIdRef.current ?? pendingDraftRoutineIdRef.current ?? null
      const updatedAt = Math.max(Date.now(), lastLocalEditAtRef.current)
      lastDraftSavedAtRef.current = updatedAt
      const hasInMemoryDraftContent =
        Boolean(notesRef.current.trim()) ||
        Boolean(titleRef.current.trim()) ||
        structuredDataRef.current.length > 0 ||
        Boolean(routineIdToSave) ||
        Boolean(workoutTimerStateRef.current.timerStartedAt) ||
        (workoutTimerStateRef.current.timerElapsedSeconds ?? 0) > 0

      // Do not compact empty in-memory state; this can clear a valid on-disk draft
      // if a non-focused/preloaded instance unmounts.
      if (!hasInMemoryDraftContent) {
        logDraftDebug('persist-skipped-empty', {
          source,
          updatedAt,
        })
        return
      }

      logDraftDebug('persist-start', {
        source,
        updatedAt,
        notesLength: notesRef.current.trim().length,
        hasTitle: Boolean(titleRef.current.trim()),
        structuredCount: structuredDataRef.current.length,
        hasRoutine: Boolean(routineIdToSave),
        timerStartedAt: workoutTimerStateRef.current.timerStartedAt,
        timerElapsedSeconds: workoutTimerStateRef.current.timerElapsedSeconds,
      })

      void compactWorkoutDraft({
        notes: notesRef.current,
        title: titleRef.current,
        song: selectedSongRef.current,
        structuredData: structuredDataRef.current,
        isStructuredMode: isStructuredModeRef.current,
        selectedRoutineId: routineIdToSave,
        timerStartedAt: workoutTimerStateRef.current.timerStartedAt,
        timerElapsedSeconds: workoutTimerStateRef.current.timerElapsedSeconds,
        updatedAt,
      })
        .then(() => {
          logDraftDebug('persist-success', {
            source,
            updatedAt,
          })
          const metrics = buildDraftMetrics(structuredDataRef.current)
          trackEvent(AnalyticsEvents.WORKOUT_DRAFT_PERSISTED, {
            action: 'compact',
            source,
            length: notesRef.current.trim().length,
            hasTitle: Boolean(titleRef.current.trim()),
            updatedAt,
            ...metrics,
          })
        })
        .catch((error) => {
          console.error(`[Draft] ${source} compact failed:`, error)
          logDraftDebug('persist-failed', {
            source,
            error: error instanceof Error ? error.message : String(error),
          })
          trackEvent(AnalyticsEvents.WORKOUT_DRAFT_PERSISTED, {
            action: 'fail',
            source,
            reason: 'compact_failed',
            error: error instanceof Error ? error.message : String(error),
            length: notesRef.current.trim().length,
            hasTitle: Boolean(titleRef.current.trim()),
            updatedAt,
            ...buildDraftMetrics(structuredDataRef.current),
          })
        })
    },
    [buildDraftMetrics, logDraftDebug, trackEvent],
  )

  useEffect(() => {
    notesRef.current = notes
  }, [notes])

  useEffect(() => {
    titleRef.current = workoutTitle
  }, [workoutTitle])

  useEffect(() => {
    selectedSongRef.current = selectedSong
  }, [selectedSong])

  useEffect(() => {
    structuredDataRef.current = structuredData
  }, [structuredData])

  useEffect(() => {
    isStructuredModeRef.current = isStructuredMode
  }, [isStructuredMode])

  useEffect(() => {
    selectedRoutineIdRef.current = selectedRoutine?.id ?? null
  }, [selectedRoutine?.id])

  useEffect(() => {
    pendingDraftRoutineIdRef.current = pendingDraftRoutineId
  }, [pendingDraftRoutineId])

  useEffect(() => {
    workoutTimerStateRef.current = workoutTimerSerializableState
  }, [workoutTimerSerializableState])

  useEffect(() => {
    if (isHydratingRef.current || !hasHydratedRef.current) {
      return
    }
    if (suppressLocalEditTrackingRef.current) {
      suppressLocalEditTrackingRef.current = false
      return
    }
    lastLocalEditAtRef.current = Date.now()
  }, [
    notes,
    workoutTitle,
    selectedSong,
    structuredData,
    isStructuredMode,
    selectedRoutine?.id,
  ])

  useEffect(() => {
    if (isHydratingRef.current || !isScreenFocusedRef.current) {
      return
    }

    const hadWorkoutDraftContent = hadWorkoutDraftContentRef.current
    hadWorkoutDraftContentRef.current = hasWorkoutDraftContent

    if (hasWorkoutDraftContent) {
      if (!isWorkoutTimerRunning) {
        startWorkoutTimer()
      }
      return
    }

    // If the user manually clears all draft content, treat it like a cleared draft:
    // reset timer state and remove persisted draft data.
    if (hadWorkoutDraftContent) {
      resetWorkoutTimer()
      void clearWorkoutDraft('create-post-empty-input')
    }
  }, [
    hasWorkoutDraftContent,
    isWorkoutTimerRunning,
    resetWorkoutTimer,
    startWorkoutTimer,
  ])

  // Sync Live Activity with workout timer for Dynamic Island display
  const hasStartedActivityRef = useRef(false)
  useEffect(() => {
    if (isWorkoutTimerRunning && workoutElapsedSeconds > 0) {
      if (!hasStartedActivityRef.current) {
        // First time seeing a running timer in this session - start the activity
        startWorkoutActivity()
        hasStartedActivityRef.current = true
      } else {
        // Already started - just update
        updateWorkoutActivity(workoutElapsedSeconds)
      }
    } else if (hasStartedActivityRef.current) {
      // Timer stopped or cleared - stop the activity
      stopWorkoutActivity()
      hasStartedActivityRef.current = false
    }
  }, [
    isWorkoutTimerRunning,
    workoutElapsedSeconds,
    startWorkoutActivity,
    updateWorkoutActivity,
    stopWorkoutActivity,
  ])

  const blurInputs = useCallback(() => {
    const textInputState = (TextInput as any)?.State
    const activeInput = textInputState?.currentlyFocusedInput?.()

    if (activeInput) {
      textInputState?.blurTextInput?.(activeInput)
    }

    notesInputRef.current?.blur?.()
    setIsStructuredInputFocused(false)
    Keyboard.dismiss()
  }, [])

  const resetLocalWorkoutDraftState = useCallback(() => {
    suppressLocalEditTrackingRef.current = true
    // Skip the next few autosaves while reset state propagates.
    skipPersistCountRef.current = 3

    // Update refs immediately so any lifecycle-triggered persist in the same
    // tick sees cleared state and cannot recreate a discarded draft.
    notesRef.current = ''
    titleRef.current = ''
    structuredDataRef.current = []
    isStructuredModeRef.current = false
    selectedRoutineIdRef.current = null
    pendingDraftRoutineIdRef.current = null
    workoutTimerStateRef.current = {
      timerStartedAt: null,
      timerElapsedSeconds: 0,
    }

    resetWorkoutTimer()
    setNotes('')
    setWorkoutTitle('')
    setAttachedImageUri(null)
    setIsStructuredMode(false)
    setSelectedRoutine(null)
    setPendingDraftRoutineId(null)
    setPendingRoutineSource(null)
    setStructuredData([])
    setLastRoutineWorkout(null)
    setFinalizeDescription('')
    setFinalizeDate(new Date())
    setSelectedSong(null)

    lastDraftSavedAtRef.current = 0
    lastLocalEditAtRef.current = 0
  }, [resetWorkoutTimer])

  // Use audio transcription hook
  const {
    isRecording,
    isTranscribing,
    toggleRecording,
    stopRecording,
  } = useAudioTranscription({
    weightUnit,
    onStructuredTranscriptionComplete: (data) => {
      // Set title if extracted and not already set
      if (data.title && !workoutTitle.trim()) {
        setWorkoutTitle(data.title)
      }

      // Convert parsed exercises to StructuredExerciseDraft format
      const structuredExercises: StructuredExerciseDraft[] = data.exercises.map(
        (exercise) => ({
          id: exercise.id,
          name: exercise.name,
          sets: exercise.sets.map((set) => ({
            weight: set.weight,
            reps: set.reps,
            isWarmup: false,
            lastWorkoutWeight: null,
            lastWorkoutReps: null,
            targetRepsMin: null,
            targetRepsMax: null,
            targetRestSeconds: null,
          })),
        }),
      )

      // Append structured exercises and enable structured mode
      setStructuredData((prev) => [...prev, ...structuredExercises])
      setIsStructuredMode(true)
    },
    onTranscriptionComplete: (text) => {
      // Fallback: if structured parsing fails, append raw text to notes
      setNotes((prev) => (prev ? `${prev}\n${text}` : text))
    },
  })

  // Use image transcription hook
  const {
    isProcessing: isProcessingImage,
    handleScanWithCamera,
    handleScanWithLibrary,
    handleAttachWithCamera,
    handleAttachWithLibrary,
  } = useImageTranscription({
    onStructuredExtractionComplete: (data) => {
      // Set title if extracted
      if (data.title) {
        setWorkoutTitle(data.title)
      }

      // Set description in notes if provided
      if (data.description) {
        const desc = data.description
        setNotes((prev) => (prev ? `${prev}\n\n${desc}` : desc))
      }

      // Convert parsed exercises to StructuredExerciseDraft format
      const structuredExercises: StructuredExerciseDraft[] = data.exercises.map(
        (exercise) => ({
          id: exercise.id,
          name: exercise.name,
          sets: exercise.sets.map((set) => ({
            weight: set.weight,
            reps: set.reps,
            isWarmup: false,
            lastWorkoutWeight: null,
            lastWorkoutReps: null,
            targetRepsMin: null,
            targetRepsMax: null,
            targetRestSeconds: null,
          })),
        }),
      )

      // Set the structured data and enable structured mode
      setStructuredData((prev) => [...prev, ...structuredExercises])
      setIsStructuredMode(true)
    },
    onExtractionComplete: (data) => {
      // Fallback: if structured parsing fails, use the old text-based approach
      if (data.title) {
        setWorkoutTitle(data.title)
      }
      const newNotes = data.description
        ? `${data.description}\n\n${data.workout}`
        : data.workout
      setNotes((prev) => (prev ? `${prev}\n\n${newNotes}` : newNotes))
    },
    onImageAttached: (uri) => {
      imageOpacity.setValue(0)
      setAttachedImageUri(uri)
    },
  })

  const styles = createStyles(colors, {
    ...insets,
    bottom: bottomSafeInset,
  })

  // Animate camera processing and audio transcription spinner
  useEffect(() => {
    if (isProcessingImage || isTranscribing) {
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1200,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ).start()
    } else {
      spinValue.setValue(0)
    }
  }, [isProcessingImage, isTranscribing, spinValue])

  // Load user's routines and exercises
  const loadRoutinesAndExercises = useCallback(async () => {
    try {
      if (user?.id) {
        const [
          userRoutines,
          allExercisesList,
          recentExercises,
        ] = await Promise.all([
          database.workoutRoutines.getAll(user.id),
          database.exercises.getAll(),
          database.exercises.getRecent(user.id, 50), // Fetch last 50 unique recent exercises
        ])

        setRoutines(userRoutines)

        // Sort exercises: Recent ones first, then alphabetical
        // This ensures autocomplete suggests frequently used exercises first
        const recentIds = new Set(recentExercises.map((e) => e.id))
        const otherExercises = allExercisesList.filter(
          (e) => !recentIds.has(e.id),
        )

        setAllExercises([...recentExercises, ...otherExercises])
      }
    } catch (error) {
      console.error('[CreatePost] Error loading data:', error)
    }
  }, [user])

  // Track if we're waiting for routines to load before applying pending routine
  const pendingRoutineWaitingForLoad = useRef(false)

  useEffect(() => {
    if (!pendingDraftRoutineId) {
      pendingRoutineWaitingForLoad.current = false
      return
    }

    const routine = routines.find((item) => item.id === pendingDraftRoutineId)

    if (!routine) {
      // Routines might not be loaded yet - mark that we're waiting
      if (routines.length === 0) {
        pendingRoutineWaitingForLoad.current = true
      } else {
        // Routines loaded but routine not found - routine may have been deleted
        pendingRoutineWaitingForLoad.current = false
        setPendingDraftRoutineId(null)
        setPendingRoutineSource(null)
      }
      return
    }

    pendingRoutineWaitingForLoad.current = false

    // Capture source before clearing to use in logic below
    const source = pendingRoutineSource

    // Clear pending state synchronously BEFORE other state updates to prevent re-triggers
    setPendingDraftRoutineId(null)
    setPendingRoutineSource(null)

    setSelectedRoutine(routine)
    setIsStructuredMode(true)

    // Transform routine exercises into structured data format
    const transformedExercises = (routine.workout_routine_exercises || [])
      .sort((a, b) => a.order_index - b.order_index)
      .map((we) => ({
        id: we.id,
        name: we.exercise?.name || 'Exercise',
        sets: (we.sets || [])
          .sort((a, b) => a.set_number - b.set_number)
          .map((s) => ({
            weight: '',
            reps: '',
            targetRepsMin: s.reps_min ?? null,
            targetRepsMax: s.reps_max ?? null,
            targetRestSeconds: s.rest_seconds ?? null,
          })),
      }))

    // Only set if this is a fresh routine start (from route, not draft)
    if (source === 'route') {
      setStructuredData(transformedExercises)
    }
    setLastRoutineWorkout(null)

    if (source === 'route' || !titleRef.current.trim()) {
      setWorkoutTitle(routine.name)
    }

    // Persist the routine selection immediately to avoid losing it on navigation
    // Use the transformed exercises if we just set them
    const routineTitleToSave =
      source === 'route' ? routine.name : titleRef.current
    const structuredToSave =
      source === 'route' ? transformedExercises : structuredData
    const routineUpdatedAt = Date.now()
    void saveWorkoutDraft({
      notes,
      title: routineTitleToSave,
      song: selectedSongRef.current,
      structuredData: structuredToSave,
      isStructuredMode: true,
      selectedRoutineId: routine.id,
      timerStartedAt: workoutTimerSerializableState.timerStartedAt,
      timerElapsedSeconds: workoutTimerSerializableState.timerElapsedSeconds,
      updatedAt: routineUpdatedAt,
    })
      .then(() => {
        const metrics = buildDraftMetrics(structuredToSave)
        trackEvent(AnalyticsEvents.WORKOUT_DRAFT_PERSISTED, {
          action: 'compact',
          source: 'routine',
          length: notes.trim().length,
          hasTitle: Boolean(routineTitleToSave.trim()),
          updatedAt: routineUpdatedAt,
          ...metrics,
        })
      })
      .catch((error) => {
        console.error('[Routine] Immediate persist failed:', error)
        trackEvent(AnalyticsEvents.WORKOUT_DRAFT_PERSISTED, {
          action: 'fail',
          source: 'routine',
          reason: 'save_failed',
          error: error instanceof Error ? error.message : String(error),
          length: notes.trim().length,
          hasTitle: Boolean(routineTitleToSave.trim()),
          updatedAt: routineUpdatedAt,
          ...buildDraftMetrics(structuredToSave),
        })
      })

    // Hydrate last workout data and update structured data with history if needed
    if (user?.id) {
      database.workoutSessions
        .getLastForRoutine(user.id, routine.id)
        .then((lastWorkout) => {
          setLastRoutineWorkout(lastWorkout)

          // If we just applied this from route, we should update the history in the structuredData
          if (source === 'route' && lastWorkout) {
            setStructuredData((current) =>
              current.map((exercise) => {
                const exerciseName = exercise.name
                const lastWorkoutExercise = lastWorkout.workout_exercises?.find(
                  (we) => we.exercise?.name === exerciseName,
                )

                return {
                  ...exercise,
                  sets: exercise.sets.map((set, index) => {
                    const lastSet = lastWorkoutExercise?.sets?.find(
                      (s) => s.set_number === index + 1,
                    )
                    return {
                      ...set,
                      lastWorkoutWeight: lastSet?.weight
                        ? lastSet.weight.toString()
                        : null,
                      lastWorkoutReps: lastSet?.reps
                        ? lastSet.reps.toString()
                        : null,
                    }
                  }),
                }
              }),
            )
          }
        })
        .catch((error) => {
          console.error('[Routine] Error loading last workout:', error)
          setLastRoutineWorkout(null)
        })
    }
  }, [
    pendingDraftRoutineId,
    pendingRoutineSource,
    routines,
    user,
    notes,
    structuredData,
    workoutTimerSerializableState.timerElapsedSeconds,
    workoutTimerSerializableState.timerStartedAt,
    buildDraftMetrics,
    trackEvent,
  ])

  // Track animation state to reset on each focus
  const [slideKey, setSlideKey] = useState(0)
  const [shouldExit, setShouldExit] = useState(false)

  // Use exercise selection hook for navigation-based exercise search
  const { registerCallback } = useExerciseSelection()

  // Use routine selection hook for navigation-based routine selection
  const { registerCallback: registerRoutineCallback } = useRoutineSelection()

  const hydrateDraft = useCallback(async () => {
    isHydratingRef.current = true
    try {
      const [draft, pending] = await Promise.all([
        loadWorkoutDraft(),
        loadPendingWorkout(),
      ])

      const plan = buildHydrationPlan({
        draft,
        pending,
        selectedRoutineId,
        refresh,
        lastRouteRoutineToken: lastRouteRoutineTokenRef.current,
        hasHydrated: hasHydratedRef.current,
        lastLocalEditAt: lastLocalEditAtRef.current,
      })

      if (plan.shouldSkip) {
        logDraftDebug('hydrate-skip', {
          reason: 'local_newer_than_disk',
          draftUpdatedAt: plan.draftUpdatedAt,
          lastLocalEditAt: lastLocalEditAtRef.current,
        })
        const metrics = buildDraftMetrics(structuredDataRef.current)
        trackEvent(AnalyticsEvents.WORKOUT_DRAFT_PERSISTED, {
          action: 'skip',
          source: 'hydrate',
          reason: 'local_newer_than_disk',
          length: notesRef.current.trim().length,
          hasTitle: Boolean(titleRef.current.trim()),
          updatedAt: lastLocalEditAtRef.current,
          ...metrics,
        })
        return
      }

      if (plan.shouldResetToEmpty) {
        logDraftDebug('hydrate-reset-empty-storage', {
          draftUpdatedAt: plan.draftUpdatedAt,
          lastLocalEditAt: lastLocalEditAtRef.current,
        })
        resetLocalWorkoutDraftState()
        return
      }

      if (plan.shouldApplyHydration) {
        suppressLocalEditTrackingRef.current = true
      }

      logDraftDebug('hydrate-plan', {
        shouldApplyHydration: plan.shouldApplyHydration,
        shouldHydrateTimer: plan.shouldHydrateTimer,
        hasNewRouteRoutine: plan.hasNewRouteRoutine,
        shouldResetToEmpty: plan.shouldResetToEmpty,
        effectiveRoutineId: plan.effectiveRoutineId,
        draftUpdatedAt: plan.draftUpdatedAt,
      })

      if (plan.notes !== undefined) {
        setNotes(plan.notes)
      }

      if (plan.title !== undefined) {
        setWorkoutTitle(plan.title)
      }

      if (plan.song !== undefined) {
        setSelectedSong(plan.song)
      }

      if (plan.structuredData) {
        setStructuredData(plan.structuredData)
        if (plan.isStructuredMode !== undefined) {
          setIsStructuredMode(plan.isStructuredMode)
        }
      } else if (plan.isStructuredMode !== undefined) {
        setIsStructuredMode(plan.isStructuredMode)
      }

      if (plan.effectiveRoutineId) {
        setPendingDraftRoutineId(plan.effectiveRoutineId)
        setPendingRoutineSource(plan.routineSource)
      } else {
        setPendingDraftRoutineId(null)
        setPendingRoutineSource(null)
      }

      if (plan.shouldHydrateTimer) {
        hydrateWorkoutTimer(plan.timerStartedAt, plan.timerElapsedSeconds)
      } else {
        resetWorkoutTimer()
      }

      // Skip the next 3 auto-saves to allow all hydration state changes to settle
      skipPersistCountRef.current = 3

      lastDraftSavedAtRef.current = plan.draftUpdatedAt
      lastLocalEditAtRef.current = plan.draftUpdatedAt

      if (plan.hasNewRouteRoutine) {
        lastRouteRoutineTokenRef.current = plan.routeRoutineToken
      }
    } finally {
      isHydratingRef.current = false
      hasHydratedRef.current = true
      logDraftDebug('hydrate-finish', {
        hasHydrated: hasHydratedRef.current,
        isHydrating: isHydratingRef.current,
      })
    }
  }, [
    logDraftDebug,
    buildDraftMetrics,
    hydrateWorkoutTimer,
    resetLocalWorkoutDraftState,
    resetWorkoutTimer,
    refresh,
    selectedRoutineId,
    trackEvent,
  ])

  // Handle screen focus and blur keyboard
  useFocusEffect(
    useCallback(() => {
      setSlideKey((prev) => prev + 1)
      setShouldExit(false)
      isScreenFocusedRef.current = true
      setWarmupCalculatorEnabled(getWarmupCalculatorEnabled())
      setToolbarVisibleButtons(getToolbarButtons())

      haptic('light')

      blurInputs()

      // Reload draft when screen is focused (handles case where draft was saved after failure)
      hydrateDraft()

      trackEvent(AnalyticsEvents.WORKOUT_CREATE_STARTED, {
        mode: 'text',
        hasDraft: Boolean(notesRef.current.trim()),
        hasTitle: Boolean(titleRef.current.trim()),
      })

      const timeoutId = setTimeout(() => {
        blurInputs()
      }, 0)

      const interactionHandle = runAfterInteractions(() => {
        blurInputs()
      })

      const loadWorkoutCount = async () => {
        try {
          if (user?.id) {
            const workouts = await database.workoutSessions.getRecent(
              user.id,
              1,
            )
            setUserWorkoutCount(workouts.length)
          }
        } catch (error) {
          console.error('Error loading workout count:', error)
        }
      }
      loadWorkoutCount()

      loadRoutinesAndExercises()

      return () => {
        clearTimeout(timeoutId)
        if (interactionHandle) {
          interactionHandle.cancel?.()
        }
        persistDraft('blur')
        isScreenFocusedRef.current = false
      }
    }, [
      blurInputs,
      trackEvent,
      user,
      loadRoutinesAndExercises,
      hydrateDraft,
      persistDraft,
    ]),
  )

  // Blur inputs when component unmounts
  useEffect(() => {
    return () => {
      blurInputs()
      if (isScreenFocusedRef.current) {
        persistDraft('unmount')
      } else {
        logDraftDebug('persist-skipped-unmount-not-focused')
      }
    }
  }, [blurInputs, logDraftDebug, persistDraft])

  // Load saved draft on mount or when refresh param changes
  useEffect(() => {
    if (!isScreenFocusedRef.current) {
      return
    }
    hydrateDraft()
  }, [hydrateDraft, refresh])

  // Auto-save draft whenever inputs change
  useEffect(() => {
    if (!isScreenFocusedRef.current) {
      logDraftDebug('autosave-skipped', {
        reason: 'not-focused',
      })
      return
    }

    if (isHydratingRef.current) {
      return
    }

    if (skipPersistCountRef.current > 0) {
      logDraftDebug('autosave-skipped', {
        reason: 'skip-persist-counter',
        remaining: skipPersistCountRef.current,
      })
      skipPersistCountRef.current--
      return
    }

    // Use selectedRoutine.id if available, fall back to pendingDraftRoutineId
    // This ensures we persist the routine ID even while waiting for routines to load
    const routineIdToSave = selectedRoutine?.id ?? pendingDraftRoutineId ?? null

    const timeoutId = setTimeout(() => {
      const updatedAt = Math.max(Date.now(), lastLocalEditAtRef.current)
      lastDraftSavedAtRef.current = updatedAt
      logDraftDebug('autosave-start', {
        updatedAt,
        notesLength: notes.trim().length,
        hasTitle: Boolean(workoutTitle.trim()),
        structuredCount: structuredData.length,
        hasRoutine: Boolean(routineIdToSave),
        timerStartedAt: workoutTimerSerializableState.timerStartedAt,
        timerElapsedSeconds: workoutTimerSerializableState.timerElapsedSeconds,
      })
      void saveWorkoutDraftPatch({
        notes,
        title: workoutTitle,
        song: selectedSong,
        structuredData,
        isStructuredMode,
        selectedRoutineId: routineIdToSave,
        timerStartedAt: workoutTimerSerializableState.timerStartedAt,
        timerElapsedSeconds: workoutTimerSerializableState.timerElapsedSeconds,
        updatedAt,
      })
        .then(() => {
          logDraftDebug('autosave-success', {
            updatedAt,
          })
          const metrics = buildDraftMetrics(structuredData)
          trackEvent(AnalyticsEvents.WORKOUT_DRAFT_PERSISTED, {
            action: 'patch',
            source: 'autosave',
            length: notes.trim().length,
            hasTitle: Boolean(workoutTitle.trim()),
            updatedAt,
            ...metrics,
          })
        })
        .catch((error) => {
          if (DEBUG_LOGS) console.error('[Draft] Save failed:', error)
          logDraftDebug('autosave-failed', {
            error: error instanceof Error ? error.message : String(error),
          })
          trackEvent(AnalyticsEvents.WORKOUT_DRAFT_PERSISTED, {
            action: 'fail',
            source: 'autosave',
            reason: 'save_patch_failed',
            error: error instanceof Error ? error.message : String(error),
            length: notes.trim().length,
            hasTitle: Boolean(workoutTitle.trim()),
            updatedAt,
            ...buildDraftMetrics(structuredData),
          })
        })
    }, 2000)

    return () => clearTimeout(timeoutId)
  }, [
    logDraftDebug,
    notes,
    workoutTitle,
    selectedSong,
    structuredData,
    isStructuredMode,
    selectedRoutine?.id,
    pendingDraftRoutineId,
    workoutTimerSerializableState.timerElapsedSeconds,
    workoutTimerSerializableState.timerStartedAt,
    buildDraftMetrics,
    trackEvent,
  ])

  // Persist draft immediately when app backgrounds (timers may be paused)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      logDraftDebug('appstate-change', {
        state,
        isHydrating: isHydratingRef.current,
        isFocused: isScreenFocusedRef.current,
      })
      if (state === 'active' || isHydratingRef.current) {
        return
      }

      if (!isScreenFocusedRef.current) {
        logDraftDebug('persist-skipped-background-not-focused')
        return
      }

      persistDraft('background')
    })

    return () => {
      subscription.remove()
    }
  }, [logDraftDebug, persistDraft])

  const handleCancel = async () => {
    if (isRecording) {
      await stopRecording()
    }

    blurInputs()
    setShouldExit(true)
  }

  const handleExitComplete = useCallback(() => {
    router.back()
  }, [])

  const handleDiscardWorkout = useCallback(() => {
    haptic('medium')
    blurInputs()

    Alert.alert(
      'Discard Workout',
      'Are you sure you want to discard this workout? All progress will be lost.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            await clearWorkoutDraft('create-post-discard-button')
            resetLocalWorkoutDraftState()

            haptic('light')
          },
        },
      ],
    )
  }, [blurInputs, resetLocalWorkoutDraftState])

  const handleRemoveAttachedImage = async () => {
    haptic('light')
    imageOpacity.setValue(0)
    setAttachedImageUri(null)
  }

  const handleToggleRecording = useCallback(async () => {
    haptic('medium')
    await toggleRecording()
  }, [toggleRecording])

  const handleScanWorkoutPress = useCallback(() => {
    haptic('medium')
    blurInputs()

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: 'Scan Workout',
          options: ['Take Photo', 'Choose from Library', 'Cancel'],
          cancelButtonIndex: 2,
        },
        (buttonIndex) => {
          if (buttonIndex === 0) {
            handleScanWithCamera()
          } else if (buttonIndex === 1) {
            handleScanWithLibrary()
          }
        },
      )
      return
    }

    Alert.alert('Scan Workout', 'Choose an option', [
      {
        text: 'Take Photo',
        onPress: handleScanWithCamera,
      },
      {
        text: 'Choose from Library',
        onPress: handleScanWithLibrary,
      },
      {
        text: 'Cancel',
        style: 'cancel',
      },
    ])
  }, [blurInputs, handleScanWithCamera, handleScanWithLibrary])

  const performSubmission = useCallback(
    async (
      notesValue: string,
      titleValue: string,
      imageUriValue: string | null,
      routineIdValue: string | null,
      descriptionValue?: string,
      parserNotesValue?: string,
      dateValue?: Date,
    ) => {
      if (!user) {
        throw new Error('User must be authenticated to submit workouts')
      }

      const trimmedNotes = notesValue.trim()
      const trimmedTitle = titleValue.trim()
      // Cap duration at 4 hours to prevent absurdly long durations from forgotten timers
      const MAX_WORKOUT_DURATION_SECONDS = 4 * 60 * 60 // 4 hours
      const durationSeconds = Math.min(
        Math.max(0, getWorkoutElapsedSeconds()),
        MAX_WORKOUT_DURATION_SECONDS,
      )

      await queueWorkout({
        notes: trimmedNotes,
        title: trimmedTitle,
        imageUri: imageUriValue,
        routineId: routineIdValue,
        durationSeconds,
        description: descriptionValue?.trim() || undefined,
        parserNotes: parserNotesValue,
        song: selectedSong,
        structuredData: isStructuredMode ? structuredData : undefined,
        isStructuredMode,
        date: dateValue,
      })

      // Refresh freemium limits after successful submission
      refreshFreemiumLimits()

      // Complete tutorial step for logging first workout
      completeStep('log_workout')

      trackEvent(AnalyticsEvents.WORKOUT_SAVED_TO_PENDING, {
        hasTitle: Boolean(trimmedTitle),
        length: trimmedNotes.length,
      })

      let message = 'Well done on completing another workout!'
      let workoutNumber = 1
      let weeklyTarget = 2
      let currentStreak = 0
      let previousStreak = 0

      try {
        const now = new Date()
        const startOfWeek = new Date(now)
        startOfWeek.setDate(now.getDate() - now.getDay())
        startOfWeek.setHours(0, 0, 0, 0)

        // Fetch profile and week count in parallel (no dependency between them)
        const [profile, workoutsThisWeek] = await Promise.all([
          database.profiles.getById(user.id),
          database.workoutSessions.getThisWeekCount(user.id, startOfWeek),
        ])

        workoutNumber = workoutsThisWeek + 1
        weeklyTarget = parseCommitment(
          profile.commitment,
          profile.commitment_frequency,
        )

        // Both streak calculations can also run in parallel
        const [previousStreakResult, currentStreakResult] = await Promise.all([
          database.stats.calculateStreak(
            user.id,
            weeklyTarget,
            false, // Don't include current week - this is the streak before submission
          ),
          database.stats.calculateStreak(
            user.id,
            weeklyTarget,
            true, // Include current week since workout is being submitted
          ),
        ])

        previousStreak = previousStreakResult.currentStreak ?? 0
        currentStreak = currentStreakResult.currentStreak ?? 0

        message = generateWorkoutMessage({
          workoutNumber,
          weeklyTarget,
        })
      } catch (error) {
        console.error('Error generating workout message:', error)
      }

      hapticSuccess()

      await clearWorkoutDraft('create-post-submit-success')
      clearExerciseHistoryCache() // Clear cache so new workout data is available next time
      resetLocalWorkoutDraftState()
      blurInputs()

      setPendingStreakData({
        message,
        workoutNumber,
        weeklyTarget,
        currentStreak,
        previousStreak,
        workoutTitle: trimmedTitle || undefined,
      })
      navigation.dispatch(TabActions.jumpTo('index'))
      runAfterInteractions(() => {
        requestAnimationFrame(() => {
          scrollToTop('index')
        })
      })

      // NOTE: Rating prompt is now triggered from index.tsx handlePendingPost
      // to avoid duplicate triggers causing modal overlap and iOS freeze
    },
    [
      user,
      queueWorkout,
      trackEvent,
      blurInputs,
      setPendingStreakData,
      refreshFreemiumLimits,
      getWorkoutElapsedSeconds,
      resetLocalWorkoutDraftState,
      completeStep,
      isStructuredMode,
      structuredData,
      selectedSong,
      scrollToTop,
      navigation,
    ],
  )

  const submitWorkout = async (caption?: string) => {
    // Check if user can post workout (freemium limit)
    if (!canPostWorkout) {
      // Reset loading state before showing paywall
      isSubmittingRef.current = false
      setIsLoading(false)
      setShowPaywall(true)
      trackEvent(AnalyticsEvents.PAYWALL_SHOWN, {
        feature: 'workout_logging',
        source_screen: 'create_post',
        subscription_status: isProMember ? 'active' : 'none',
      })
      return
    }

    // Combine structured data with free-form notes
    let workoutNotes = notes
    let parserNotes = notes
    // We no longer prepend caption to notes, as it's handled separately

    if (isStructuredMode && structuredData.length > 0) {
      const structuredText = convertStructuredDataToText(structuredData)
      // Add structured workout first, then notes
      workoutNotes = structuredText + (notes.trim() ? '\n\n' + notes : '')
      // Only parse the user's actual free-form notes, not the synthetic
      // structured text we generate for raw storage/debugging.
      parserNotes = notes
    }

    try {
      await performSubmission(
        workoutNotes,
        workoutTitle,
        attachedImageUri,
        selectedRoutine?.id ?? null,
        caption, // Pass caption as description
        parserNotes,
        finalizeDate,
      )
      // Success - reset loading state
      isSubmittingRef.current = false
      setIsLoading(false)
    } catch (error) {
      if (
        error instanceof SubmitWorkoutError &&
        error.code === 'IMAGE_UPLOAD'
      ) {
        // IMAGE_UPLOAD error - show Alert and let user decide
        // Don't reset loading state here - Alert handlers will do it
        console.error('Error uploading image:', error.originalError ?? error)
        Alert.alert(
          'Image Upload Failed',
          'Unable to upload your workout photo. Would you like to continue without it?',
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => {
                isSubmittingRef.current = false
                setIsLoading(false)
              },
            },
            {
              text: 'Continue',
              onPress: async () => {
                setAttachedImageUri(null)
                try {
                  await performSubmission(
                    workoutNotes,
                    workoutTitle,
                    null,
                    selectedRoutine?.id ?? null,
                    caption,
                    parserNotes,
                  )
                } catch (retryError) {
                  console.error('Error saving pending post:', retryError)
                  Alert.alert(
                    'Save Failed',
                    'Unable to save your workout. Please try again.',
                    [{ text: 'OK' }],
                  )
                } finally {
                  isSubmittingRef.current = false
                  setIsLoading(false)
                }
              },
            },
          ],
        )
        return
      }

      // Generic error - reset loading state
      console.error('Error saving pending post:', error)
      isSubmittingRef.current = false
      setIsLoading(false)
      Alert.alert(
        'Save Failed',
        'Unable to save your workout. Please try again.',
        [{ text: 'OK' }],
      )
    }
  }

  // =============================================================================
  // ROUTINE MANAGEMENT HANDLERS
  // =============================================================================
  // Routine State Lifecycle:
  // 1. User opens routine selector → showRoutineSelector = true
  // 2. User selects a routine → selectedRoutine set, lastRoutineWorkout fetched,
  //    isStructuredMode enabled, structuredData cleared
  // 3. User fills in workout data → structuredData populated via StructuredWorkoutInput
  // 4. User can clear routine → selectedRoutine/lastRoutineWorkout cleared,
  //    optionally keep structuredData if user has entered data
  // 5. On submission → all routine state cleared
  // 6. On cancel → all routine state cleared
  // 7. On routine deletion → if selected, all routine state cleared
  // =============================================================================

  const handleSelectRoutine = useCallback(
    async (routine: WorkoutRoutineWithDetails) => {
      // Clear any existing routine data first to prevent stale state
      setLastRoutineWorkout(null)
      setStructuredData([])

      // Query for last workout FIRST before setting state
      let lastWorkout: WorkoutSessionWithDetails | null = null
      if (user?.id) {
        try {
          lastWorkout = await database.workoutSessions.getLastForRoutine(
            user.id,
            routine.id,
          )
        } catch (error) {
          console.error(
            '[handleSelectRoutine] Error loading last workout for routine:',
            error,
          )
          lastWorkout = null
        }
      }

      // Set all states together so component renders with lastWorkout data
      setSelectedRoutine(routine)
      setWorkoutTitle(routine.name)
      setIsStructuredMode(true)
      setLastRoutineWorkout(lastWorkout)

      trackEvent(AnalyticsEvents.WORKOUT_CREATE_STARTED, {
        mode: 'routine_template',
        routineId: routine.id,
      })
    },
    [user, trackEvent],
  )

  const handleOpenRoutineSelector = useCallback(async () => {
    haptic('light')
    blurInputs()

    // Register callback for routine selection
    registerRoutineCallback((routine: WorkoutRoutineWithDetails) => {
      handleSelectRoutine(routine)
    })

    // Navigate to the full-screen routine selector
    router.push('/routines')
  }, [blurInputs, registerRoutineCallback, handleSelectRoutine])

  const handlePost = async () => {
    // Prevent double-tap race condition using synchronous ref check
    if (isSubmittingRef.current) {
      return
    }
    isSubmittingRef.current = true

    // Submit tapped: workout is ending, so stop any active rest timer immediately.
    restTimer.stop()

    // Immediate haptic feedback for responsive feel
    haptic('medium')

    // Immediate button animation
    Animated.sequence([
      Animated.timing(buttonScaleAnim, {
        toValue: 0.92,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(buttonScaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 5,
        useNativeDriver: true,
      }),
    ]).start()

    // Prevent multiple submissions by disabling button immediately
    setIsLoading(true)

    // Dismiss keyboard
    blurInputs()

    // Check freemium workout limit
    if (!canPostWorkout) {
      isSubmittingRef.current = false
      setIsLoading(false)
      setShowPaywall(true)
      trackEvent(AnalyticsEvents.PAYWALL_SHOWN, {
        feature: 'workout_logging',
        source_screen: 'create_post',
        subscription_status: isProMember ? 'active' : 'none',
      })
      return
    }

    if (!workoutTitle.trim()) {
      const hour = new Date().getHours()
      const autoTitle =
        hour < 12
          ? 'Morning Session'
          : hour < 15
          ? 'Afternoon Session'
          : 'Evening Session'
      setWorkoutTitle(autoTitle)
    }

    // Check if there's workout data (either notes or structured data)
    const hasStructuredData =
      isStructuredMode &&
      structuredData.length > 0 &&
      structuredData.some((exercise) =>
        exercise.sets.some((set) => set.weight || set.reps),
      )

    if (!notes.trim() && !hasStructuredData) {
      isSubmittingRef.current = false
      setIsLoading(false)
      Alert.alert(
        'Workout Details Missing',
        'Add your exercises, sets, and reps to track your progress.',
        [{ text: 'OK' }],
      )
      return
    }

    if (!user) {
      isSubmittingRef.current = false
      setIsLoading(false)
      Alert.alert('Not Logged In', 'Sign in to save and track your workouts.', [
        { text: 'OK' },
      ])
      return
    }

    // Reset loading state since we're navigating away
    isSubmittingRef.current = false
    setIsLoading(false)

    // Stop the workout timer before showing the finalize overlay
    pauseWorkoutTimer()

    // Force draft persistence so the finalize screen can read it
    persistDraft('blur')

    router.push({
      pathname: '/(stand-alone)/finalize-workout',
      params: {
        durationDisplay: draftStats.durationDisplay,
        volumeValue: draftStats.volumeDisplay.value.toString(),
        volumeUnit: draftStats.volumeDisplay.unit,
        setsCount: draftStats.setsCount.toString(),
        durationSeconds: workoutElapsedSeconds.toString(),
      },
    })

    trackEvent(AnalyticsEvents.WORKOUT_CREATE_SUBMITTED, {
      hasTitle: Boolean(workoutTitle.trim()),
      length: notes.trim().length,
    })
  }

  // Convert structured workout data to text format
  const convertStructuredDataToText = useCallback(
    (data: StructuredExerciseDraft[], unitDisplay: string = 'kg'): string => {
      if (!data || data.length === 0) return ''

      return data
        .map((exercise) => {
          const lines = [exercise.name]

          exercise.sets.forEach((set, index) => {
            if (set.weight || set.reps) {
              const weightText = set.weight || '___'
              const repsText = set.reps || '___'

              lines.push(
                `Set ${
                  index + 1
                }: ${weightText} ${unitDisplay} x ${repsText} reps`,
              )
            }
          })

          return lines.join('\n')
        })
        .join('\n\n')
    },
    [],
  )

  // Parse text around cursor to extract exercise name and sets
  const parseExerciseFromText = useCallback(
    (text: string, cursorPos: number) => {
      const lines = text.split('\n')
      const textBeforeCursor = text.substring(0, cursorPos)
      const linesBefore = textBeforeCursor.split('\n')
      const currentLineIndex = linesBefore.length - 1

      // Get exercise name (current line or previous line if current is empty)
      let exerciseName = lines[currentLineIndex]?.trim() || ''
      let startIndex = currentLineIndex

      // If current line is empty, look at previous line
      if (!exerciseName && currentLineIndex > 0) {
        exerciseName = lines[currentLineIndex - 1]?.trim() || ''
        startIndex = currentLineIndex - 1
      }

      if (!exerciseName) return null

      // Extract sets from following lines (until empty line or end)
      const sets: { weight?: string; reps?: string }[] = []
      for (let i = startIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) break // Stop at empty line

        // Try to parse set: "weight x reps" or "weight x reps reps" or "135 x 8"
        // Note: Weight pattern accepts both period and comma as decimal separators (e.g., "7.5" or "7,5")
        const setMatch = line.match(/(\d+(?:[.,]\d+)?)\s*(?:x|×)\s*(\d+)/i)

        if (setMatch) {
          // Normalize decimal separator: replace comma with period (for European locales)
          const rawWeight = setMatch[1]
          const weight = rawWeight.replace(',', '.')

          sets.push({
            weight,
            reps: setMatch[2],
          })
        } else {
          // If line doesn't match set pattern, stop
          break
        }
      }

      return {
        exerciseName,
        sets: sets.length > 0 ? sets : [{ weight: '', reps: '' }], // At least one empty set
        startLineIndex: startIndex,
        endLineIndex: startIndex + sets.length,
      }
    },
    [],
  )

  // Handle cursor position changes
  const handleNotesSelectionChange = useCallback(
    (event: { nativeEvent: { selection: { start: number; end: number } } }) => {
      const cursorPos = event.nativeEvent.selection.start
      setCursorPosition(cursorPos)

      if (isNotesFocused && nativeKeyboardHeightRef.current > 0) {
        requestAnimationFrame(() => {
          ensureNotesCursorVisible()
        })
      }
    },
    [ensureNotesCursorVisible, isNotesFocused],
  )

  // Handle content size changes to keep the cursor above the keyboard.
  const handleContentSizeChange = useCallback(
    (_event: {
      nativeEvent: { contentSize: { width: number; height: number } }
    }) => {
      if (isNotesFocused && nativeKeyboardHeightRef.current > 0) {
        requestAnimationFrame(() => {
          ensureNotesCursorVisible()
        })
      }
    },
    [ensureNotesCursorVisible, isNotesFocused],
  )

  // =============================================================================
  // AUTOCOMPLETE STATE
  // =============================================================================
  const exerciseAutocomplete = useExerciseAutocompleteGroup({
    text: notes,
    cursorPosition,
    exercises: allExercises,
    isInputFocused: isNotesFocused,
  })

  const currentSuggestion = exerciseAutocomplete?.primary ?? null

  const variationSuggestions = useMemo(() => {
    const variations = exerciseAutocomplete?.variations ?? []
    if (variations.length < 2) return []
    return variations.slice(0, 4)
  }, [exerciseAutocomplete])

  const hasTrailingText = useMemo(() => {
    const textAfter = notes.substring(cursorPosition)
    const nextNewline = textAfter.indexOf('\n')
    const currentLineSuffix =
      nextNewline === -1 ? textAfter : textAfter.substring(0, nextNewline)
    return currentLineSuffix.trim().length > 0
  }, [notes, cursorPosition])

  const showInlineVariations =
    isNotesFocused && variationSuggestions.length > 0 && !hasTrailingText

  const clearEmptyExercisePrompt = useCallback(() => {
    if (emptyExercisePromptTimeoutRef.current) {
      clearTimeout(emptyExercisePromptTimeoutRef.current)
      emptyExercisePromptTimeoutRef.current = null
    }
    setShowEmptyExercisePrompt(false)
  }, [])

  const showEmptyExerciseFeedback = useCallback(() => {
    haptic('light')
    notesInputRef.current?.focus()
    setShowEmptyExercisePrompt(true)

    if (emptyExercisePromptTimeoutRef.current) {
      clearTimeout(emptyExercisePromptTimeoutRef.current)
    }

    emptyExercisePromptTimeoutRef.current = setTimeout(() => {
      setShowEmptyExercisePrompt(false)
      emptyExercisePromptTimeoutRef.current = null
    }, 1600)
  }, [])

  const stackedVariationSuggestions = useMemo(() => {
    if (!showInlineVariations) return []
    const primaryName = currentSuggestion?.name ?? null
    return variationSuggestions.filter(
      (suggestion) => suggestion.name !== primaryName,
    )
  }, [showInlineVariations, variationSuggestions, currentSuggestion])

  const acceptSuggestionByName = useCallback(
    async (exerciseName: string) => {
      try {
        hapticSuccess()

        // 1. Create structured workout entry with history data
        const newExercise = await createExerciseWithHistory(exerciseName)

        setStructuredData((prev) => [...prev, newExercise])
        setIsStructuredMode(true)

        // 2. Remove the text that triggered the suggestion from the notes
        // Find current line start/end
        const textBeforeCursor = notes.substring(0, cursorPosition)
        const lastNewlineIndex = textBeforeCursor.lastIndexOf('\n')
        const startOfLine = lastNewlineIndex + 1

        // We simply remove the line where the user was typing
        const newText =
          notes.substring(0, startOfLine) + notes.substring(cursorPosition)

        setNotes(newText)
        return true
      } catch (error) {
        console.error(
          '[acceptSuggestionByName] Error accepting suggestion:',
          error,
        )
        return false
      }
    },
    [notes, cursorPosition, createExerciseWithHistory],
  )

  const handleAcceptSuggestion = useCallback(() => {
    if (!currentSuggestion) return
    void acceptSuggestionByName(currentSuggestion.name)
  }, [currentSuggestion, acceptSuggestionByName])

  const handleToolbarAddExercise = useCallback(() => {
    const parsed = parseExerciseFromText(notes, cursorPosition)
    if (!parsed) {
      showEmptyExerciseFeedback()
      return
    }

    clearEmptyExercisePrompt()
    void handleConvertToStructured()
  }, [
    clearEmptyExercisePrompt,
    cursorPosition,
    handleConvertToStructured,
    notes,
    parseExerciseFromText,
    showEmptyExerciseFeedback,
  ])

  // Handle text change
  const handleNotesChange = useCallback(
    async (text: string) => {
      if (showEmptyExercisePrompt && text.trim().length > 0) {
        clearEmptyExercisePrompt()
      }

      // Check for Enter key press (newline addition) when a suggestion is active
      const isNewlineAdded =
        text.length > notes.length &&
        text.slice(cursorPosition, cursorPosition + 1) === '\n'

      if (isNewlineAdded) {
        const suggestion = getExerciseSuggestion(
          notes,
          cursorPosition,
          allExercises,
        )
        if (suggestion) {
          const accepted = await acceptSuggestionByName(suggestion.name)
          if (!accepted) {
            // Fallback: just set the text with the newline
            setNotes(text)
          }
          return
        }
      }

      setNotes(text)
    },
    [
      showEmptyExercisePrompt,
      clearEmptyExercisePrompt,
      notes,
      cursorPosition,
      allExercises,
      acceptSuggestionByName,
    ],
  )

  // Convert text to structured format
  const handleConvertToStructured = useCallback(async () => {
    haptic('light')

    const parsed = parseExerciseFromText(notes, cursorPosition)
    if (!parsed) return

    const { exerciseName, sets, startLineIndex, endLineIndex } = parsed
    const resolution = resolveStructuredExercise(exerciseName, allExercises)
    const resolvedExerciseName = resolution.resolvedName ?? exerciseName

    // Create exercise with history data, using the number of sets parsed from text
    const baseExercise = await createExerciseWithHistory(
      resolvedExerciseName,
      sets.length,
    )

    // Merge with user-typed data (preserve any values they already entered)
    const mergedExercise: StructuredExerciseDraft = {
      ...baseExercise,
      name: resolvedExerciseName,
      sets: baseExercise.sets.map((set, index) => {
        const typedSet = sets[index]
        return {
          ...set,
          weight: typedSet?.weight || set.weight,
          reps: typedSet?.reps || set.reps,
        }
      }),
    }

    // Add to structured data FIRST, then enable structured mode
    // This ensures the component renders with the exercise already in structuredData
    setStructuredData((prev) => {
      return [...prev, mergedExercise]
    })

    // Enable structured mode AFTER adding exercise to ensure component renders with data
    if (!isStructuredMode) {
      setIsStructuredMode(true)
    }

    // Remove the converted text from notes
    const lines = notes.split('\n')
    const newLines = [
      ...lines.slice(0, startLineIndex),
      ...lines.slice(endLineIndex + 1),
    ]
    const newNotes = newLines.join('\n')
    setNotes(newNotes)
    // showConvertButton will automatically update via useMemo
  }, [
    notes,
    cursorPosition,
    allExercises,
    parseExerciseFromText,
    isStructuredMode,
    createExerciseWithHistory,
  ])

  const handleMultiSelectExercises = useCallback(
    async (exercises: Exercise[]) => {
      // Create new structured exercises with history data (in parallel)
      const newExercises = await Promise.all(
        exercises.map((exercise) => createExerciseWithHistory(exercise.name)),
      )

      setStructuredData((prev) => [...prev, ...newExercises])
      setIsStructuredMode(true)
    },
    [createExerciseWithHistory],
  )

  const handleChooseExercisePress = useCallback(() => {
    // Register callback for exercise selection
    registerCallback((selectedExercises: Exercise | Exercise[]) => {
      const exercises = Array.isArray(selectedExercises)
        ? selectedExercises
        : [selectedExercises]
      handleMultiSelectExercises(exercises)
    })

    // Navigate to the full-screen exercise selector
    router.push('/select-exercise')
  }, [registerCallback, handleMultiSelectExercises])

  // Handler for adding exercise from AI coach suggestions
  const handleAddExerciseFromCoach = useCallback(
    async (exercise: { name: string; sets: number; reps: string }) => {
      const { targetRepsMin, targetRepsMax } = parseRepRange(exercise.reps)

      // Create exercise with history data
      const newExercise = await createExerciseWithHistory(
        exercise.name,
        exercise.sets,
        targetRepsMin,
        targetRepsMax,
      )

      setStructuredData((prev) => [...prev, newExercise])
      setIsStructuredMode(true)
    },
    [createExerciseWithHistory],
  )

  // Handler for replacing exercise from AI coach suggestions
  const handleReplaceExerciseFromCoach = useCallback(
    async (
      oldExerciseName: string,
      newExercise: { name: string; sets: number; reps: string },
    ) => {
      const { targetRepsMin, targetRepsMax } = parseRepRange(newExercise.reps)

      // First check if the exercise exists
      const existingIndex = structuredData.findIndex(
        (ex) => ex.name.toLowerCase() === oldExerciseName.toLowerCase(),
      )

      if (existingIndex === -1) {
        // If not found, add as a new exercise with history
        const newExerciseData = await createExerciseWithHistory(
          newExercise.name,
          newExercise.sets,
          targetRepsMin,
          targetRepsMax,
        )
        setStructuredData((prev) => [...prev, newExerciseData])
        return
      }

      // Exercise exists - fetch history for the new exercise to fill any extra sets
      const newHistory = await createExerciseWithHistory(
        newExercise.name,
        newExercise.sets,
        targetRepsMin,
        targetRepsMax,
      )

      setStructuredData((prev) => {
        const oldExercise = prev[existingIndex]
        const setCount = Math.max(newExercise.sets, oldExercise.sets.length)

        // Preserve existing set data where available, use history for new sets
        const sets = Array.from({ length: setCount }, (_, i) => {
          if (i < oldExercise.sets.length) {
            // Keep the user's existing data but update target reps
            return { ...oldExercise.sets[i], targetRepsMin, targetRepsMax }
          }
          // Use history data for new sets
          return (
            newHistory.sets[i] || createEmptySet(targetRepsMin, targetRepsMax)
          )
        })

        const updated = [...prev]
        updated[existingIndex] = {
          id: oldExercise.id,
          name: newExercise.name,
          sets,
        }
        return updated
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- createEmptySet is stable
    [createExerciseWithHistory, structuredData],
  )

  // Track previous structured data length to detect deletions
  const previousStructuredDataLength = useRef(0)

  // Check if all structured exercises have been deleted and clear routine if so
  useEffect(() => {
    const currentLength = structuredData.length
    const previousLength = previousStructuredDataLength.current

    // If we had exercises and now have zero (user deleted all)
    if (selectedRoutine && previousLength > 0 && currentLength === 0) {
      // All exercises deleted - clear routine state
      setSelectedRoutine(null)
      setLastRoutineWorkout(null)
      setIsStructuredMode(false)
      setPendingDraftRoutineId(null)
      setPendingRoutineSource(null)
    }

    // Update previous length
    previousStructuredDataLength.current = currentLength
  }, [structuredData, selectedRoutine])

  const editorToolbarProps = useMemo(
    () => ({
      onScanWorkout: handleScanWorkoutPress,
      onMicPress: handleToggleRecording,
      onStopwatchPress: () => {
        haptic('light')
        blurInputs()
        setShowRestTimer(true)
      },
      onRoutinePress: handleOpenRoutineSelector,
      onSearchExercise: handleChooseExercisePress,
      onAddExercise: handleToolbarAddExercise,
      isRecording,
      isTranscribing,
      isProcessingImage,
      isLoading,
      showAddExercise:
        isIOS || showConvertButton || pageTutorialToolbarMode === 'force-add',
      isRestTimerActive: restTimer.isActive,
      restTimerRemaining: restTimer.remainingSeconds,
      bottomInsetOverride: bottomSafeInset,
      visibleButtons: toolbarVisibleButtons,
      timerButtonRef: toolbarTimerRef,
      routineButtonRef: toolbarRoutineRef,
      searchButtonRef: toolbarSearchRef,
      addButtonRef: toolbarAddRef,
    }),
    [
      handleScanWorkoutPress,
      handleToggleRecording,
      blurInputs,
      handleOpenRoutineSelector,
      handleChooseExercisePress,
      handleToolbarAddExercise,
      isRecording,
      isTranscribing,
      isProcessingImage,
      isLoading,
      toolbarVisibleButtons,
      isIOS,
      showConvertButton,
      pageTutorialToolbarMode,
      restTimer.isActive,
      restTimer.remainingSeconds,
      bottomSafeInset,
    ],
  )

  useEffect(() => {
    return () => {
      if (emptyExercisePromptTimeoutRef.current) {
        clearTimeout(emptyExercisePromptTimeoutRef.current)
      }
    }
  }, [])

  // Keyboard handling with Reanimated for perfect sync
  const keyboard = useAnimatedKeyboard()

  // Custom keypad spacer — lifts the toolbar in sync with the keypad slide animation
  const customKeypadSpacerH = useSharedValue(0)
  useEffect(() => {
    if (keypadProps) {
      if (customSpacerReleaseTimeoutRef.current) {
        clearTimeout(customSpacerReleaseTimeoutRef.current)
        customSpacerReleaseTimeoutRef.current = null
      }
      customKeypadSpacerH.value = withSpring(CUSTOM_KEYPAD_HEIGHT, {
        damping: 28,
        stiffness: 280,
        mass: 0.85,
      })
    } else {
      const runCloseAnimation = () => {
        customKeypadSpacerH.value = withTiming(0, {
          duration: 220,
          easing: ReanimatedEasing.in(ReanimatedEasing.quad),
        })
      }

      // Smooth custom->native keyboard handoff: keep custom lift briefly so we
      // don't drop before the native keyboard lift starts.
      if (isToolbarInsetLocked) {
        if (customSpacerReleaseTimeoutRef.current) {
          clearTimeout(customSpacerReleaseTimeoutRef.current)
        }
        customSpacerReleaseTimeoutRef.current = setTimeout(() => {
          customSpacerReleaseTimeoutRef.current = null
          runCloseAnimation()
        }, 120)
      } else {
        if (customSpacerReleaseTimeoutRef.current) {
          clearTimeout(customSpacerReleaseTimeoutRef.current)
          customSpacerReleaseTimeoutRef.current = null
        }
        runCloseAnimation()
      }
    }
  }, [keypadProps, isToolbarInsetLocked, CUSTOM_KEYPAD_HEIGHT, customKeypadSpacerH])
  const combinedSpacerStyle = useAnimatedStyle(() => ({
    height: Math.max(customKeypadSpacerH.value, keyboard.height.value),
  }))

  const chatIconAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: chatButtonPulse.value }],
  }))

  const chatGlowRingStyle = useAnimatedStyle(() => ({
    opacity: chatButtonRingOpacity.value,
    transform: [{ scale: chatButtonRingScale.value }],
  }))

  const chatHandWaveStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${chatHandWave.value}deg` },
    ],
  }))
  const isToolbarVisible =
    toolbarVisibleButtons.length > 0 &&
    (!isStructuredInputFocused || Boolean(keypadProps))
  const toolbarBottomInsetOverride =
    keypadProps || isToolbarInsetLocked ? 0 : bottomSafeInset

  return (
    <>
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <SlideUpView
        key={slideKey}
        style={{ flex: 1 }}
        backgroundColor={colors.bg}
        fade={false}
        duration={200}
        tension={65}
        friction={14}
        shouldExit={shouldExit}
        onExitComplete={handleExitComplete}
      >
        <Pressable style={styles.header} onPress={blurInputs}>
          <View style={styles.headerLeftButtons}>
            <LiquidGlassSurface
              style={styles.headerIconShell}
              debugLabel="create-post-close-button"
            >
            <TouchableOpacity
              onPress={handleCancel}
                style={styles.headerButton}
                disabled={isLoading}
              >
                <Ionicons
                  name="chevron-down"
                  size={24}
                  color={colors.textPrimary}
                  style={styles.headerBackChevron}
                />
              </TouchableOpacity>
            </LiquidGlassSurface>
          </View>

          <View style={styles.headerRightButtons}>
            <TouchableOpacity
              style={styles.headerButton}
              activeOpacity={0.7}
              onPress={() => router.push('/create-post-settings')}
              disabled={isLoading}
            >
              <Ionicons
                name="settings-outline"
                size={22}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
            {shouldShowWorkoutTimer && (
              <TouchableOpacity
                onPress={handleDiscardWorkout}
                style={styles.discardButton}
                disabled={isLoading}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={22} color="#E53935" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={handlePost}
              style={[styles.headerButton, styles.submitButtonFilled]}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <Animated.View
                style={{
                  transform: [{ scale: buttonScaleAnim }],
                }}
              >
                <Ionicons name="checkmark" size={24} color="#FFFFFF" />
              </Animated.View>
            </TouchableOpacity>
          </View>
        </Pressable>

        <View style={styles.keyboardView} onLayout={handleKeyboardViewLayout}>
          <ScrollView
            ref={scrollViewRef}
            style={styles.inputContainer}
            contentContainerStyle={[
              styles.scrollContent,
              keypadProps
                ? { paddingBottom: KEYBOARD_OVERLAY_ESTIMATED_HEIGHT + 24 }
                : null,
            ]}
            keyboardDismissMode={
              Platform.OS === 'ios' ? 'interactive' : 'on-drag'
            }
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={(event) => {
              scrollYRef.current = event.nativeEvent.contentOffset.y
            }}
            bounces={true}
            automaticallyAdjustContentInsets={false}
          >
            {/* Workout Stats Bar + Chat Button */}
            <View
              style={styles.statsBarContainer}
              onLayout={handleTitleInputContainerLayout}
            >
              <View style={styles.statsBar}>
                <View style={styles.statItem}>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                    Duration
                  </Text>
                  <Text
                    style={[
                      styles.statValue,
                      styles.statValueDuration,
                      { color: colors.brandPrimary },
                    ]}
                  >
                    {draftStats.durationDisplay}
                  </Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                    Volume
                  </Text>
                  <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                    {draftStats.volumeDisplay.value} {draftStats.volumeDisplay.unit}
                  </Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                    Sets
                  </Text>
                  <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                    {draftStats.setsCount}
                  </Text>
                </View>
              </View>
              <View ref={chatButtonRef} collapsable={false} onLayout={handleChatButtonLayout}>
                <TouchableOpacity
                  style={styles.chatButton}
                  onPress={() => {
                    haptic('light')
                    blurInputs()
                    if (isFirstCoachOpen && COACH_SHEET_SEEN_KEY) {
                      AsyncStorage.setItem(COACH_SHEET_SEEN_KEY, 'true')
                      setIsFirstCoachOpen(false)
                      setIsCoachSheetFirstOpen(true)
                    }
                    setShowCoachSheet(true)
                  }}
                  disabled={isLoading || isRecording || isTranscribing}
                  activeOpacity={0.6}
                >
                  <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                    <Image
                      source={coach.image}
                      style={{
                        width: 46,
                        height: 46,
                        borderRadius: 23,
                      }}
                    />
                    <Reanimated.View
                      style={[
                        {
                          position: 'absolute',
                          bottom: -4,
                          right: -4,
                        },
                        chatHandWaveStyle,
                      ]}
                    >
                      <Text style={{ fontSize: 16, lineHeight: 18 }}>👋</Text>
                    </Reanimated.View>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Structured Workout Input - Shown when routine is loaded or manual exercises exist */}
            {isStructuredMode && (
              <View style={styles.structuredSection}>
                <StructuredWorkoutInput
                  routine={selectedRoutine || undefined}
                  lastWorkout={lastRoutineWorkout || undefined}
                  initialExercises={
                    structuredData.length > 0 ? structuredData : undefined
                  }
                  onDataChange={handleStructuredDataChange}
                  onRestTimerStart={handleRestTimerStart}
                  autoRestEnabled={autoRestEnabled}
                  autoRestDuration={autoRestDuration}
                  onInputFocus={handleStructuredInputFocus}
                  onInputBlur={handleStructuredInputBlur}
                  onFocusedInputFrame={ensureStructuredInputVisible}
                  onKeypadStateChange={handleStructuredKeypadStateChange}
                  onFetchSetHistory={fetchSetHistory}
                  onExerciseNamePress={handleExerciseNamePress}
                  warmupCalculatorEnabled={warmupCalculatorEnabled}
                />
              </View>
            )}

            {/* Free-form Notes Input - Always visible */}
            <View style={styles.notesInputWrapper}>
              <TextInput
                ref={notesInputRef}
                style={[
                  styles.notesInput,
                  { color: colors.textPrimary },
                  isStructuredMode &&
                    (structuredData.length > 0 || selectedRoutine) &&
                    styles.notesInputWithStructured,
                  {
                    paddingBottom: showInlineVariations
                      ? stackedVariationSuggestions.length * 28 + 24 // 28px per line approx + base padding
                      : 24,
                  },
                ]}
                // Android alignment fix
                {...Platform.select({ android: { includeFontPadding: false } })}
                placeholder={
                  showEmptyExercisePrompt
                    ? 'Type an exercise...'
                    : isStructuredMode
                      ? ''
                      : 'Log your exercises...'
                }
                placeholderTextColor={
                  showEmptyExercisePrompt ? colors.brandPrimaryDark : '#999'
                }
                multiline
                allowFontScaling={false}
                value={notes}
                onChangeText={handleNotesChange}
                onContentSizeChange={handleContentSizeChange}
                textAlignVertical="top"
                editable={!isRecording && !isTranscribing}
                autoFocus={false}
                cursorColor={
                  showEmptyExercisePrompt
                    ? colors.brandPrimaryDark
                    : colors.brandPrimary
                }
                selectionColor={
                  showEmptyExercisePrompt
                    ? colors.brandPrimaryDark
                    : colors.brandPrimary
                }
                onSelectionChange={handleNotesSelectionChange}
                onFocus={() => {
                  if (keypadProps) {
                    startToolbarInsetHandoff()
                  }
                  setIsStructuredInputFocused(false)
                  setKeypadProps(null)
                  setIsNotesFocused(true)
                  if (nativeKeyboardHeightRef.current > 0) {
                    requestAnimationFrame(() => {
                      ensureNotesCursorVisible()
                    })
                  }
                }}
                onBlur={() => {
                  setIsNotesFocused(false)
                }}
              />

              {/* Ghost Text Overlay - Rendered AFTER TextInput to allow touch interception on suffix */}
              {(currentSuggestion || showInlineVariations) && isNotesFocused && (
                <View
                  style={[
                    styles.notesInput,
                    {
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      zIndex: 10, // Ensure it sits on top
                    },
                    isStructuredMode &&
                      (structuredData.length > 0 || selectedRoutine) &&
                      styles.notesInputWithStructured,
                  ]}
                  pointerEvents="box-none"
                >
                  <Text
                    allowFontScaling={false}
                    style={{
                      color: 'transparent',
                      textAlign: 'left',
                      textAlignVertical: 'top',
                      fontSize: 17,
                      lineHeight: 24,
                      writingDirection: 'ltr',
                      paddingTop: Platform.OS === 'android' ? 0 : 2,
                    }}
                  >
                    {notes.substring(0, cursorPosition)}
                    {currentSuggestion && (
                      <Text
                        style={{ color: colors.textTertiary }}
                        onPress={handleAcceptSuggestion}
                        suppressHighlighting={true}
                      >
                        {currentSuggestion.name.slice(
                          currentSuggestion.inputLength,
                        )}
                      </Text>
                    )}
                    {showInlineVariations &&
                      stackedVariationSuggestions.map((suggestion) => (
                        <Text
                          key={suggestion.name}
                          style={{ color: colors.textTertiary }}
                          onPress={() =>
                            void acceptSuggestionByName(suggestion.name)
                          }
                          suppressHighlighting={true}
                        >
                          {'\n'}
                          {suggestion.name}
                        </Text>
                      ))}
                    {!showInlineVariations && notes.substring(cursorPosition)}
                  </Text>
                </View>
              )}
              {!isNotesFocused && (
                <Pressable
                  style={styles.notesOverlay}
                  onPress={() => {
                    notesInputRef.current?.focus()
                  }}
                />
              )}
            </View>

            {/* Attached Image Thumbnail - REMOVED per refactor */}
          </ScrollView>

          {/* Editor Toolbar */}
          {isToolbarVisible && (
            <View onLayout={handleToolbarLayout}>
              <EditorToolbar
                {...editorToolbarProps}
                bottomInsetOverride={toolbarBottomInsetOverride}
              />
            </View>
          )}
          <Reanimated.View style={combinedSpacerStyle} />
          {/* Custom numeric keypad - rendered here (outside ScrollView) so the
              TextInput retains native focus and caret stays visible */}
          {keypadProps && (
            <CustomNumericKeypad
              {...keypadProps}
              onDone={() => {
                activateKeypadTapShield(340)
                keypadProps.onDone()
              }}
            />
          )}
          {keypadTapShield && (
            <View
              style={StyleSheet.absoluteFill}
              pointerEvents="auto"
              accessibilityElementsHidden
            />
          )}
        </View>

        {isLoading && (
          <View style={styles.submissionOverlay} pointerEvents="auto">
            <ActivityIndicator size="large" color={colors.surface} />
            <Text style={styles.submissionOverlayText}>Saving workout...</Text>
          </View>
        )}

        {/* Paywall Modal */}
        <Paywall
          visible={showPaywall}
          onClose={() => setShowPaywall(false)}
          title={`Take Your Training to the Next Level!`}
          message={`Unlock ${coachFirstName}'s full coaching suite, unlimited workouts, and advanced progress tracking.`}
        />

      </SlideUpView>

      <RestTimerOverlay
        visible={showRestTimer}
        onClose={() => setShowRestTimer(false)}
        remainingSeconds={restTimer.remainingSeconds}
        isActive={restTimer.isActive}
        onStart={restTimer.start}
        onStop={restTimer.stop}
        onAddTime={restTimer.addTime}
        onAutoRestChange={handleAutoRestChange}
      />

      <WorkoutCoachSheet
        visible={showCoachSheet}
        onClose={() => {
          setShowCoachSheet(false)
          setIsCoachSheetFirstOpen(false)
        }}
        workoutContext={workoutContext}
        onAddExercise={handleAddExerciseFromCoach}
        onReplaceExercise={handleReplaceExerciseFromCoach}
        isWorkoutEmpty={isWorkoutEmpty}
        isFirstOpen={isCoachSheetFirstOpen}
      />
    </SafeAreaView>

    <CreatePostTutorial
      steps={pageTutorialSteps}
      visible={showPageTutorial}
      onComplete={handlePageTutorialComplete}
      onStepPress={handlePageTutorialStepPress}
    />
    </>
  )
}

const createStyles = (
  colors: ReturnType<typeof useThemedColors>,
  insets: { top: number; bottom: number; left: number; right: number },
) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    keyboardView: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      position: 'relative',
    },
    headerButton: {
      width: 44,
      height: 44,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerIconShell: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerBackChevron: {
      transform: [{ translateY: 1 }],
    },
    submitButtonFilled: {
      backgroundColor: colors.brandPrimary,
      borderRadius: 22,
    },
    headerLeftButtons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    headerRightButtons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    discardButton: {
      height: 44,
      width: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loaderContainer: {
      width: 28,
      height: 28,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loaderRing: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 3,
      borderColor: 'rgba(255, 255, 255, 0.2)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    loaderArc: {
      position: 'absolute',
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 3,
      borderColor: 'transparent',
      borderTopColor: '#ffffff',
      borderRightColor: '#ffffff',
    },

    inputContainer: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      position: 'relative',
      paddingBottom: 96 + insets.bottom,
    },
    statsBarContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 12,
      gap: 12,
    },
    statsBar: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 24,
    },
    statItem: {
      gap: 2,
    },
    statLabel: {
      fontSize: 12,
      fontWeight: '500',
    },
    statValue: {
      fontSize: 17,
      fontWeight: '600',
    },
    statValueDuration: {
      fontWeight: '700',
    },
    routineSelectorButton: {
      padding: 6,
      borderRadius: 12,
    },
    chatButton: {
      padding: 6,
      borderRadius: 12,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginHorizontal: 20,
    },
    structuredSection: {
      paddingTop: 16,
      paddingBottom: 0,
      paddingHorizontal: 20,
    },
    structuredHeader: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 8,
    },
    removeStructuredButton: {
      padding: 4,
    },
    notesInputWrapper: {
      flex: 1,
      position: 'relative',
    },
    notesInput: {
      flex: 1,
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 20,
      fontSize: 17,
      lineHeight: 24,
      color: colors.textPrimary,
      textAlign: 'left',
      writingDirection: 'ltr',
    },
    notesInputWithStructured: {
      paddingTop: 8,
    },
    notesOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    newUserGuideContainer: {
      position: 'absolute',
      top: 68, // Header height (12px padding + 44px button + 12px padding)
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 20,
      pointerEvents: 'none',
    },
    newUserGuideCard: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: colors.surfaceSubtle,
      borderRadius: 20,
      paddingHorizontal: 18,
      paddingVertical: 16,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 10,
    },
    newUserGuideTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
      letterSpacing: -0.4,
      marginBottom: 2,
    },
    newUserGuideSubtitle: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.textSecondary,
      marginBottom: 2,
    },
    newUserGuideOptionRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    newUserGuideOptionBadge: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.brandPrimary,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 1,
    },
    newUserGuideOptionBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: '#fff',
    },
    newUserGuideOptionContent: {
      flex: 1,
      gap: 3,
    },
    newUserGuideOptionTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    newUserGuideOptionHintRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    newUserGuideOptionHintIconWrap: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bg,
    },
    newUserGuideOptionHintText: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.textSecondary,
    },
    newUserGuideStructuredPreview: {
      backgroundColor: colors.bg,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      paddingHorizontal: 8,
      paddingTop: 6,
      paddingBottom: 4,
      marginTop: 4,
    },
    // StructuredWorkoutInput keeps bottom spacing for full-page editing.
    // Trim it in this read-only preview to keep the onboarding card compact.
    newUserGuideStructuredPreviewContent: {
      marginBottom: -4,
    },
    newUserGuideFooter: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.textTertiary,
      fontWeight: '500',
      paddingTop: 10,
      marginTop: 2,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    attachedImageContainer: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 8,
    },
    attachedImageWrapper: {
      position: 'relative',
      width: '100%',
      aspectRatio: 16 / 9,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: colors.surfaceSubtle,
      borderWidth: 1,
      borderColor: colors.border,
    },
    attachedImage: {
      width: '100%',
      height: '100%',
    },
    imageLoadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.surfaceSubtle,
    },
    removeImageButton: {
      position: 'absolute',
      top: 8,
      right: 8,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      borderRadius: 14,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 4,
    },
    attachedImageLabel: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.textSecondary,
      marginTop: 8,
      textAlign: 'center',
    },
    staticAccessoryBar: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingBottom: insets.bottom,
    },
    submissionOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.55)',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 12,
      zIndex: 50,
    },
    submissionOverlayText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.surface,
    },
  })
