import { LiquidGlassSurface } from '@/components/liquid-glass-surface'
import { Paywall } from '@/components/paywall'
import { useProfile } from '@/contexts/profile-context'
import { useWorkoutComposer } from '@/contexts/workout-composer-context'
import { useExerciseHistory } from '@/hooks/useExerciseHistory'
import { parseRepRange } from '@/hooks/useExerciseAutocomplete'
import { useThemedColors } from '@/hooks/useThemedColors'
import { getCoach } from '@/lib/coaches'
import { haptic } from '@/lib/haptics'
import type { StructuredExerciseDraft } from '@/lib/utils/workout-draft'
import { useFeatureGate } from '@/utils/analytics-helpers'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { router, useLocalSearchParams } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import {
  Image,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  ExerciseSuggestion,
  WorkoutChat,
  WorkoutContext,
} from '@/components/workout-chat'

const PAYWALL_SOURCE = 'chat_free_limit'

export default function ChatScreen() {
  const colors = useThemedColors()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{
    returnToTab?: string
    generate?: string
  }>()
  const { coachId } = useProfile()
  const coach = getCoach(coachId)
  const [headerHeight, setHeaderHeight] = useState(0)

  // AI chat is free with a daily message cap for non-Pro users (enforced by
  // the chat edge function). When the cap is hit, offer the paywall.
  const { trackPaywallShown, trackPaywallDismissed } = useFeatureGate()
  const [paywallVisible, setPaywallVisible] = useState(false)

  const handleFreeLimitReached = useCallback(() => {
    Keyboard.dismiss()
    trackPaywallShown('ai_chat', PAYWALL_SOURCE)
    setPaywallVisible(true)
  }, [trackPaywallShown])

  const handlePaywallClose = useCallback(() => {
    trackPaywallDismissed('ai_chat', PAYWALL_SOURCE)
    setPaywallVisible(false)
  }, [trackPaywallDismissed])

  const styles = useMemo(() => createStyles(colors, insets), [colors, insets])

  // RN's KeyboardAvoidingView frame is parent-relative, but the keyboard event
  // ships absolute screen Y. We therefore have to tell the inner KAV how far
  // its parent (the chat container under the header) sits from the top of the
  // screen, otherwise the input gets covered by the keyboard.
  const chatKeyboardOffset =
    Platform.OS === 'ios' ? insets.top + headerHeight : 0

  const {
    session,
    draft,
    hasActiveSession,
    updateDraft,
  } = useWorkoutComposer()

  const {
    createExerciseWithHistory,
    createEmptySet,
  } = useExerciseHistory()

  // Build a WorkoutContext snapshot from the current composer draft so the AI
  // knows what the user is currently working on. Only populated when an active
  // workout exists, otherwise the chat behaves as a general coach.
  const workoutContext = useMemo<WorkoutContext | undefined>(() => {
    if (!hasActiveSession) return undefined
    return {
      sessionId: session.meta.sessionId ?? undefined,
      title: draft.title,
      notes: draft.notes,
      exercises: draft.structuredData.map((exercise) => ({
        name: exercise.name,
        loggingType: exercise.loggingType,
        setsCount: exercise.sets.length,
        sets: exercise.sets
          .map((set) => ({
            weight: set.weight || undefined,
            reps: set.reps || undefined,
            duration: set.duration || undefined,
          }))
          .filter((set) => set.weight || set.reps || set.duration),
      })),
    }
  }, [
    hasActiveSession,
    session.meta.sessionId,
    draft.title,
    draft.notes,
    draft.structuredData,
  ])

  // Append an exercise (with last-workout history) to the active workout draft.
  const handleAddExercise = useCallback(
    async (exercise: ExerciseSuggestion) => {
      const { targetRepsMin, targetRepsMax } = parseRepRange(exercise.reps)

      const newExercise = await createExerciseWithHistory(
        exercise.name,
        exercise.sets,
        targetRepsMin,
        targetRepsMax,
      )

      updateDraft((current) => ({
        isStructuredMode: true,
        structuredData: [...current.structuredData, newExercise],
      }))
    },
    [createExerciseWithHistory, updateDraft],
  )

  // Replace an existing exercise in the workout draft, preserving any data the
  // user has already entered for shared sets.
  const handleReplaceExercise = useCallback(
    async (oldExerciseName: string, nextExercise: ExerciseSuggestion) => {
      const { targetRepsMin, targetRepsMax } = parseRepRange(nextExercise.reps)

      const existingIndex = draft.structuredData.findIndex(
        (exercise) =>
          exercise.name.toLowerCase() === oldExerciseName.toLowerCase(),
      )

      if (existingIndex === -1) {
        const newExerciseData = await createExerciseWithHistory(
          nextExercise.name,
          nextExercise.sets,
          targetRepsMin,
          targetRepsMax,
        )
        updateDraft((current) => ({
          isStructuredMode: true,
          structuredData: [...current.structuredData, newExerciseData],
        }))
        return
      }

      const newHistory = await createExerciseWithHistory(
        nextExercise.name,
        nextExercise.sets,
        targetRepsMin,
        targetRepsMax,
      )

      updateDraft((current) => {
        const oldExercise = current.structuredData[existingIndex]
        if (!oldExercise) return {}

        const setCount = Math.max(nextExercise.sets, oldExercise.sets.length)
        const sets = Array.from({ length: setCount }, (_, i) => {
          if (i < oldExercise.sets.length) {
            return { ...oldExercise.sets[i], targetRepsMin, targetRepsMax }
          }
          return (
            newHistory.sets[i] ?? createEmptySet(targetRepsMin, targetRepsMax)
          )
        })

        const updated: StructuredExerciseDraft[] = [...current.structuredData]
        updated[existingIndex] = {
          id: oldExercise.id,
          name: nextExercise.name,
          sets,
        }
        return { structuredData: updated }
      })
    },
    [createEmptySet, createExerciseWithHistory, draft.structuredData, updateDraft],
  )

  const handleClose = useCallback(() => {
    haptic('light')
    Keyboard.dismiss()
    const returnToTab = Array.isArray(params.returnToTab)
      ? params.returnToTab[0]
      : params.returnToTab
    if (
      returnToTab === 'index' ||
      returnToTab === 'analytics' ||
      returnToTab === 'profile'
    ) {
      if (returnToTab === 'analytics') {
        router.dismissTo('/(tabs)/analytics')
      } else if (returnToTab === 'profile') {
        router.dismissTo('/(tabs)/profile')
      } else {
        router.dismissTo('/(tabs)')
      }
      return
    }

    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace('/(tabs)')
    }
  }, [params.returnToTab])

  const handleOpenSettings = useCallback(() => {
    haptic('light')
    Keyboard.dismiss()
    router.push('/chat-settings')
  }, [])

  // Quick-action entry from the My Library "Create new" button. When this
  // param is present we auto-open the ✨ Create Workout / Program menu above
  // the composer.
  const generateIntent = Array.isArray(params.generate)
    ? params.generate[0]
    : params.generate
  const shouldAutoOpenActions =
    generateIntent === 'routine' || generateIntent === 'program'

  return (
    <View style={styles.page}>
      <View
        style={styles.header}
        onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
      >
        <LiquidGlassSurface style={styles.headerGlassButton}>
          <TouchableOpacity
            onPress={handleClose}
            style={styles.headerIconButton}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Close chat"
          >
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </LiquidGlassSurface>

        <Text style={styles.headerTitle} numberOfLines={1}>
          {coach.name}
        </Text>

        {/* Coach avatar doubles as the entry point to chat settings. */}
        <TouchableOpacity
          onPress={handleOpenSettings}
          style={styles.headerIconButton}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Chat settings"
        >
          <Image source={coach.image} style={styles.headerAvatar} />
        </TouchableOpacity>
      </View>

      <View style={styles.chatContainer}>
        <WorkoutChat
          persistence={{ kind: 'main' }}
          mode="sheet"
          workoutContext={workoutContext}
          onAddExercise={handleAddExercise}
          onReplaceExercise={handleReplaceExercise}
          onClose={handleClose}
          keyboardVerticalOffsetOverride={chatKeyboardOffset}
          autoOpenActions={shouldAutoOpenActions}
          onFreeLimitReached={handleFreeLimitReached}
        />
        {/* Messages dissolve under the header instead of hard-clipping. */}
        <LinearGradient
          pointerEvents="none"
          colors={[colors.bg, `${colors.bg}00`]}
          style={styles.headerFade}
        />
      </View>

      <Paywall
        visible={paywallVisible}
        onClose={handlePaywallClose}
        title="Keep chatting with your coach"
        feature="ai_chat"
      />
    </View>
  )
}

const createStyles = (
  colors: ReturnType<typeof useThemedColors>,
  insets: { bottom: number; top: number },
) =>
  StyleSheet.create({
    page: {
      flex: 1,
      backgroundColor: colors.bg,
      paddingTop: insets.top,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 6,
      paddingBottom: 8,
      gap: 12,
    },
    headerGlassButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerIconButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      fontSize: 17,
      fontWeight: '600',
      color: colors.textPrimary,
      letterSpacing: -0.2,
    },
    headerAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
    },
    chatContainer: {
      flex: 1,
      overflow: 'hidden',
    },
    headerFade: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 24,
    },
  })
