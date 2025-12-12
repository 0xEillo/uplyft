import { useAuth } from '@/contexts/auth-context'
import { useSubscription } from '@/contexts/subscription-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { getCoach } from '@/lib/coaches'
import { database } from '@/lib/database'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Keyboard,
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
import Markdown from 'react-native-markdown-display'
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Paywall } from './paywall'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')
const INITIAL_SHEET_HEIGHT = SCREEN_HEIGHT * 0.45
const MAX_SHEET_HEIGHT = SCREEN_HEIGHT * 0.8

interface WorkoutExercise {
  name: string
  setsCount: number
}

interface WorkoutContext {
  title: string
  notes: string
  exercises: WorkoutExercise[]
}

interface ExerciseSuggestion {
  name: string
  sets: number
  reps: string
  notes?: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  exerciseSuggestions?: ExerciseSuggestion[]
}

interface WorkoutCoachSheetProps {
  visible: boolean
  onClose: () => void
  workoutContext: WorkoutContext
  onAddExercise: (exercise: ExerciseSuggestion) => void
}

type SuggestionMode = 'main' | 'replace_exercise' | 'how_to'

const SUGGESTIONS = {
  main: [
    {
      id: 'adjust_workout',
      text: 'Adjust this workout',
      icon: 'flash-outline',
    },
    {
      id: 'replace_exercise',
      text: 'Replace exercise',
      icon: 'swap-horizontal-outline',
    },
    { id: 'how_to', text: 'How to...', icon: 'help-circle-outline' },
  ],
  how_to: [
    'Back Squat',
    'Barbell Row',
    'Bench Press',
    'Deadlift',
    'Overhead Press',
  ],
}

