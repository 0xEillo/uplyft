import { useAuth } from '@/contexts/auth-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { getCoach } from '@/lib/coaches'
import { database } from '@/lib/database'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useEffect, useState } from 'react'
import {
    Dimensions,
    Image,
    Keyboard,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native'
import {
    Gesture,
    GestureDetector,
    GestureHandlerRootView,
} from 'react-native-gesture-handler'
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
    ExerciseSuggestion,
    SuggestionsConfig,
    WorkoutChat,
    WorkoutContext,
} from './workout-chat'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')
const INITIAL_SHEET_HEIGHT = SCREEN_HEIGHT * 0.6
const MAX_SHEET_HEIGHT = SCREEN_HEIGHT * 0.85

interface WorkoutCoachSheetProps {
  visible: boolean
  onClose: () => void
  workoutContext: WorkoutContext
  onAddExercise: (exercise: ExerciseSuggestion) => void
  onReplaceExercise?: (
    oldExerciseName: string,
    newExercise: ExerciseSuggestion,
  ) => void
  isWorkoutEmpty?: boolean
}

// Coach sheet specific suggestions - always show all 3 buttons
const createCoachSheetSuggestions = (
  _isWorkoutEmpty: boolean,
  _hasExercises: boolean,
): SuggestionsConfig => ({
  main: [
    {
      id: 'plan_workout',
      text: 'Generate Workout',
      icon: 'flash-outline',
    },
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
})

export function WorkoutCoachSheet({
  visible,
  onClose,
  workoutContext,
  onAddExercise,
  onReplaceExercise,
  isWorkoutEmpty = false,
}: WorkoutCoachSheetProps) {
  const colors = useThemedColors()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()

  const [coachId, setCoachId] = useState<string>('ross')
  const [sheetHeight, setSheetHeight] = useState(INITIAL_SHEET_HEIGHT)
  const [keyboardHeight, setKeyboardHeight] = useState(0)

  const translateY = useSharedValue(0)

  const styles = createStyles(colors, insets, sheetHeight)

  // Keyboard listeners
  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height)
    })

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0)
    })

    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [])

  // Load coach preference
  useEffect(() => {
    async function loadCoach() {
      if (!user?.id) return
      try {
        const profile = await database.profiles.getByIdOrNull(user.id)
        if (profile?.coach) {
          setCoachId(profile.coach)
        }
      } catch (error) {
        console.error('Error loading coach:', error)
      }
    }
    loadCoach()
  }, [user?.id])

  // Reset state when sheet opens
  useEffect(() => {
    if (visible) {
      translateY.value = 0
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    }
  }, [visible, translateY])

  const closeSheet = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onClose()
  }

  // Gesture for dragging sheet
  const pan = Gesture.Pan()
    .onUpdate((event) => {
      const newTranslateY = event.translationY
      if (newTranslateY > 0) {
        // Dragging down - allow with resistance
        translateY.value = newTranslateY
      } else {
        // Dragging up - expand sheet
        const newHeight = Math.min(
          MAX_SHEET_HEIGHT,
          INITIAL_SHEET_HEIGHT - newTranslateY,
        )
        runOnJS(setSheetHeight)(newHeight)
      }
    })
    .onEnd((event) => {
      if (event.translationY > 100 || event.velocityY > 1000) {
        // Close sheet
        translateY.value = withTiming(SCREEN_HEIGHT, { duration: 200 }, () => {
          runOnJS(closeSheet)()
        })
      } else {
        // Snap back
        translateY.value = withSpring(0, { damping: 20, stiffness: 300 })
      }
    })

  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }))

  const coach = getCoach(coachId)
  const hasExercises = workoutContext.exercises.length > 0

  // Create suggestions based on workout state
  const suggestions = createCoachSheetSuggestions(isWorkoutEmpty, hasExercises)

  if (!visible) return null

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={closeSheet}
    >
      <GestureHandlerRootView style={styles.modalContainer}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet}>
          <View style={styles.backdrop} />
        </Pressable>

        <GestureDetector gesture={pan}>
          <Animated.View
            style={[
              styles.sheet,
              animatedSheetStyle,
              keyboardHeight > 0
                ? {
                    // Match prior behavior: fixed offset keeps the input fully above the keyboard on iOS.
                    // (keyboardHeight already includes the safe-area region in many cases; subtracting insets
                    // can under-shoot and leave the input hidden.)
                    marginBottom: Math.max(0, keyboardHeight - 26 + 10),
                    // When keyboard is up, constrain height to max 75% of available space above keyboard
                    height: Math.min(
                      INITIAL_SHEET_HEIGHT,
                      (SCREEN_HEIGHT - keyboardHeight) * 0.75,
                    ),
                  }
                : null,
            ]}
          >
            {/* Handle */}
            <View style={styles.handleContainer}>
              <View style={styles.handle} />
            </View>

            {/* Header */}
            <View style={styles.header}>
              <View style={styles.coachInfo}>
                <Image source={coach.image} style={styles.coachAvatar} />
                <Text style={styles.headerTitle}>
                  Ask {coach.name.split(' ')[1] || coach.name}...
                </Text>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={closeSheet}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* WorkoutChat in sheet mode */}
            <View style={styles.chatContainer}>
              <WorkoutChat
                mode="sheet"
                workoutContext={workoutContext}
                onAddExercise={onAddExercise}
                onReplaceExercise={onReplaceExercise}
                customSuggestions={suggestions}
                hideImagePicker
                onClose={closeSheet}
              />
            </View>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  )
}

const createStyles = (
  colors: ReturnType<typeof useThemedColors>,
  insets: { bottom: number; top: number },
  sheetHeight: number,
) =>
  StyleSheet.create({
    modalContainer: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    sheet: {
      height: sheetHeight,
      backgroundColor: colors.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 12,
    },
    handleContainer: {
      alignItems: 'center',
      paddingTop: 12,
      paddingBottom: 8,
    },
    handle: {
      width: 36,
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    coachInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    coachAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      borderWidth: 2,
      borderColor: colors.background,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    closeButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.backgroundLight,
      justifyContent: 'center',
      alignItems: 'center',
    },
    chatContainer: {
      flex: 1,
      overflow: 'hidden',
    },
  })
