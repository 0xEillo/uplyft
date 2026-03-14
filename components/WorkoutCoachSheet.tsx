import { useProfile } from '@/contexts/profile-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { getCoach } from '@/lib/coaches'
import { haptic } from '@/lib/haptics'
import { useEffect, useRef, useState } from 'react'
import {
  Dimensions,
  Image,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
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
  withDelay,
  withRepeat,
  withSequence,
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
  isFirstOpen?: boolean
}

// Coach-specific intro message for the create-post sheet (first time opening)
function getCoachIntroMessage(coachId: string, name?: string): string {
  const hi = name ? `Hey ${name}` : `Hey`
  switch (coachId) {
    case 'kino':
      return `${hi}. You can reach me directly from here. Ask me to build your workout, swap out exercises, adjust volume, or get advice on what you're logging. I'm here the whole session.`
    case 'maya':
      return `${hi}! 🌟 I'm right here with you while you build your workout! Ask me to generate a full session, add or swap exercises, or just get advice on what to log. Let's make this session great!`
    case 'ross':
    default:
      return `${hi}. You have direct access to me here throughout your session. I can help you structure your workout, suggest exercises based on evidence, adjust volume and intensity, or answer any training question. Just ask.`
  }
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
  isFirstOpen = false,
}: WorkoutCoachSheetProps) {
  const colors = useThemedColors()
  const insets = useSafeAreaInsets()
  const { coachId, profile } = useProfile()
  const firstName = profile?.display_name?.split(' ')[0]

  const [sheetHeight, setSheetHeight] = useState(INITIAL_SHEET_HEIGHT)
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const [chatHasStarted, setChatHasStarted] = useState(false)

  // Intro message state (only for first open)
  const [showIntro, setShowIntro] = useState(false)
  const [introText, setIntroText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const introOpacity = useSharedValue(0)
  const typingDotsOpacity = useSharedValue(0)
  const introRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  // Reset state when sheet opens
  useEffect(() => {
    if (visible) {
      translateY.value = 0
      haptic('medium')

      if (isFirstOpen) {
        setShowIntro(true)
        setIntroText('')
        setIsTyping(false)
        introOpacity.value = 0
        typingDotsOpacity.value = 0

        const introMessage = getCoachIntroMessage(coachId, firstName)

        // Show typing indicator after a short delay
        typingTimeoutRef.current = setTimeout(() => {
          setIsTyping(true)
          typingDotsOpacity.value = withTiming(1, { duration: 300 })

          // After "typing" duration, show the message
          introRef.current = setTimeout(() => {
            setIsTyping(false)
            typingDotsOpacity.value = withTiming(0, { duration: 200 })
            setIntroText(introMessage)
            introOpacity.value = withTiming(1, { duration: 400 })
          }, 1800)
        }, 600)
      } else {
        setShowIntro(false)
      }
    } else {
      // Clean up timers when closing
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      if (introRef.current) clearTimeout(introRef.current)
    }
  }, [
    visible,
    translateY,
    isFirstOpen,
    coachId,
    firstName,
    introOpacity,
    typingDotsOpacity,
  ])

  const closeSheet = () => {
    haptic('light')
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

  const animatedIntroStyle = useAnimatedStyle(() => ({
    opacity: introOpacity.value,
  }))

  const animatedTypingStyle = useAnimatedStyle(() => ({
    opacity: typingDotsOpacity.value,
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
                    // Extend the sheet slightly downward behind the keyboard corners
                    // while preserving the same visible top position.
                    marginBottom: Math.max(
                      0,
                      keyboardHeight -
                        26 +
                        10 -
                        (Platform.OS === 'ios' ? 22 : 0),
                    ),
                    // When keyboard is up, constrain height to max 75% of available space above keyboard
                    height:
                      Math.min(
                        INITIAL_SHEET_HEIGHT,
                        (SCREEN_HEIGHT - keyboardHeight) * 0.75,
                      ) + (Platform.OS === 'ios' ? 22 : 0),
                  }
                : null,
            ]}
          >
            {/* Handle */}
            <View style={styles.handleContainer}>
              <View style={styles.handle} />
            </View>

            {/* First-open intro message overlay */}
            {showIntro && !chatHasStarted && (
              <View style={styles.introContainer}>
                <View style={styles.introRow}>
                  <Image source={coach.image} style={styles.introAvatar} />
                  <View style={styles.introBubbleWrapper}>
                    {isTyping && (
                      <Animated.View
                        style={[styles.typingBubble, animatedTypingStyle]}
                      >
                        <View style={styles.typingDots}>
                          <TypingDot delay={0} colors={colors} />
                          <TypingDot delay={160} colors={colors} />
                          <TypingDot delay={320} colors={colors} />
                        </View>
                      </Animated.View>
                    )}
                    {introText.length > 0 && (
                      <Animated.View
                        style={[styles.introBubble, animatedIntroStyle]}
                      >
                        <Text style={styles.introText}>{introText}</Text>
                      </Animated.View>
                    )}
                  </View>
                </View>
              </View>
            )}

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
                onChatStarted={setChatHasStarted}
              />
            </View>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  )
}

function TypingDot({
  delay,
  colors,
}: {
  delay: number
  colors: ReturnType<typeof useThemedColors>
}) {
  const opacity = useSharedValue(0.3)

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 350 }),
          withTiming(0.3, { duration: 350 }),
        ),
        -1,
      ),
    )
  }, [opacity, delay])

  const dotStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))

  return (
    <Animated.View
      style={[
        {
          width: 7,
          height: 7,
          borderRadius: 3.5,
          backgroundColor: colors.textSecondary,
        },
        dotStyle,
      ]}
    />
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
      backgroundColor: colors.surfaceSheet,
      borderTopLeftRadius: 34,
      borderTopRightRadius: 34,
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
      borderColor: colors.surfaceSheet,
    },
    headerDescription: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    coachName: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    closeButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surfaceSubtle,
      justifyContent: 'center',
      alignItems: 'center',
    },
    chatContainer: {
      flex: 1,
      overflow: 'hidden',
    },
    introContainer: {
      paddingHorizontal: 16,
      paddingBottom: 8,
    },
    introRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 10,
    },
    introAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
    },
    introBubbleWrapper: {
      flex: 1,
    },
    typingBubble: {
      alignSelf: 'flex-start',
      backgroundColor: colors.surfaceSubtle,
      borderRadius: 18,
      borderBottomLeftRadius: 4,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    typingDots: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    introBubble: {
      alignSelf: 'flex-start',
      backgroundColor: colors.surfaceSubtle,
      borderRadius: 18,
      borderBottomLeftRadius: 4,
      paddingHorizontal: 14,
      paddingVertical: 11,
      maxWidth: '95%',
    },
    introText: {
      fontSize: 14.5,
      lineHeight: 21,
      color: colors.textPrimary,
      letterSpacing: -0.1,
    },
  })