// Parse exercise suggestions from AI response
function parseExerciseSuggestions(content: string): ExerciseSuggestion[] {
  const suggestions: ExerciseSuggestion[] = []

  // Match patterns like "**Exercise Name** - 3 sets x 8-12 reps"
  // or "1. Exercise Name: 3x10"
  const patterns = [
    /\*\*([^*]+)\*\*[:\s-]*(\d+)\s*(?:sets?\s*[x×]\s*)?(\d+(?:-\d+)?)\s*reps?/gi,
    /^\d+\.\s*([^:]+):\s*(\d+)\s*[x×]\s*(\d+(?:-\d+)?)/gim,
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

export function WorkoutCoachSheet({
  visible,
  onClose,
  workoutContext,
  onAddExercise,
}: WorkoutCoachSheetProps) {
  const colors = useThemedColors()
  const insets = useSafeAreaInsets()
  const { user, session } = useAuth()
  const { isProMember } = useSubscription()
  const { weightUnit } = useWeightUnits()

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showPaywall, setShowPaywall] = useState(false)
  const [coachId, setCoachId] = useState<string>('ross')
  const [suggestionMode, setSuggestionMode] = useState<SuggestionMode>('main')
  const [sheetHeight, setSheetHeight] = useState(INITIAL_SHEET_HEIGHT)
  const [keyboardHeight, setKeyboardHeight] = useState(0)

  const scrollViewRef = useRef<ScrollView>(null)
  const inputRef = useRef<TextInput>(null)
  const translateY = useSharedValue(0)

  const styles = createStyles(colors, insets, sheetHeight)

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

  // Reset state when sheet opens and auto-focus input
  useEffect(() => {
    if (visible) {
      translateY.value = 0
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      // Auto-focus input after a short delay to ensure modal is rendered
      setTimeout(() => {
        inputRef.current?.focus()
      }, 300)
    } else {
      setKeyboardHeight(0)
    }
  }, [visible, translateY])

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(
        () => scrollViewRef.current?.scrollToEnd({ animated: true }),
        100,
      )
    }
  }, [messages.length])

  const closeSheet = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onClose()
  }, [onClose])

  // Gesture for dragging sheet
  const pan = Gesture.Pan()
    .onUpdate((event) => {
      // Allow dragging down (positive) or up (negative, to expand)
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

  // Build context-aware system prompt
  const buildSystemPrompt = useCallback(() => {
    const coach = getCoach(coachId)
    let contextInfo = ''

    if (workoutContext.exercises.length > 0) {
      const exerciseList = workoutContext.exercises
        .map((e) => `- ${e.name} (${e.setsCount} sets)`)
        .join('\n')
      contextInfo = `\n\nThe user is currently logging a workout${
        workoutContext.title ? ` titled "${workoutContext.title}"` : ''
      }. Their current exercises are:\n${exerciseList}\n\nWhen suggesting exercises, format them clearly so they can be added to the workout. Use this format: **Exercise Name** - X sets x Y-Z reps`
    } else if (workoutContext.title) {
      contextInfo = `\n\nThe user is starting a workout titled "${workoutContext.title}". They haven't added any exercises yet. Help them build their workout by suggesting relevant exercises.`
    }

    return coach.systemPrompt + contextInfo
  }, [coachId, workoutContext])

  const handleSendMessage = async (hiddenPrompt?: string) => {
    const messageContent = hiddenPrompt || input.trim()
    if (!messageContent || isLoading) return

    if (!isProMember) {
      setShowPaywall(true)
      return
    }

    if (!hiddenPrompt) {
      setInput('')
      inputRef.current?.clear()
    }
    Keyboard.dismiss()

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageContent,
    }
    // Only show user message if not a hidden prompt
    if (!hiddenPrompt) {
      setMessages((prev) => [...prev, userMessage])
    }
    setIsLoading(true)

    try {
      const { getSupabaseFunctionBaseUrl } = await import(
        '@/lib/supabase-functions-client'
      )

      const systemMessage = {
        role: 'system',
        content: buildSystemPrompt(),
      }

      const formattedMessages = [systemMessage, ...messages, userMessage].map(
        (m) => ({
          role: m.role,
          content: m.content,
        }),
      )

      const response = await fetch(`${getSupabaseFunctionBaseUrl()}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-no-stream': '1',
          ...(session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify({
          messages: formattedMessages,
          userId: user?.id,
          weightUnit,
        }),
      })

      if (!response.ok) {
        throw new Error(`Chat API error: ${response.status}`)
      }

      // Process streaming response
      const reader = response.body?.getReader()
      const assistantMessageId = (Date.now() + 1).toString()

      setMessages((prev) => [
        ...prev,
        { id: assistantMessageId, role: 'assistant', content: '' },
      ])

      if (reader) {
        const decoder = new TextDecoder()
        let fullContent = ''

        while (true) {
          const { value, done } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          fullContent += chunk

          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId ? { ...m, content: fullContent } : m,
            ),
          )
        }

        // Parse exercise suggestions from final content
        const suggestions = parseExerciseSuggestions(fullContent)
        if (suggestions.length > 0) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId
                ? { ...m, exerciseSuggestions: suggestions }
                : m,
            ),
          )
        }
      } else {
        const content = await response.text()
        const suggestions = parseExerciseSuggestions(content)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId
              ? { ...m, content, exerciseSuggestions: suggestions }
              : m,
          ),
        )
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
    }
  }

  const handleSuggestionClick = (
    item: string | { id: string; text: string },
  ) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    if (suggestionMode === 'main' && typeof item === 'object') {
      if (item.id === 'adjust_workout') {
        const exerciseNames = workoutContext.exercises
          .map((e) => e.name)
          .join(', ')
        const prompt = exerciseNames
          ? `I'm doing ${exerciseNames}. What exercises would complement this workout?`
          : 'What exercises should I add to my workout?'
        handleSendMessage(prompt)
      } else if (item.id === 'replace_exercise') {
        if (workoutContext.exercises.length === 0) {
          // No exercises to replace, send a prompt asking for suggestions
          handleSendMessage(
            'I want to add an exercise to my workout. What do you suggest?',
          )
        } else {
          setSuggestionMode('replace_exercise')
        }
      } else if (item.id === 'how_to') {
        setSuggestionMode('how_to')
        setInput('How to ')
        inputRef.current?.focus()
      }
    } else if (typeof item === 'string') {
      if (suggestionMode === 'replace_exercise') {
        // User selected an exercise to replace - send hidden prompt
        const prompt = `I want to replace "${item}" in my workout. What's a good alternative exercise that targets similar muscles?`
        setSuggestionMode('main')
        handleSendMessage(prompt)
      } else {
        setInput((prev) => prev + item)
        setSuggestionMode('main')
        inputRef.current?.focus()
      }
    }
  }

  const handleSuggestionBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSuggestionMode('main')
    if (input === 'How to ') {
      setInput('')
    }
  }

  const handleAddExercise = (suggestion: ExerciseSuggestion) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    onAddExercise(suggestion)
  }

  const handleNewChat = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setMessages([])
    setInput('')
    setSuggestionMode('main')
  }

  const coach = getCoach(coachId)

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
                    marginBottom: keyboardHeight - 26,
                    height: INITIAL_SHEET_HEIGHT,
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
              {messages.length > 0 && (
                <TouchableOpacity
                  style={styles.newChatButton}
                  onPress={handleNewChat}
                >
                  <Ionicons
                    name="create-outline"
                    size={20}
                    color={colors.primary}
                  />
                </TouchableOpacity>
              )}
            </View>

            {/* Suggestions */}
            {messages.length === 0 && (
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
                          style={[
                            styles.suggestionBubble,
                            item.id === 'adjust_workout' &&
                              styles.primaryBubble,
                          ]}
                          onPress={() => handleSuggestionClick(item)}
                        >
                          {item.id === 'adjust_workout' && (
                            <Ionicons
                              name="flash"
                              size={14}
                              color={colors.primary}
                              style={{ marginRight: 6 }}
                            />
                          )}
                          <Text
                            style={[
                              styles.suggestionText,
                              item.id === 'adjust_workout' &&
                                styles.primaryText,
                            ]}
                          >
                            {item.text}
                          </Text>
                        </TouchableOpacity>
                      ))
                    : suggestionMode === 'replace_exercise'
                    ? workoutContext.exercises.map((exercise, index) => (
                        <TouchableOpacity
                          key={index}
                          style={styles.suggestionBubble}
                          onPress={() => handleSuggestionClick(exercise.name)}
                        >
                          <Text style={styles.suggestionText}>
                            {exercise.name}
                          </Text>
                        </TouchableOpacity>
                      ))
                    : SUGGESTIONS.how_to.map((item, index) => (
                        <TouchableOpacity
                          key={index}
                          style={styles.suggestionBubble}
                          onPress={() => handleSuggestionClick(item)}
                        >
                          <Text style={styles.suggestionText}>{item}</Text>
                        </TouchableOpacity>
                      ))}
                </ScrollView>
              </View>
            )}

            {/* Messages */}
            <ScrollView
              ref={scrollViewRef}
              style={styles.messagesContainer}
              contentContainerStyle={styles.messagesContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={
                Platform.OS === 'ios' ? 'interactive' : 'on-drag'
              }
              showsVerticalScrollIndicator={false}
            >
              {messages.map((message) => (
                <View
                  key={message.id}
                  style={
                    message.role === 'user'
                      ? styles.userMessageContainer
                      : styles.assistantMessageContainer
                  }
                >
                  {message.role === 'user' ? (
                    <View style={styles.userBubble}>
                      <Text style={styles.userText}>{message.content}</Text>
                    </View>
                  ) : (
                    <View style={styles.assistantContent}>
                      <Markdown
                        style={{
                          body: {
                            fontSize: 16,
                            lineHeight: 22,
                            color: colors.text,
                          },
                          paragraph: { marginTop: 0, marginBottom: 8 },
                          strong: { fontWeight: '600' },
                        }}
                      >
                        {message.content}
                      </Markdown>

                      {/* Exercise Suggestion Cards */}
                      {message.exerciseSuggestions &&
                        message.exerciseSuggestions.length > 0 && (
                          <View style={styles.exerciseCardsContainer}>
                            {message.exerciseSuggestions.map(
                              (suggestion, idx) => (
                                <View key={idx} style={styles.exerciseCard}>
                                  <View style={styles.exerciseCardInfo}>
                                    <Text style={styles.exerciseCardName}>
                                      {suggestion.name}
                                    </Text>
                                    <Text style={styles.exerciseCardDetails}>
                                      {suggestion.sets} sets × {suggestion.reps}{' '}
                                      reps
                                    </Text>
                                  </View>
                                  <TouchableOpacity
                                    style={styles.addExerciseButton}
                                    onPress={() =>
                                      handleAddExercise(suggestion)
                                    }
                                  >
                                    <Ionicons
                                      name="add"
                                      size={20}
                                      color={colors.white}
                                    />
                                  </TouchableOpacity>
                                </View>
                              ),
                            )}
                          </View>
                        )}
                    </View>
                  )}
                </View>
              ))}

              {isLoading && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              )}
            </ScrollView>

            {/* Input */}
            <View style={styles.inputContainer}>
              <View style={styles.inputWrapper}>
                <TextInput
                  ref={inputRef}
                  style={styles.input}
                  placeholder="Type anything..."
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
                    <Ionicons name="arrow-up" size={18} color={colors.white} />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        </GestureDetector>

        <Paywall
          visible={showPaywall}
          onClose={() => setShowPaywall(false)}
          title="Try Pro for FREE!"
          message="AI coach is a Pro feature"
        />
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
    newChatButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.backgroundLight,
      justifyContent: 'center',
      alignItems: 'center',
    },
    suggestionsContainer: {
      paddingBottom: 12,
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
    primaryBubble: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}08`,
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
    primaryText: {
      color: colors.primary,
      fontWeight: '600',
    },
    messagesContainer: {
      flex: 1,
    },
    messagesContent: {
      paddingHorizontal: 16,
      paddingBottom: 8,
    },
    userMessageContainer: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginBottom: 12,
    },
    assistantMessageContainer: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
      marginBottom: 12,
    },
    userBubble: {
      maxWidth: '80%',
      backgroundColor: colors.primary,
      padding: 12,
      borderRadius: 16,
      borderBottomRightRadius: 4,
    },
    userText: {
      fontSize: 16,
      lineHeight: 20,
      color: colors.white,
    },
    assistantContent: {
      flex: 1,
    },
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
    exerciseCardName: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
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
    loadingContainer: {
      paddingVertical: 12,
      alignItems: 'flex-start',
    },
    inputContainer: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: Math.max(insets.bottom, 16),
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      backgroundColor: colors.backgroundLight,
      borderRadius: 24,
      paddingRight: 4,
      paddingLeft: 16,
      paddingVertical: 4,
    },
    input: {
      flex: 1,
      paddingTop: 8,
      paddingBottom: 8,
      marginRight: 8,
      fontSize: 16,
      lineHeight: 20,
      color: colors.text,
      maxHeight: 80,
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
  })
