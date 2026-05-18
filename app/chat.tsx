import { useProfile } from '@/contexts/profile-context'
import { useWorkoutComposer } from '@/contexts/workout-composer-context'
import { useExerciseHistory } from '@/hooks/useExerciseHistory'
import { parseRepRange } from '@/hooks/useExerciseAutocomplete'
import { useThemedColors } from '@/hooks/useThemedColors'
import { getCoach } from '@/lib/coaches'
import { haptic } from '@/lib/haptics'
import type { StructuredExerciseDraft } from '@/lib/utils/workout-draft'
import { Ionicons } from '@expo/vector-icons'
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

  // Quick-action entry from the My Library "Create new" buttons. When this
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
        <View style={styles.headerLeft}>
          <Image source={coach.image} style={styles.headerAvatar} />
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerName} numberOfLines={1}>
              {coach.name}
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              Your coach
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={handleOpenSettings}
            style={styles.headerIconButton}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Chat settings"
          >
            <Ionicons
              name="settings-outline"
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleClose}
            style={styles.headerIconButton}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Close chat"
          >
            <Ionicons name="close" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
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
        />
      </View>
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
      backgroundColor: colors.surfaceSheet,
      paddingTop: insets.top,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      gap: 12,
    },
    headerLeft: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minWidth: 0,
    },
    headerAvatar: {
      width: 38,
      height: 38,
      borderRadius: 19,
    },
    headerTextWrap: {
      flex: 1,
      minWidth: 0,
    },
    headerName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textPrimary,
      letterSpacing: -0.2,
    },
    headerSubtitle: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 1,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    headerIconButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.surfaceSubtle,
    },
    chatContainer: {
      flex: 1,
      overflow: 'hidden',
    },
  })
