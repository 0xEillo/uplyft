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
import { useProfile } from '@/contexts/profile-context'
import { useRestTimerContext } from '@/contexts/rest-timer-context'
import { useSubscription } from '@/contexts/subscription-context'
import { useTutorial } from '@/contexts/tutorial-context'
import { useWorkoutComposer } from '@/contexts/workout-composer-context'
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
import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { getCoach } from '@/lib/coaches'
import { database } from '@/lib/database'
import { haptic, hapticSuccess } from '@/lib/haptics'
import { buildStructuredDraftFromRoutineTemplate } from '@/lib/utils/routine-structured-draft'
import { structuredWorkoutHasLoggedSets } from '@/lib/utils/workout-composer-format'
import {
  getToolbarButtons,
  getWarmupCalculatorEnabled,
  type ToolbarButtonId,
} from '@/lib/utils/create-post-settings'
import { runAfterInteractions } from '@/lib/utils/run-after-interactions'
import type { StructuredExerciseDraft } from '@/lib/utils/workout-draft'
import { formatVolume } from '@/lib/utils/workout-stats'
import {
  Exercise,
  WorkoutRoutineWithDetails,
  WorkoutSessionWithDetails,
} from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  useFocusEffect,
} from '@react-navigation/native'
import { router } from 'expo-router'
import { type SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Animated,
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

const STRUCTURED_INPUT_SCROLL_TAP_GUARD_MS = 180

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

export default function CreatePostScreen() {
  const colors = useThemedColors()
  const { weightUnit, convertInputToKg } = useWeightUnits()
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
  // Custom keypad actual height: paddingTop(16) + 4 rows×52 + 3 gaps×8 + paddingBottom(max(inset,10)+6)
  const CUSTOM_KEYPAD_HEIGHT = 254 + Math.max(bottomSafeInset, 10)

  // Exercise history hook for creating exercises with last performance data
  const {
    createExerciseWithHistory,
    createEmptySet,
    fetchSetHistory,
  } = useExerciseHistory()

  // =============================================================================
  // BASIC WORKOUT INPUT STATE
  // =============================================================================
  const {
    canReview,
    discardSession,
    draft,
    elapsedSeconds: workoutElapsedSeconds,
    enterReview,
    hasActiveSession,
    hasHydrated,
    isReviewing,
    returnToEditing,
    seedRoutine,
    updateDraft,
  } = useWorkoutComposer()
  const notes = draft.notes
  const workoutTitle = draft.title
  const isStructuredMode = draft.isStructuredMode
  const structuredData = draft.structuredData
  const selectedRoutineId = draft.selectedRoutineId
  const [isLoading, setIsLoading] = useState(false)

  // =============================================================================
  // FINALIZE OVERLAY STATE
  // =============================================================================

  // =============================================================================
  // UI STATE
  // =============================================================================
  const [isNotesFocused, setIsNotesFocused] = useState(false)
  const [isStructuredInputFocused, setIsStructuredInputFocused] = useState(
    false,
  )
  const [areStructuredSetInputsEnabled, setAreStructuredSetInputsEnabled] =
    useState(true)
  const [keypadProps, setKeypadProps] = useState<CustomNumericKeypadProps | null>(null)
  const [keypadTapShield, setKeypadTapShield] = useState(false)
  const [showPaywall, setShowPaywall] = useState(false)
  const [showCoachSheet, setShowCoachSheet] = useState(false)
  const [isFirstCoachOpen, setIsFirstCoachOpen] = useState(false)
  const [isCoachSheetFirstOpen, setIsCoachSheetFirstOpen] = useState(false)
  const chatHandWave = useSharedValue(0)
  const [warmupCalculatorEnabled, setWarmupCalculatorEnabled] = useState(() =>
    getWarmupCalculatorEnabled(),
  )
  const [toolbarVisibleButtons, setToolbarVisibleButtons] = useState<
    ToolbarButtonId[]
  >(() => getToolbarButtons())
  // =============================================================================
  // ROUTINE & STRUCTURED WORKOUT STATE
  // =============================================================================
  const [routines, setRoutines] = useState<WorkoutRoutineWithDetails[]>([])
  const [allExercises, setAllExercises] = useState<Exercise[]>([])
  const [hasLoadedRoutines, setHasLoadedRoutines] = useState(false)
  const selectedRoutine = useMemo(
    () =>
      routines.find((routine) => routine.id === selectedRoutineId) ?? null,
    [routines, selectedRoutineId],
  )

  const [showRestTimer, setShowRestTimer] = useState(false)
  const restTimer = useRestTimerContext()
  const [autoRestEnabled, setAutoRestEnabled] = useState(true)
  const [autoRestDuration, setAutoRestDuration] = useState(120)
  const setNotes = useCallback(
    (value: SetStateAction<string>) => {
      updateDraft((current) => ({
        notes: typeof value === 'function' ? value(current.notes) : value,
      }))
    },
    [updateDraft],
  )
  const setWorkoutTitle = useCallback(
    (value: SetStateAction<string>) => {
      updateDraft((current) => ({
        title: typeof value === 'function' ? value(current.title) : value,
      }))
    },
    [updateDraft],
  )
  const setStructuredData = useCallback(
    (value: SetStateAction<StructuredExerciseDraft[]>) => {
      updateDraft((current) => ({
        structuredData:
          typeof value === 'function'
            ? value(current.structuredData)
            : value,
      }))
    },
    [updateDraft],
  )
  const setIsStructuredMode = useCallback(
    (value: SetStateAction<boolean>) => {
      updateDraft((current) => ({
        isStructuredMode:
          typeof value === 'function'
            ? value(current.isStructuredMode)
            : value,
      }))
    },
    [updateDraft],
  )

  const hasStructuredEntries = useMemo(() => {
    if (!isStructuredMode || structuredData.length === 0) {
      return false
    }

    return structuredWorkoutHasLoggedSets(structuredData)
  }, [isStructuredMode, structuredData])

  const hasWorkoutDraftContent = hasActiveSession

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
        if (!set.isCompleted) return
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
    [setStructuredData],
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

  const lockStructuredSetInputs = useCallback(() => {
    if (structuredInputScrollUnlockTimeoutRef.current) {
      clearTimeout(structuredInputScrollUnlockTimeoutRef.current)
      structuredInputScrollUnlockTimeoutRef.current = null
    }
    setAreStructuredSetInputsEnabled(false)
  }, [])

  const releaseStructuredSetInputs = useCallback(
    (delayMs = STRUCTURED_INPUT_SCROLL_TAP_GUARD_MS) => {
      if (structuredInputScrollUnlockTimeoutRef.current) {
        clearTimeout(structuredInputScrollUnlockTimeoutRef.current)
      }
      structuredInputScrollUnlockTimeoutRef.current = setTimeout(() => {
        structuredInputScrollUnlockTimeoutRef.current = null
        setAreStructuredSetInputsEnabled(true)
      }, delayMs)
    },
    [],
  )

  useEffect(() => {
    return () => {
      if (keypadTapShieldTimeoutRef.current) {
        clearTimeout(keypadTapShieldTimeoutRef.current)
      }
      if (structuredInputScrollUnlockTimeoutRef.current) {
        clearTimeout(structuredInputScrollUnlockTimeoutRef.current)
        structuredInputScrollUnlockTimeoutRef.current = null
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

  // Use hook for convert button visibility
  const showConvertButton = useShowConvertButton(
    notes,
    cursorPosition,
    isNotesFocused,
  )

  // =============================================================================
  // IMAGE ATTACHMENT STATE
  // =============================================================================
  const spinValue = useRef(new Animated.Value(0)).current
  const buttonScaleAnim = useRef(new Animated.Value(1)).current

  const notesInputRef = useRef<TextInput>(null)
  const scrollViewRef = useRef<ScrollView>(null)
  const toolbarTimerRef = useRef<View>(null)
  const toolbarRoutineRef = useRef<View>(null)
  const toolbarAddRef = useRef<View>(null)
  const scrollYRef = useRef(0)
  const nativeKeyboardHeightRef = useRef(0)
  const keypadVisibleRef = useRef(false)
  const structuredInputScrollUnlockTimeoutRef =
    useRef<ReturnType<typeof setTimeout> | null>(null)
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
  const isSubmittingRef = useRef(false)
  const notesForFocusRef = useRef(notes)
  const workoutTitleForFocusRef = useRef(workoutTitle)
  const [isToolbarInsetLocked, setIsToolbarInsetLocked] = useState(false)
  const { user } = useAuth()
  const { trackEvent } = useAnalytics()
  const { isProMember } = useSubscription()
  const { completeStep } = useTutorial()
  const { canPostWorkout } = useFreemiumLimits()

  // Complete tutorial step when user actually starts a workout (has content)
  useEffect(() => {
    notesForFocusRef.current = notes
    workoutTitleForFocusRef.current = workoutTitle
  }, [notes, workoutTitle])

  useEffect(() => {
    if (hasHydrated && hasWorkoutDraftContent) {
      completeStep('create_workout')
    }
  }, [completeStep, hasHydrated, hasWorkoutDraftContent])

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
  const getCurrentWorkoutElapsedSeconds = useCallback(
    () => Math.max(0, Math.floor(workoutElapsedSeconds)),
    [workoutElapsedSeconds],
  )

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
      setHasLoadedRoutines(false)

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
      } else {
        setRoutines([])
        setAllExercises([])
      }
    } catch (error) {
      console.error('[CreatePost] Error loading data:', error)
    } finally {
      setHasLoadedRoutines(true)
    }
  }, [user])

  // Track animation state to reset on each focus
  const [slideKey, setSlideKey] = useState(0)
  const [shouldExit, setShouldExit] = useState(false)

  // Use exercise selection hook for navigation-based exercise search
  const { registerCallback } = useExerciseSelection()

  // Use routine selection hook for navigation-based routine selection
  const { registerCallback: registerRoutineCallback } = useRoutineSelection()

  // Handle screen focus and blur keyboard
  useFocusEffect(
    useCallback(() => {
      if (!hasHydrated) {
        return undefined
      }

      setSlideKey((prev) => prev + 1)
      setShouldExit(false)
      setWarmupCalculatorEnabled(getWarmupCalculatorEnabled())
      setToolbarVisibleButtons(getToolbarButtons())

      haptic('light')

      blurInputs()
      if (isReviewing) {
        returnToEditing()
      }

      trackEvent(AnalyticsEvents.WORKOUT_CREATE_STARTED, {
        mode: 'text',
        hasDraft: Boolean(notesForFocusRef.current.trim()),
        hasTitle: Boolean(workoutTitleForFocusRef.current.trim()),
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
            void workouts.length
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
      }
    }, [
      blurInputs,
      hasHydrated,
      isReviewing,
      returnToEditing,
      trackEvent,
      user,
      loadRoutinesAndExercises,
    ]),
  )

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
          onPress: () => {
            restTimer.stop()
            discardSession()
            haptic('light')
          },
        },
      ],
    )
  }, [blurInputs, discardSession, restTimer])

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
    (routine: WorkoutRoutineWithDetails) => {
      setLastRoutineWorkout(null)
      seedRoutine({
        title: routine.name,
        structuredData: buildStructuredDraftFromRoutineTemplate(
          (routine.workout_routine_exercises ?? [])
            .sort((a, b) => a.order_index - b.order_index)
            .map((exercise) => ({
              id: exercise.id,
              name: exercise.exercise?.name ?? 'Unknown Exercise',
              orderIndex: exercise.order_index,
              sets: (exercise.sets ?? [])
                .sort((a, b) => a.set_number - b.set_number)
                .map((set) => ({
                  setNumber: set.set_number,
                  repsMin: set.reps_min,
                  repsMax: set.reps_max,
                  restSeconds: set.rest_seconds,
                })),
            })),
        ),
        selectedRoutineId: routine.id,
        routineSource: 'selection',
      })

      trackEvent(AnalyticsEvents.WORKOUT_CREATE_STARTED, {
        mode: 'routine_template',
        routineId: routine.id,
      })
    },
    [seedRoutine, trackEvent],
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

    if (!canReview) {
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

    const finalizedDurationSeconds = getCurrentWorkoutElapsedSeconds()
    const didEnterReview = enterReview()

    if (!didEnterReview) {
      isSubmittingRef.current = false
      setIsLoading(false)
      Alert.alert(
        'Workout Details Missing',
        'Add your exercises, sets, and reps to track your progress.',
        [{ text: 'OK' }],
      )
      return
    }

    isSubmittingRef.current = false
    setIsLoading(false)

    router.push({
      pathname: '/(stand-alone)/finalize-workout',
      params: {
        durationDisplay: draftStats.durationDisplay,
        volumeValue: draftStats.volumeDisplay.value.toString(),
        volumeUnit: draftStats.volumeDisplay.unit,
        setsCount: draftStats.setsCount.toString(),
        durationSeconds: finalizedDurationSeconds.toString(),
      },
    })

    trackEvent(AnalyticsEvents.WORKOUT_CREATE_SUBMITTED, {
      hasTitle: Boolean(workoutTitle.trim()),
      length: notes.trim().length,
    })
  }

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

  // Handle text change
  const handleNotesChange = useCallback(
    async (text: string) => {
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

  const handleToolbarAddExercise = useCallback(() => {
    if (!showConvertButton) {
      handleChooseExercisePress()
      return
    }

    void handleConvertToStructured()
  }, [
    handleChooseExercisePress,
    handleConvertToStructured,
    showConvertButton,
  ])

  const handleManualReplaceExercise = useCallback((index: number) => {
    // Register callback for single exercise replacement
    registerCallback(async (selectedExercises: Exercise | Exercise[]) => {
      const exercises = Array.isArray(selectedExercises)
        ? selectedExercises
        : [selectedExercises]
      
      if (exercises.length === 0) return
      
      const newExercise = exercises[0]
      const newExerciseData = await createExerciseWithHistory(newExercise.name)
      
      setStructuredData((prev) => {
        const newData = [...prev]
        // Preserve sets if possible, or just replace entirely
        const oldExercise = newData[index]
        if (oldExercise) {
          // Keep the same number of sets but clear the data, or just use the new history
          const setCount = Math.max(1, oldExercise.sets.length)
          const sets = Array.from({ length: setCount }, (_, i) => {
            return newExerciseData.sets[i] || createEmptySet()
          })
          newData[index] = {
            ...newExerciseData,
            sets,
          }
        }
        return newData
      })
    })

    // Navigate to the full-screen exercise selector in single-select (replace) mode
    router.push({
      pathname: '/select-exercise',
      params: { currentExerciseName: '__replace__' },
    })
  }, [registerCallback, createExerciseWithHistory, createEmptySet])

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

  useEffect(() => {
    if (!hasLoadedRoutines || !selectedRoutineId) {
      return
    }

    if (selectedRoutine) {
      return
    }

    setLastRoutineWorkout(null)
    updateDraft({
      selectedRoutineId: null,
      routineSource: null,
    })
  }, [
    hasLoadedRoutines,
    selectedRoutine,
    selectedRoutineId,
    updateDraft,
  ])

  useEffect(() => {
    let cancelled = false

    if (!selectedRoutineId || !user?.id) {
      setLastRoutineWorkout(null)
      return () => {
        cancelled = true
      }
    }

    setLastRoutineWorkout(null)

    const loadLastRoutineWorkout = async () => {
      try {
        const lastWorkout = await database.workoutSessions.getLastForRoutine(
          user.id,
          selectedRoutineId,
        )

        if (!cancelled) {
          setLastRoutineWorkout(lastWorkout ?? null)
        }
      } catch (error) {
        console.error(
          '[CreatePost] Error loading last workout for routine:',
          error,
        )
        if (!cancelled) {
          setLastRoutineWorkout(null)
        }
      }
    }

    void loadLastRoutineWorkout()

    return () => {
      cancelled = true
    }
  }, [selectedRoutineId, user?.id])

  // Check if all structured exercises have been deleted and clear routine if so
  useEffect(() => {
    const currentLength = structuredData.length
    const previousLength = previousStructuredDataLength.current

    // If we had exercises and now have zero (user deleted all)
    if (selectedRoutine && previousLength > 0 && currentLength === 0) {
      setLastRoutineWorkout(null)
      updateDraft({
        isStructuredMode: false,
        selectedRoutineId: null,
        routineSource: null,
      })
    }

    // Update previous length
    previousStructuredDataLength.current = currentLength
  }, [selectedRoutine, structuredData, updateDraft])

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
      onAddExercise: handleToolbarAddExercise,
      isRecording,
      isTranscribing,
      isProcessingImage,
      isLoading,
      isRestTimerActive: restTimer.isActive,
      restTimerRemaining: restTimer.remainingSeconds,
      bottomInsetOverride: bottomSafeInset,
      visibleButtons: toolbarVisibleButtons,
      timerButtonRef: toolbarTimerRef,
      routineButtonRef: toolbarRoutineRef,
      addButtonRef: toolbarAddRef,
    }),
    [
      handleScanWorkoutPress,
      handleToggleRecording,
      blurInputs,
      handleOpenRoutineSelector,
      handleToolbarAddExercise,
      isRecording,
      isTranscribing,
      isProcessingImage,
      isLoading,
      toolbarVisibleButtons,
      restTimer.isActive,
      restTimer.remainingSeconds,
      bottomSafeInset,
    ],
  )

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

  const chatHandWaveStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${chatHandWave.value}deg` },
    ],
  }))
  const isToolbarVisible =
    toolbarVisibleButtons.length > 0 &&
    (!isStructuredInputFocused || Boolean(keypadProps))
  const toolbarBottomInsetOverride =
    keypadProps || isToolbarInsetLocked ? 8 : bottomSafeInset

  if (!hasHydrated) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
        </View>
      </SafeAreaView>
    )
  }

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

        <View style={styles.keyboardView}>
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
            onScrollBeginDrag={lockStructuredSetInputs}
            onMomentumScrollBegin={lockStructuredSetInputs}
            onScrollEndDrag={() => {
              releaseStructuredSetInputs()
            }}
            onMomentumScrollEnd={() => {
              releaseStructuredSetInputs()
            }}
            bounces={true}
            automaticallyAdjustContentInsets={false}
          >
            {/* Workout Stats Bar + Chat Button */}
            <View style={styles.statsBarContainer}>
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
              <View>
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
                  inputsEnabled={areStructuredSetInputsEnabled}
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
                  onReplaceExercise={handleManualReplaceExercise}
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
                placeholder={isStructuredMode ? '' : ''}
                placeholderTextColor="#999"
                multiline
                allowFontScaling={false}
                value={notes}
                onChangeText={handleNotesChange}
                onContentSizeChange={handleContentSizeChange}
                textAlignVertical="top"
                editable={!isRecording && !isTranscribing}
                autoFocus={false}
                cursorColor={colors.brandPrimary}
                selectionColor={colors.brandPrimary}
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
    loadingState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
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
