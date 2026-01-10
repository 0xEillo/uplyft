import { AnimatedInput } from '@/components/animated-input'
import { ExerciseMediaThumbnail } from '@/components/ExerciseMedia'
import { HapticButton } from '@/components/haptic-button'
import {
  EQUIPMENT_PREF_KEY,
  WORKOUT_PLANNING_PREFS_KEY,
} from '@/components/workout-planning-wizard'
import { AnalyticsEvents } from '@/constants/analytics-events'
import {
  COMMITMENTS,
  EXPERIENCE_LEVELS,
  GENDERS,
  GOALS,
} from '@/constants/options'
import { useAnalytics } from '@/contexts/analytics-context'
import { useAuth } from '@/contexts/auth-context'
import { useProfile } from '@/contexts/profile-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { BodyPartSlug } from '@/lib/body-mapping'
import { COACH_OPTIONS, DEFAULT_COACH_ID } from '@/lib/coaches'
import { database } from '@/lib/database'
import { markUserAsRated, requestReview } from '@/lib/rating'
import { supabase } from '@/lib/supabase'
import { ExperienceLevel, Gender, Goal } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Picker } from '@react-native-picker/picker'
import { Asset } from 'expo-asset'
import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
} from 'react-native'
import Body from 'react-native-body-highlighter'
import ConfettiCannon from 'react-native-confetti-cannon'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

type OnboardingData = {
  name: string
  gender: Gender | null
  height_cm: string
  height_feet: string
  height_inches: string
  weight_kg: string
  birth_day: string
  birth_month: string
  birth_year: string
  goal: Goal[]
  commitment: string[]
  experience_level: ExperienceLevel | null
  equipment: string[]
  bio: string
  coach: string
}

// Colors type for themed colors
type ThemedColors = ReturnType<typeof useThemedColors>

// Step content props
interface StepContentProps {
  data: OnboardingData
  colors: ThemedColors
  styles: ReturnType<typeof createStyles>
}

interface ProcessingStepProps extends StepContentProps {
  setStep: (step: number) => void
}

interface CommitmentPledgeStepProps extends StepContentProps {
  insets: { top: number; bottom: number; left: number; right: number }
  onHoldingChange: (holding: boolean) => void
}

interface FinalPlanStepProps extends StepContentProps {
  weightUnit: string
}

// Map step numbers to their human-readable names
const STEP_NAMES: { [key: number]: string } = {
  1: 'coach_selection',
  2: 'coach_greeting',
  3: 'name_entry',
  4: 'chat_feature_intro',
  5: 'goals_selection',
  6: 'tailored_preview',
  7: 'gender_selection',
  8: 'commitment_level',
  9: 'habit_reinforcement',
  10: 'experience_level',
  11: 'equipment_selection',
  12: 'stats_entry',
  13: 'target_weight',
  14: 'body_scan_feature',
  15: 'focus_areas',
  16: 'processing',
  17: 'plan_ready',
  18: 'commitment_pledge',
}

const FadeInWords = ({
  text,
  style,
  delay = 150,
}: {
  text: string
  style: TextStyle
  delay?: number
}) => {
  const words = text.split(' ')
  const anims = useRef(words.map(() => new Animated.Value(0))).current

  useEffect(() => {
    // Add initial delay before starting the animation
    const timeout = setTimeout(() => {
      Animated.stagger(
        80,
        anims.map((anim) =>
          Animated.spring(anim, {
            toValue: 1,
            friction: 10,
            tension: 60,
            useNativeDriver: true,
          }),
        ),
      ).start()
    }, delay)

    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- animations are stable refs, run only on mount
  }, [])

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {words.map((word, i) => (
        <Animated.View
          key={i}
          style={{
            opacity: anims[i],
            transform: [
              {
                translateY: anims[i].interpolate({
                  inputRange: [0, 1],
                  outputRange: [10, 0],
                }),
              },
            ],
            marginRight: 8,
            marginBottom: 4,
          }}
        >
          <Text style={style}>{word}</Text>
        </Animated.View>
      ))}
    </View>
  )
}

// Animated Chat Mockup Component
const AnimatedChatMockup = ({
  colors,
  coach,
  userName,
}: {
  colors: ReturnType<typeof useThemedColors>
  coach: typeof COACH_OPTIONS[0]
  userName: string
}) => {
  // Get the coach's first name for personalized messages
  const coachFirstName = coach?.name.split(' ').pop() || 'Coach'
  const name = userName?.trim() || 'there'

  // Chat messages with personalized coach name and more natural conversation
  const chatMessages = [
    {
      role: 'coach',
      content: `Hey ${name}! Great session yesterday. How are the muscles feeling? Ready for more? 🔥`,
    },
    { role: 'user', content: 'Feeling good coach! Ready to crush it today.' },
    {
      role: 'coach',
      content: `That's what I like to hear. Today we're hitting Upper Body. I've tweaked your Bench Press targets based on that last PR! 😉`,
    },
    {
      role: 'user',
      content: "Sweet, I've been wanting to push it. Let's see it!",
    },
    {
      role: 'coach',
      content:
        "Here's the plan. We're going for 3 sets of 8. Let's get that pump! 🚀",
    },
  ]

  const [visibleMessages, setVisibleMessages] = useState<number[]>([])
  const messageAnims = useRef(
    Array(5)
      .fill(0)
      .map(() => new Animated.Value(0)),
  ).current
  const scaleAnims = useRef(
    Array(5)
      .fill(0)
      .map(() => new Animated.Value(0.8)),
  ).current

  useEffect(() => {
    // Animate messages appearing one by one
    const timeouts: ReturnType<typeof setTimeout>[] = []

    chatMessages.forEach((_, index) => {
      const timeout = setTimeout(() => {
        setVisibleMessages((prev) => [...prev, index])

        // Animate the message appearing with spring
        Animated.parallel([
          Animated.spring(messageAnims[index], {
            toValue: 1,
            damping: 12,
            stiffness: 100,
            useNativeDriver: true,
          }),
          Animated.spring(scaleAnims[index], {
            toValue: 1,
            damping: 15,
            stiffness: 120,
            useNativeDriver: true,
          }),
        ]).start()
      }, 200 + index * 350) // Stagger messages with 0.35s delay

      timeouts.push(timeout)
    })

    return () => timeouts.forEach((t) => clearTimeout(t))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- animations are stable refs, run only on mount
  }, [])

  return (
    <View style={chatMockupStyles.container}>
      {/* Phone Frame */}
      <View style={[chatMockupStyles.phoneFrame, { borderColor: '#1A1A1A' }]}>
        {/* Status Bar */}
        <View style={chatMockupStyles.statusBar}>
          <Text style={[chatMockupStyles.statusTime, { color: colors.text }]}>
            9:41
          </Text>
          <View style={chatMockupStyles.dynamicIsland} />
          <View style={chatMockupStyles.statusIcons}>
            <Ionicons name="cellular" size={14} color={colors.text} />
            <Ionicons name="wifi" size={14} color={colors.text} />
            <Ionicons name="battery-full" size={14} color={colors.text} />
          </View>
        </View>

        {/* Chat Header */}
        <View
          style={[
            chatMockupStyles.chatHeader,
            { borderBottomColor: colors.border },
          ]}
        >
          <Image
            source={coach?.image}
            style={chatMockupStyles.coachAvatarImage}
          />
          <Text style={[chatMockupStyles.chatTitle, { color: colors.text }]}>
            {coachFirstName}
          </Text>
        </View>

        {/* Messages Container */}
        <ScrollView
          style={[
            chatMockupStyles.messagesContainer,
            { backgroundColor: colors.background },
          ]}
          contentContainerStyle={chatMockupStyles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {chatMessages.map((message, index) => {
            const isCoach = message.role === 'coach'
            const isVisible = visibleMessages.includes(index)

            if (!isVisible) return null

            return (
              <Animated.View
                key={index}
                style={[
                  chatMockupStyles.messageRow,
                  !isCoach && chatMockupStyles.userMessageRow,
                  {
                    opacity: messageAnims[index],
                    transform: [
                      { scale: scaleAnims[index] },
                      {
                        translateY: messageAnims[index].interpolate({
                          inputRange: [0, 1],
                          outputRange: [20, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                {isCoach && (
                  <Image
                    source={coach?.image}
                    style={chatMockupStyles.messageAvatarImage}
                  />
                )}
                <View
                  style={[
                    chatMockupStyles.messageBubble,
                    isCoach
                      ? [
                          chatMockupStyles.coachBubble,
                          { backgroundColor: colors.backgroundWhite },
                        ]
                      : [
                          chatMockupStyles.userBubble,
                          { backgroundColor: colors.primary },
                        ],
                  ]}
                >
                  <Text
                    style={[
                      chatMockupStyles.messageText,
                      { color: isCoach ? colors.text : '#fff' },
                    ]}
                  >
                    {message.content}
                  </Text>
                </View>
              </Animated.View>
            )
          })}
        </ScrollView>

        {/* Input Bar */}
        <View
          style={[
            chatMockupStyles.inputBar,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.border,
            },
          ]}
        >
          <View
            style={[
              chatMockupStyles.inputField,
              {
                backgroundColor: colors.backgroundWhite,
                borderColor: colors.border,
              },
            ]}
          >
            <Text
              style={[
                chatMockupStyles.inputPlaceholder,
                { color: colors.textSecondary },
              ]}
            >
              Message...
            </Text>
          </View>
          <View
            style={[
              chatMockupStyles.sendButton,
              { backgroundColor: colors.primary },
            ]}
          >
            <Ionicons name="send" size={12} color="#fff" />
          </View>
        </View>
      </View>
    </View>
  )
}

// Styles for the chat mockup
const chatMockupStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  phoneFrame: {
    width: SCREEN_WIDTH * 0.72,
    height: SCREEN_WIDTH * 1.45,
    borderRadius: 40,
    borderWidth: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 20,
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  statusTime: {
    fontSize: 12,
    fontWeight: '600',
  },
  dynamicIsland: {
    width: 80,
    height: 24,
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
  },
  statusIcons: {
    flexDirection: 'row',
    gap: 4,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    gap: 8,
  },
  coachAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 10,
    gap: 8,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  userMessageRow: {
    justifyContent: 'flex-end',
  },
  messageAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageBubble: {
    maxWidth: '78%',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 14,
  },
  coachBubble: {
    borderBottomLeftRadius: 4,
  },
  userBubble: {
    borderBottomRightRadius: 4,
  },
  messageText: {
    fontSize: 12,
    lineHeight: 16,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
    borderTopWidth: 0.5,
  },
  inputField: {
    flex: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 0.5,
  },
  inputPlaceholder: {
    fontSize: 11,
  },
  sendButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachAvatarImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  messageAvatarImage: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
})

const HabitReinforcementStepContent = ({
  data,
  colors,
  styles,
}: StepContentProps) => {
  useEffect(() => {
    const triggerReview = async () => {
      try {
        await requestReview()
        await markUserAsRated()
      } catch (error) {
        console.error('Error requesting review in habit step:', error)
      }
    }

    const timeoutId = setTimeout(() => {
      triggerReview()
    }, 200)

    return () => clearTimeout(timeoutId)
  }, [])

  const activeGoal = data.goal[0] || 'build_muscle'
  const habitGoalInfo: Record<string, { text: string; color: string }> = {
    build_muscle: { text: 'GAIN MUSCLE', color: '#8B5CF6' },
    lose_fat: { text: 'LOSE FAT', color: '#EF4444' },
    gain_strength: { text: 'GET STRONGER', color: '#F59E0B' },
    improve_cardio: { text: 'IMPROVE CARDIO', color: '#3B82F6' },
    become_flexible: { text: 'GET FLEXIBLE', color: '#10B981' },
    general_fitness: { text: 'STAY FIT', color: '#6366F1' },
  }
  const currentHabitGoal =
    habitGoalInfo[activeGoal] || habitGoalInfo.build_muscle

  return (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <Text
          style={[
            styles.stepTitle,
            { fontSize: 34, lineHeight: 42, fontWeight: '800' },
          ]}
        >
          Great! It&rsquo;s easier to{' '}
          <Text
            style={{
              color: currentHabitGoal.color,
              fontStyle: 'italic',
              fontWeight: '900',
              fontFamily: 'System',
            }}
          >
            {currentHabitGoal.text}
          </Text>{' '}
          when you already have good fitness habits.
        </Text>
      </View>
    </View>
  )
}

const ProcessingStepContent = ({
  data,
  setStep,
  colors,
  styles,
}: ProcessingStepProps) => {
  const [progress1, setProgress1] = useState(0)
  const [progress2, setProgress2] = useState(0)
  const [progress3, setProgress3] = useState(0)
  const [testimonialIndex, setTestimonialIndex] = useState(0)

  const testimonials = [
    {
      id: 1,
      name: 'Mike T.',
      time: '6 months training with Rep AI',
      text:
        "I've seen more progress in the last 6 months with Rep AI than I did in the previous 2 years on my own. The tailored workouts are exactly what I needed.",
      rating: 5,
      avatar:
        'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=facearea&facepad=2&w=300&h=300&q=80',
    },
    {
      id: 2,
      name: 'Sarah L.',
      time: '3 months training with Rep AI',
      text:
        'Finally an app that actually adapts to my progress! Down 12lbs and feeling stronger than ever. The AI coach feels like having a real trainer in my pocket.',
      rating: 5,
      avatar:
        'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=facearea&facepad=2&w=300&h=300&q=80',
    },
    {
      id: 3,
      name: 'David R.',
      time: '1 year training with Rep AI',
      text:
        "The workout variety is insane and the UI is so sleek. Best fitness investment I've made this year. I actually look forward to my sessions now!",
      rating: 5,
      avatar:
        'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=300&h=300&q=80',
    },
    {
      id: 4,
      name: 'Jessica M.',
      time: '4 months training with Rep AI',
      text:
        "The AI coaching is a game changer for my busy schedule. I don't have to think about what to do next, I just follow the plan and get results!",
      rating: 5,
      avatar:
        'https://images.unsplash.com/photo-1594381898411-846e7d193883?auto=format&fit=facearea&facepad=2&w=300&h=300&q=80',
    },
  ]

  const testimonialFadeAnim = useRef(new Animated.Value(1)).current

  useEffect(() => {
    const t1 = setInterval(() => {
      setProgress1((prev) => {
        if (prev >= 100) {
          clearInterval(t1)
          return 100
        }
        return prev + 3.5
      })
    }, 30)

    const t2 = setInterval(() => {
      setProgress2((prev) => {
        if (prev >= 100) {
          clearInterval(t2)
          return 100
        }
        // Only progress if first bar is far enough
        return progress1 > 30 ? prev + 2.5 : prev
      })
    }, 40)

    const t3 = setInterval(() => {
      setProgress3((prev) => {
        if (prev >= 100) {
          clearInterval(t3)
          return 100
        }
        // Only progress if second bar is far enough
        return progress2 > 30 ? prev + 2 : prev
      })
    }, 50)

    return () => {
      clearInterval(t1)
      clearInterval(t2)
      clearInterval(t3)
    }
  }, [progress1, progress2])

  useEffect(() => {
    const tTestimonial = setInterval(() => {
      Animated.timing(testimonialFadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setTestimonialIndex((prev) => (prev + 1) % testimonials.length)
        Animated.timing(testimonialFadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start()
      })
    }, 2500)

    return () => clearInterval(tTestimonial)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- animations are stable refs, run only on mount
  }, [])

  useEffect(() => {
    if (progress3 >= 100) {
      setTimeout(() => setStep(17), 400)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setStep is stable from parent
  }, [progress3])

  const mainGoalLabel =
    GOALS.find((g) => g.value === data.goal[0])?.label || 'Fitness'
  const coloredGoal = mainGoalLabel.toLowerCase()

  return (
    <View style={styles.stepContainer}>
      <View style={styles.processingHeader}>
        <Text style={styles.processingTitle}>
          Tweaking your{' '}
          <Text
            style={{
              color: '#A855F7',
              fontFamily: 'System',
              fontStyle: 'italic',
              fontWeight: '900',
            }}
          >
            {coloredGoal}
          </Text>{' '}
          plan
        </Text>
      </View>

      <View style={styles.progressSection}>
        <View style={styles.progressItem}>
          <View style={styles.progressLabelRow}>
            <Text style={styles.progressLabel}>Your Body...</Text>
            <Text style={styles.progressPercent}>{Math.round(progress1)}%</Text>
          </View>
          <View style={styles.progressBarBg}>
            <Animated.View
              style={[styles.progressBarFill, { width: `${progress1}%` }]}
            />
          </View>
        </View>

        <View style={styles.progressItem}>
          <View style={styles.progressLabelRow}>
            <Text style={styles.progressLabel}>Your Activity Level...</Text>
            <Text style={styles.progressPercent}>{Math.round(progress2)}%</Text>
          </View>
          <View style={styles.progressBarBg}>
            <Animated.View
              style={[styles.progressBarFill, { width: `${progress2}%` }]}
            />
          </View>
        </View>

        <View style={styles.progressItem}>
          <View style={styles.progressLabelRow}>
            <Text style={styles.progressLabel}>
              Your Workout Preferences...
            </Text>
            <Text style={styles.progressPercent}>{Math.round(progress3)}%</Text>
          </View>
          <View style={styles.progressBarBg}>
            <Animated.View
              style={[styles.progressBarFill, { width: `${progress3}%` }]}
            />
          </View>
        </View>
      </View>

      <View style={styles.socialProofSection}>
        <View style={styles.appStoreBadge}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ionicons name="leaf" size={24} color="#000" />
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.ratingValue}>5.0 on App Store</Text>
              <View style={{ flexDirection: 'row', gap: 2 }}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <Ionicons key={s} name="star" size={12} color="#F59E0B" />
                ))}
              </View>
            </View>
            <Ionicons
              name="leaf"
              size={24}
              color="#000"
              style={{ transform: [{ scaleX: -1 }] }}
            />
          </View>
        </View>

        <Animated.View
          style={[styles.testimonialCard, { opacity: testimonialFadeAnim }]}
        >
          <View style={styles.testimonialHeader}>
            <Image
              source={{ uri: testimonials[testimonialIndex].avatar }}
              style={styles.testimonialAvatar}
            />
            <View>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                <Text style={styles.testimonialName}>
                  {testimonials[testimonialIndex].name}
                </Text>
                <Ionicons name="logo-facebook" size={14} color="#1877F2" />
              </View>
              <Text style={styles.testimonialTime}>
                {testimonials[testimonialIndex].time}
              </Text>
            </View>
          </View>
          <Text style={styles.testimonialText}>
            {testimonials[testimonialIndex].text}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Text style={styles.testimonialSource}>
              — Facebook Community Group
            </Text>
            <View style={{ flexDirection: 'row', gap: 2 }}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Ionicons key={s} name="star" size={10} color="#F59E0B" />
              ))}
            </View>
          </View>
        </Animated.View>

        <View style={styles.testimonialDots}>
          {testimonials.map((_, i) => (
            <View
              key={i}
              style={[
                styles.testimonialDot,
                i === testimonialIndex && styles.testimonialDotActive,
              ]}
            />
          ))}
        </View>
      </View>
    </View>
  )
}

const CommitmentStepContent = ({
  data,
  setStep,
  onNext,
  colors,
  styles,
  insets,
  onHoldingChange,
}: CommitmentPledgeStepProps & {
  setStep: (step: number) => void
  onNext: () => void
}) => {
  const [holding, setHolding] = useState(false)
  const [isCommitted, setIsCommitted] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const progress = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(1)).current
  const waveAnim = useRef(new Animated.Value(0)).current
  const confettiRef = useRef<any>(null)

  const coach =
    COACH_OPTIONS.find((c) => c.id === data.coach) || COACH_OPTIONS[0]
  const coachFirstName = coach.name.split(' ')[0]

  useEffect(() => {
    Animated.loop(
      Animated.timing(waveAnim, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- animations are stable refs, run only on mount
  }, [])

  useEffect(() => {
    if (isCommitted) {
      const timer = setTimeout(() => setShowSuccess(true), 800)
      return () => clearTimeout(timer)
    }
  }, [isCommitted])

  const handlePressIn = () => {
    if (isCommitted) return
    setHolding(true)
    onHoldingChange?.(true)

    // Scale down button slightly
    Animated.spring(scaleAnim, {
      toValue: 0.9,
      useNativeDriver: true,
    }).start()

    Animated.timing(progress, {
      toValue: 1,
      duration: 3000,
      easing: Easing.inOut(Easing.ease), // Smoother rise
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        setIsCommitted(true)
        setHolding(false)
        // Celebration!
        confettiRef.current?.start()
      }
    })
  }

  const handlePressOut = () => {
    if (isCommitted) return
    setHolding(false)
    onHoldingChange?.(false)
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start()

    if (!isCommitted) {
      // Stop the current fill animation and get the current progress value
      progress.stopAnimation((currentValue) => {
        // Animate back down with duration proportional to how far it went up
        // Full 3000ms up = proportionally less going back down, but at least 300ms
        const reverseDuration = Math.max(currentValue * 1500, 300)
        Animated.timing(progress, {
          toValue: 0,
          duration: reverseDuration,
          easing: Easing.out(Easing.ease),
          useNativeDriver: false,
        }).start()
      })
    }
  }

  // Text Logic
  const coachText = isCommitted
    ? "That's how you take charge of your fitness! 💪"
    : "Let's gain muscles, for good! 💪"

  const screenHeight = Dimensions.get('window').height
  const riseTransY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [screenHeight, -100],
  })

  // Calculate the counter-movement for the text so it appears fixed on screen
  // while the masking container moves up.
  const textTranslateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-screenHeight, 100], // Exact opposite of riseTransY
  })

  // Styles to break out of parent padding
  const breakoutStyle = {
    marginHorizontal: -24,
    marginTop: 0, // Removed negative margin to stay below header correctly
    marginBottom: -60,
    flex: 1,
  }

  const spin = waveAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  })

  return (
    <View style={[styles.stepContainer, breakoutStyle]}>
      {/* Confetti Celebration */}
      <ConfettiCannon
        ref={confettiRef}
        count={150}
        origin={{ x: SCREEN_WIDTH / 2, y: -20 }}
        autoStart={false}
        fadeOut
        explosionSpeed={350}
        fallSpeed={3000}
        colors={[
          colors.primary,
          '#FFD700',
          '#FFA500',
          '#FF6B35',
          '#4ECDC4',
          '#A855F7',
        ]}
      />

      {/* Rising Water Animation Layer */}
      <View
        style={[StyleSheet.absoluteFill, { zIndex: 10, elevation: 10 }]}
        pointerEvents="none"
      >
        {/* 1. Water Backdrop (Orange with Waves) */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              transform: [{ translateY: riseTransY }],
              backgroundColor: 'transparent', // Container is transparent
            },
          ]}
        >
          {/* The Water Body */}
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: screenHeight * 2, // plenty of height
              backgroundColor: '#F97316',
            }}
          />

          {/* Rotating Waves sitting on TOP of the orange block */}
          <Animated.View
            style={{
              position: 'absolute',
              top: -300,
              left: '-50%',
              width: 1000,
              height: 1000,
              backgroundColor: '#F97316', // Same as body
              borderRadius: 420,
              transform: [{ rotate: spin }],
            }}
          />
          <Animated.View
            style={{
              position: 'absolute',
              top: -320,
              right: '-40%',
              width: 900,
              height: 900,
              backgroundColor: '#F97316',
              borderRadius: 400, // slightly different for chaos
              transform: [{ rotate: spin }],
            }}
          />
        </Animated.View>

        {/* 2. Text Content Mask (The emerging white text) */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              transform: [{ translateY: riseTransY }],
              zIndex: 20,
              overflow: 'hidden', // This doesn't strictly mask like MaskedView in RN Web/simple views but works for reveal if we replicate content
              // However, for this visual effect, we just need the text to "appear" as water passes
              // A simple way is to just have the text INSIDE the rising view fixed to screen coordinates
            },
          ]}
        >
          <Animated.View
            style={{
              height: screenHeight,
              width: '100%',
              position: 'absolute',
              // We need to counteract the translation to keep text fixed on screen
              transform: [{ translateY: textTranslateY }],
              alignItems: 'center',
              justifyContent: 'center',
              top: 0,
            }}
          >
            {/* 
                     We use a simple View here since the transform is applied to the parent 
                     Absolute container above. 
                 */}
            <View
              style={{
                width: '100%',
                height: screenHeight,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View
                style={{
                  alignItems: 'center',
                  width: '100%',
                  paddingHorizontal: 40,
                }}
              >
                <Animated.View
                  style={{
                    marginBottom: 40,
                    width: 140,
                    height: 140,
                    borderRadius: 70,
                    borderWidth: isCommitted ? 0 : 4,
                    borderColor: 'rgba(255,255,255,0.4)',
                    backgroundColor: isCommitted
                      ? 'rgba(255,255,255,0.2)'
                      : 'transparent',
                    justifyContent: 'center',
                    alignItems: 'center',
                    transform: [{ scale: scaleAnim }],
                    shadowColor: '#fff',
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: isCommitted ? 0.4 : 0,
                    shadowRadius: 30,
                    elevation: isCommitted ? 10 : 0,
                  }}
                >
                  <View
                    style={{
                      width: 100,
                      height: 100,
                      borderRadius: 50,
                      backgroundColor: 'rgba(255,255,255,0.25)',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <Ionicons
                      name={isCommitted ? 'checkmark' : 'flash'}
                      size={64}
                      color="white"
                    />
                  </View>
                </Animated.View>

                <Text
                  style={{
                    color: 'white',
                    fontSize: 34,
                    fontWeight: '800',
                    marginBottom: 12,
                    textAlign: 'center',
                    letterSpacing: -1,
                  }}
                >
                  {isCommitted ? 'You are committed!' : 'Keep holding!'}
                </Text>
                <Text
                  style={{
                    color: 'white',
                    fontSize: 18,
                    opacity: 0.85,
                    textAlign: 'center',
                    fontWeight: '500',
                    lineHeight: 24,
                  }}
                >
                  {isCommitted
                    ? "The hardest part is over. Let's build your future."
                    : 'Commitment takes discipline.'}
                </Text>
              </View>
            </View>
          </Animated.View>
        </Animated.View>
      </View>

      {/* Main Content Area */}
      <View
        style={{
          flex: 1,
          paddingHorizontal: 24,
          paddingTop: 50 + (insets?.top || 0), // Match standard header spacing
          justifyContent: 'space-between',
        }}
      >
        <View style={{ width: '100%' }}>
          {/* Coach Message */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              gap: 12,
              marginTop: 20,
              opacity: holding ? 0 : 1,
            }}
          >
            <Image
              source={coach.image}
              style={{ width: 48, height: 48, borderRadius: 24 }}
            />
            <View>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: colors.textSecondary,
                  marginBottom: 4,
                }}
              >
                Coach {coachFirstName}
              </Text>
              <View
                style={{
                  backgroundColor: colors.backgroundWhite,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderRadius: 20,
                  borderBottomLeftRadius: 4,
                  maxWidth: 260,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text
                  style={{ fontSize: 16, lineHeight: 22, color: colors.text }}
                >
                  {coachText}
                </Text>
              </View>
            </View>
          </View>

          {/* Simple Clean Pledge Text */}
          {!isCommitted && !holding && (
            <View style={{ marginTop: 24, paddingHorizontal: 4 }}>
              <Text style={styles.stepTitle}>I, {data.name || 'User'},</Text>
              <Text
                style={{
                  fontSize: 20,
                  lineHeight: 32,
                  color: colors.textSecondary,
                  fontWeight: '500',
                  marginTop: 8,
                }}
              >
                commit to pushing my limits, fueling my body, and showing up
                with discipline. This is about progress, not perfection.
              </Text>
            </View>
          )}

          {/* Committed Badge */}
          {isCommitted && (
            <Animated.View style={{ marginTop: 40, alignSelf: 'flex-start' }}>
              <View
                style={{
                  backgroundColor: colors.primary,
                  paddingVertical: 12,
                  paddingHorizontal: 20,
                  borderRadius: 100,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  shadowColor: colors.primary,
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 4 },
                }}
              >
                <Text
                  style={{ color: 'white', fontSize: 16, fontWeight: '700' }}
                >
                  Committed
                </Text>
                <Text style={{ fontSize: 16 }}>🤝</Text>
              </View>
            </Animated.View>
          )}
        </View>

        {/* Bottom Interactive Area */}
        <View
          style={[
            styles.footer,
            {
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 50,
              elevation: 50,
              paddingBottom: Math.max(insets?.bottom || 0, 20) + 20,
            },
          ]}
        >
          {!isCommitted && (
            <View
              style={{ alignItems: 'center', width: '100%', marginBottom: 20 }}
            >
              <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                <TouchableOpacity
                  activeOpacity={1}
                  onPressIn={handlePressIn}
                  onPressOut={handlePressOut}
                  style={{
                    width: 140,
                    height: 140,
                    borderRadius: 70,
                    backgroundColor: '#F97316',
                    justifyContent: 'center',
                    alignItems: 'center',
                    shadowColor: '#F97316',
                    shadowOpacity: 0.4,
                    shadowRadius: 16,
                    shadowOffset: { width: 0, height: 8 },
                    elevation: 8,
                    marginBottom: 24,
                    borderWidth: 6,
                    borderColor: '#fff',
                  }}
                >
                  <Ionicons name="flash" size={56} color="white" />
                </TouchableOpacity>
              </Animated.View>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '700',
                  color: holding ? 'transparent' : '#fff',
                }}
              >
                Tap and hold to commit
              </Text>
            </View>
          )}

          {isCommitted && showSuccess && (
            <HapticButton
              style={[
                styles.nextButton,
                {
                  backgroundColor: 'white',
                  shadowColor: '#000',
                  shadowOpacity: 0.15,
                },
              ]}
              onPress={onNext}
              hapticStyle="heavy"
            >
              <Text style={[styles.nextButtonText, { color: colors.primary }]}>
                Continue
              </Text>
            </HapticButton>
          )}
        </View>
      </View>
    </View>
  )
}

const FinalPlanStepContent = ({
  data,
  colors,
  styles,
  weightUnit,
}: FinalPlanStepProps) => {
  const mainGoal =
    GOALS.find((g) => g.value === data.goal[0])?.label || 'Gain Muscle'

  // Calculate age
  let displayAge = '35'
  if (data.birth_year) {
    displayAge = (
      new Date().getFullYear() - parseInt(data.birth_year)
    ).toString()
  }

  const stats = [
    { label: 'Goal', value: mainGoal },
    { label: 'Age', value: displayAge },
    {
      label: 'Gender',
      value: data.gender
        ? data.gender.charAt(0).toUpperCase() + data.gender.slice(1)
        : 'Male',
    },
    {
      label: 'Fitness Level',
      value: data.experience_level
        ? data.experience_level.charAt(0).toUpperCase() +
          data.experience_level.slice(1)
        : 'Beginner',
    },
    { label: 'Weight', value: `${data.weight_kg} ${weightUnit}` },
    { label: 'Optimal Intensity', value: 'Moderate' },
  ]

  const planImage =
    data.gender === 'female'
      ? require('@/assets/images/female_plan_preview.png')
      : require('@/assets/images/male_plan_preview.png')

  return (
    <View style={styles.stepContainer}>
      <View style={styles.planReadyHeader}>
        <Text style={styles.planReadyTitle}>
          {data.name || 'Oli'}, your plan{'\n'}is ready!
        </Text>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryCardTitle}>It&apos;s all about you</Text>
        <View style={styles.summaryGrid}>
          {stats.map((stat, i) => (
            <View key={i} style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{stat.label}</Text>
              <Text style={styles.summaryValue}>{stat.value}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.customCraftedSection}>
        <Text style={styles.customCraftedTitle}>Custom-Crafted</Text>

        <View style={styles.planPreviewCard}>
          <Image source={planImage} style={styles.planPreviewImage} />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.95)']}
            style={styles.planPreviewGradient}
          >
            <View style={styles.planPreviewContent}>
              <Text style={styles.planPreviewName}>{mainGoal}</Text>
              <Text style={styles.planPreviewDesc}>
                Achieve an aesthetic physique with a focus on strength and
                hypertrophy.
              </Text>

              <View style={styles.planPreviewStats}>
                <View style={styles.planStatItem}>
                  <Ionicons name="bar-chart" size={18} color="#fff" />
                  <Text style={styles.planStatValue}>Advanced</Text>
                  <Text style={styles.planStatLabel}>Level</Text>
                </View>
                <View style={styles.planStatDivider} />
                <View style={styles.planStatItem}>
                  <Ionicons name="barbell" size={18} color="#fff" />
                  <Text style={styles.planStatValue}>Gym</Text>
                  <Text style={styles.planStatLabel}>Location</Text>
                </View>
                <View style={styles.planStatDivider} />
                <View style={styles.planStatItem}>
                  <Ionicons name="time-outline" size={18} color="#fff" />
                  <Text style={styles.planStatValue}>60 min</Text>
                  <Text style={styles.planStatLabel}>Duration</Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        </View>
      </View>
    </View>
  )
}

export default function OnboardingScreen() {
  const { signInAnonymously, user } = useAuth()
  const { refreshProfile } = useProfile()
  const insets = useSafeAreaInsets()
  const [step, setStep] = useState(1)
  const [isCommitmentHolding, setIsCommitmentHolding] = useState(false)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [targetWeight, setTargetWeight] = useState<number>(75)
  const [focusAreas, setFocusAreas] = useState<BodyPartSlug[]>([])
  const [data, setData] = useState<OnboardingData>({
    name: '',
    gender: null,
    height_cm: '170',
    height_feet: '5',
    height_inches: '7',
    weight_kg: '75',
    birth_day: '1',
    birth_month: '1',
    birth_year: '2001', // Average age 25 (Current year 2026)
    goal: [],
    commitment: [],
    experience_level: null,
    equipment: [],
    bio: '',
    coach: DEFAULT_COACH_ID,
  })
  const colors = useThemedColors()
  const { weightUnit, setWeightUnit, convertInputToKg } = useWeightUnits()
  const { trackEvent } = useAnalytics()
  const styles = createStyles(colors, weightUnit)

  // Animation refs for step transitions
  const fadeAnim = useRef(new Animated.Value(1)).current
  const slideAnim = useRef(new Animated.Value(0)).current
  const prevStep = useRef(step)

  // Progress dot animations
  const progressDotAnims = useRef(
    Array.from({ length: 15 }, () => new Animated.Value(1)),
  ).current

  const scrollViewRef = useRef<ScrollView>(null)

  // Reset scroll position for specific steps
  useEffect(() => {
    if (step === 18) {
      scrollViewRef.current?.scrollTo({ x: 0, y: 0, animated: false })
    }
  }, [step])

  // Preload coach images on mount
  useEffect(() => {
    const preloadImages = async () => {
      const imageAssets = COACH_OPTIONS.map((coach) =>
        Asset.fromModule(coach.image).downloadAsync(),
      )
      await Promise.all(imageAssets)
    }
    preloadImages()
  }, [])

  // Animate step transitions
  useEffect(() => {
    if (prevStep.current !== step) {
      const targetHasNativePicker = false

      // Start from right, slide and fade in
      fadeAnim.stopAnimation()
      slideAnim.stopAnimation()

      if (targetHasNativePicker) {
        fadeAnim.setValue(1)
        slideAnim.setValue(0)
      } else {
        fadeAnim.setValue(0)
        slideAnim.setValue(30)

        Animated.parallel([
          Animated.spring(fadeAnim, {
            toValue: 1,
            damping: 20,
            stiffness: 150,
            mass: 1,
            useNativeDriver: true,
          }),
          Animated.spring(slideAnim, {
            toValue: 0,
            damping: 20,
            stiffness: 150,
            mass: 1,
            useNativeDriver: true,
          }),
        ]).start()
      }

      // Animate progress dot
      if (step >= 1 && step <= 15) {
        Animated.sequence([
          Animated.spring(progressDotAnims[step - 1], {
            toValue: 1.3,
            useNativeDriver: true,
            tension: 200,
            friction: 10,
          }),
          Animated.spring(progressDotAnims[step - 1], {
            toValue: 1,
            useNativeDriver: true,
            tension: 200,
            friction: 10,
          }),
        ]).start()
      }

      prevStep.current = step
    }
  }, [step, fadeAnim, slideAnim, progressDotAnims])

  // Avoid transform animations on steps with native Picker to prevent layout glitches (iOS)
  const stepHasNativePicker = false

  // Reset slide animation for native picker steps
  useEffect(() => {
    // No native picker steps remaining
  }, [step, slideAnim])

  // Track step views
  useEffect(() => {
    trackEvent(AnalyticsEvents.ONBOARDING_STEP_VIEWED, {
      step,
      step_name: STEP_NAMES[step],
    })
  }, [step, trackEvent])

  const handleNext = () => {
    trackEvent(AnalyticsEvents.ONBOARDING_STEP_COMPLETED, {
      step,
      step_name: STEP_NAMES[step],
    })

    // Save goal preference when leaving goal selection step
    // This pre-fills the "Goal" in the workout generation wizard
    if (step === 5 && data.goal.length > 0) {
      const primaryGoal = data.goal[0]
      let wizardGoal = 'Hypertrophy'

      switch (primaryGoal) {
        case 'gain_strength':
          wizardGoal = 'Strength'
          break
        case 'build_muscle':
          wizardGoal = 'Hypertrophy'
          break
        case 'lose_fat':
          wizardGoal = 'Fat Loss / HIIT'
          break
        case 'improve_cardio':
          wizardGoal = 'Endurance'
          break
        case 'become_flexible':
        case 'general_fitness':
          wizardGoal = 'General Fitness'
          break
      }

      AsyncStorage.getItem(WORKOUT_PLANNING_PREFS_KEY).then((prefsJson) => {
        let prefs = { goal: '', muscles: '', duration: '', specifics: '' }
        if (prefsJson) {
          try {
            prefs = { ...prefs, ...JSON.parse(prefsJson) }
          } catch {}
        }
        AsyncStorage.setItem(
          WORKOUT_PLANNING_PREFS_KEY,
          JSON.stringify({ ...prefs, goal: wizardGoal }),
        )
      })
    }

    // Save equipment preference to AsyncStorage when leaving equipment step
    // This will be used by the workout wizard to pre-fill the equipment setting
    if (step === 11 && data.equipment.length > 0) {
      let equipmentType = 'home_minimal'

      if (data.equipment.includes('full_gym')) {
        equipmentType = 'full_gym'
      } else if (data.equipment.includes('machines')) {
        // Machines implies gym access
        equipmentType = 'full_gym'
      } else if (
        data.equipment.includes('barbells') &&
        data.equipment.includes('dumbbells')
      ) {
        equipmentType = 'full_gym'
      } else if (data.equipment.includes('barbells')) {
        equipmentType = 'barbell_only'
      } else if (data.equipment.includes('dumbbells')) {
        equipmentType = 'dumbbells_only'
      } else if (data.equipment.includes('kettlebells')) {
        // Kettlebells are similar to dumbbells for workout planning
        equipmentType = 'dumbbells_only'
      } else if (data.equipment.includes('none')) {
        equipmentType = 'bodyweight'
      }

      AsyncStorage.setItem(EQUIPMENT_PREF_KEY, JSON.stringify(equipmentType))
    }

    // Initialize target weight when entering step 12
    if (step === 11 && data.weight_kg) {
      setTargetWeight(parseFloat(data.weight_kg))
    }

    if (step < 18) {
      setStep(step + 1)
    } else {
      // Calculate age from birth date
      let age = null
      if (data.birth_day && data.birth_month && data.birth_year) {
        const birthDate = new Date(
          parseInt(data.birth_year),
          parseInt(data.birth_month) - 1,
          parseInt(data.birth_day),
        )
        const today = new Date()
        age = today.getFullYear() - birthDate.getFullYear()
        const monthDiff = today.getMonth() - birthDate.getMonth()
        if (
          monthDiff < 0 ||
          (monthDiff === 0 && today.getDate() < birthDate.getDate())
        ) {
          age--
        }
      }

      // Calculate height in cm
      let heightCm = null
      if (weightUnit === 'kg' && data.height_cm) {
        heightCm = parseFloat(data.height_cm)
      } else if (
        weightUnit === 'lb' &&
        data.height_feet &&
        data.height_inches
      ) {
        const feet = parseFloat(data.height_feet)
        const inches = parseFloat(data.height_inches)
        heightCm = (feet * 12 + inches) * 2.54
      }

      // Calculate weight in kg
      const weightKg = data.weight_kg
        ? convertInputToKg(parseFloat(data.weight_kg))
        : null

      // Create guest profile and navigate to profile page with paywall flag
      const finishOnboarding = async () => {
        try {
          let currentUserId = user?.id
          if (!currentUserId) {
            const { userId } = await signInAnonymously()
            currentUserId = userId
          }

          if (currentUserId) {
            // Ensure we have a valid base for the user tag
            const cleanName = (data.name || 'Guest').replace(
              /[^a-zA-Z0-9]/g,
              '',
            )
            const tagBase = cleanName.length >= 3 ? data.name : 'Athlete'

            const userTag = await database.profiles.generateUniqueUserTag(
              tagBase || 'Athlete',
            )

            const profileUpdates = {
              id: currentUserId,
              user_tag: userTag,
              display_name: data.name || 'Guest',
              gender: data.gender,
              height_cm: heightCm,
              weight_kg: weightKg,
              age: age,
              goals: data.goal.length > 0 ? data.goal : null,
              commitment:
                data.commitment && data.commitment.length > 0
                  ? data.commitment
                  : null,
              experience_level: data.experience_level,
              bio: data.bio.trim() || null,
              coach: data.coach,
            }

            const { error } = await supabase
              .from('profiles')
              .upsert(profileUpdates)
            if (error) {
              console.error('Error creating profile:', error)
            } else {
              // Refresh profile context so chat has the correct coach data
              await refreshProfile()
            }
          }

          // Track after account created so funnel order is correct:
          // Auth Anonymous Sign In -> Onboarding Completed
          trackEvent(AnalyticsEvents.ONBOARDING_COMPLETED, {
            name: data.name,
            goal: data.goal,
            age,
            gender: data.gender,
            height: heightCm,
            weight: weightKg,
            commitment: data.commitment,
            experience_level: data.experience_level,
            bio: data.bio,
            coach: data.coach,
          })

          router.replace('/(tabs)')
        } catch (error) {
          console.error('Onboarding finish error:', error)
          // Fallback
          router.replace('/(tabs)')
        }
      }

      finishOnboarding()
    }
  }

  const handleBack = () => {
    // Strong haptic for back navigation
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)

    if (step > 1) {
      setStep(step - 1)
    } else {
      router.back()
    }
  }

  const hasAutoSwipe = () => {
    // Step 7 (gender) and 10 (experience) auto-swipe when an option is selected
    // Step 8 (commitment) is now multi-select, so it requires manual "Next"
    // Step 16 is processing (auto-advances after bars fill)
    // Step 18 (commitment pledge) has its own custom footer/interaction
    return step === 7 || step === 10 || step === 16 || step === 18
  }

  const canProceed = () => {
    switch (step) {
      case 1:
        return true // Coach selection
      case 2:
        return true // Greeting
      case 3:
        return data.name.trim() !== ''
      case 4:
        return true // Chat feature intro
      case 5:
        return data.goal.length > 0
      case 6:
        return true // Tailored preview step
      case 7:
        return data.gender !== null
      case 8:
        return data.commitment.length > 0
      case 9:
        return true // Habit reinforcement
      case 10:
        return data.experience_level !== null
      case 11:
        return data.equipment.length > 0 // Equipment selection
      case 12:
        return true // Stats entry step - defaults are fine
      case 13:
        return true // Target weight is just UI
      case 14:
        return true // Body scan feature intro
      case 15:
        return true // Focus areas (optional)
      case 16:
        return false // Step 16 is processing, no next button
      case 17:
        return true // Step 17 has "Get Started"
      default:
        return false
    }
  }

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepTitle}>Pick your personal trainer</Text>
            </View>

            <View style={styles.stepContent}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ gap: 12, paddingBottom: 20 }}
              >
                {COACH_OPTIONS.map((coach) => (
                  <HapticButton
                    key={coach.id}
                    style={[
                      styles.card,
                      data.coach === coach.id && styles.cardSelected,
                    ]}
                    onPress={() => {
                      setData({ ...data, coach: coach.id })
                    }}
                    hapticStyle="light"
                  >
                    <View style={styles.coachContent}>
                      <View style={styles.coachAvatar}>
                        <Image
                          source={coach.image}
                          style={styles.coachImage}
                          resizeMode="cover"
                        />
                        <View style={styles.emojiBadge}>
                          <Text style={styles.emojiText}>
                            {coach.id === 'ross'
                              ? '📋'
                              : coach.id === 'kino'
                              ? '😤'
                              : '💪'}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.textContainer}>
                        <Text style={styles.cardTitle}>{coach.name}</Text>
                        <Text style={styles.cardSubtitle}>{coach.title}</Text>
                      </View>
                    </View>
                  </HapticButton>
                ))}
              </ScrollView>
            </View>
          </View>
        )
      case 2:
        // Greeting Step
        const activeCoachGreeting = COACH_OPTIONS.find(
          (c) => c.id === data.coach,
        )
        const coachGreetingName =
          activeCoachGreeting?.name.split(' ')[1] ||
          activeCoachGreeting?.name ||
          'Coach'

        return (
          <View style={styles.stepContainer}>
            <View
              style={[
                styles.stepContent,
                { justifyContent: 'center', paddingBottom: 60 },
              ]}
            >
              <View style={styles.greetingAvatarContainer}>
                <Image
                  source={activeCoachGreeting?.image}
                  style={styles.greetingAvatar}
                  resizeMode="cover"
                />
                <View style={styles.greetingBadge}>
                  <Ionicons name="chatbubble-ellipses" size={14} color="#FFF" />
                </View>
              </View>
              <FadeInWords
                text={`Hi there! I'm ${coachGreetingName}, your new AI Coach.`}
                style={styles.greetingText}
              />

              {/* Second coach message - delayed */}
            </View>
          </View>
        )
      case 3:
        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepTitle}>What should I call you?</Text>
            </View>

            <View style={styles.stepContent}>
              <AnimatedInput
                style={styles.nameInput}
                placeholder="Enter your name"
                placeholderTextColor={colors.textSecondary}
                value={data.name}
                onChangeText={(text) => setData({ ...data, name: text })}
                autoFocus
                maxLength={50}
                returnKeyType="done"
                onSubmitEditing={handleNext}
              />
            </View>
          </View>
        )
      case 4:
        // Chat Feature Intro Step
        // Get the selected coach for the animated mockup
        const selectedCoachForMockup =
          COACH_OPTIONS.find((c) => c.id === data.coach) || COACH_OPTIONS[0]

        return (
          <View style={styles.chatIntroContainer}>
            <View style={styles.chatIntroHeader}>
              <Text style={styles.chatIntroTitle}>
                {data.name ? `${data.name}, I'll` : "I'll"} be on hand 24/7 to
                motivate you and give you tips.
              </Text>
            </View>

            {/* Animated Chat Mockup */}
            <AnimatedChatMockup
              colors={colors}
              coach={selectedCoachForMockup}
              userName={data.name}
            />
          </View>
        )
      case 5:
        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepTitle}>
                What&rsquo;s your main fitness goal?
              </Text>
            </View>

            <View style={styles.stepContent}>
              <View style={styles.multiSelectContainer}>
                {GOALS.map((goal) => (
                  <HapticButton
                    key={goal.value}
                    style={[
                      styles.card,
                      data.goal.includes(goal.value) && styles.cardSelected,
                    ]}
                    onPress={() => {
                      const newGoals = data.goal.includes(goal.value)
                        ? data.goal.filter((g) => g !== goal.value)
                        : [...data.goal, goal.value]
                      setData({ ...data, goal: newGoals })
                    }}
                    hapticStyle="light"
                  >
                    <View style={styles.cardContent}>
                      <View style={styles.iconContainer}>
                        <Ionicons
                          name={goal.icon}
                          size={24}
                          color={
                            goal.value === 'lose_fat'
                              ? '#3B82F6' // Blue
                              : goal.value === 'build_muscle'
                              ? '#F59E0B' // Amber
                              : goal.value === 'gain_strength'
                              ? '#EF4444' // Red
                              : goal.value === 'improve_cardio'
                              ? '#EC4899' // Pink
                              : goal.value === 'become_flexible'
                              ? '#8B5CF6' // Purple
                              : '#10B981' // Green
                          }
                        />
                      </View>
                      <Text style={styles.cardLabel}>{goal.label}</Text>
                      <View
                        style={[
                          styles.radioButton,
                          data.goal.includes(goal.value) &&
                            styles.radioButtonSelected,
                        ]}
                      >
                        {data.goal.includes(goal.value) && (
                          <View style={styles.radioButtonInner} />
                        )}
                      </View>
                    </View>
                  </HapticButton>
                ))}
              </View>
            </View>
          </View>
        )
      case 7:
        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepTitle}>What&rsquo;s your gender?</Text>
            </View>

            <View style={styles.stepContent}>
              <View style={styles.optionsContainer}>
                {GENDERS.map((gender) => (
                  <HapticButton
                    key={gender.value}
                    style={[
                      styles.card,
                      data.gender === gender.value && styles.cardSelected,
                    ]}
                    onPress={() => {
                      // Set reasonable defaults based on gender to reduce scrolling
                      // Average male: 5'10" (178 cm), 180 lbs (82 kg)
                      // Average female: 5'4" (163 cm), 145 lbs (66 kg)
                      const isMale = gender.value === 'male'
                      const weightKg = isMale ? 82 : 66
                      const weightLb = isMale ? 180 : 145
                      setData({
                        ...data,
                        gender: gender.value,
                        height_cm: isMale ? '178' : '163',
                        height_feet: isMale ? '5' : '5',
                        height_inches: isMale ? '10' : '4',
                        weight_kg:
                          weightUnit === 'kg'
                            ? weightKg.toString()
                            : weightLb.toString(),
                      })
                      setTimeout(() => setStep(step + 1), 400)
                    }}
                    hapticStyle="light"
                  >
                    <View style={styles.cardContent}>
                      <Text style={styles.cardLabel}>{gender.label}</Text>
                      <View
                        style={[
                          styles.radioButton,
                          data.gender === gender.value &&
                            styles.radioButtonSelected,
                        ]}
                      >
                        {data.gender === gender.value && (
                          <View style={styles.radioButtonInner} />
                        )}
                      </View>
                    </View>
                  </HapticButton>
                ))}
              </View>
            </View>
          </View>
        )
      case 8:
        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepTitle}>
                How often do you want to exercise?
              </Text>
            </View>

            <View style={styles.stepContent}>
              <View style={styles.optionsContainer}>
                {COMMITMENTS.map((commitment) => (
                  <HapticButton
                    key={commitment.value}
                    style={[
                      styles.card,
                      data.commitment.includes(commitment.value) &&
                        styles.cardSelected,
                    ]}
                    onPress={() => {
                      let newCommitment: string[]
                      if (commitment.value === 'not_sure') {
                        // If "not sure" is selected, clear others
                        newCommitment = ['not_sure']
                      } else {
                        // If a day is selected, remove "not_sure" if present
                        const withoutNotSure = data.commitment.filter(
                          (c) => c !== 'not_sure',
                        )
                        if (withoutNotSure.includes(commitment.value)) {
                          newCommitment = withoutNotSure.filter(
                            (c) => c !== commitment.value,
                          )
                        } else {
                          newCommitment = [...withoutNotSure, commitment.value]
                        }
                      }
                      setData({ ...data, commitment: newCommitment })
                    }}
                    hapticStyle="light"
                  >
                    <View style={styles.cardContent}>
                      <Text style={styles.cardLabel}>{commitment.label}</Text>
                      <View
                        style={[
                          styles.radioButton,
                          data.commitment.includes(commitment.value) &&
                            styles.radioButtonSelected,
                        ]}
                      >
                        {data.commitment.includes(commitment.value) && (
                          <View style={styles.radioButtonInner} />
                        )}
                      </View>
                    </View>
                  </HapticButton>
                ))}
              </View>
            </View>
          </View>
        )
      case 9:
        return (
          <HabitReinforcementStepContent
            data={data}
            colors={colors}
            styles={styles}
          />
        )
      case 10:
        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepTitle}>What level are you?</Text>
            </View>

            <View style={styles.stepContent}>
              <View style={styles.optionsContainer}>
                {EXPERIENCE_LEVELS.map((item) => (
                  <HapticButton
                    key={item.value}
                    style={[
                      styles.card,
                      data.experience_level === item.value &&
                        styles.cardSelected,
                    ]}
                    onPress={() => {
                      setData({ ...data, experience_level: item.value })
                      setTimeout(() => setStep(step + 1), 400)
                    }}
                    hapticStyle="light"
                  >
                    <View style={styles.cardContent}>
                      <Text style={styles.cardLabel}>{item.label}</Text>
                      <View
                        style={[
                          styles.radioButton,
                          data.experience_level === item.value &&
                            styles.radioButtonSelected,
                        ]}
                      >
                        {data.experience_level === item.value && (
                          <View style={styles.radioButtonInner} />
                        )}
                      </View>
                    </View>
                  </HapticButton>
                ))}
              </View>
            </View>
          </View>
        )
      case 11:
        // Equipment Selection Step
        const EQUIPMENT_OPTIONS = [
          { value: 'full_gym', label: 'Full gym' },
          { value: 'barbells', label: 'Barbells' },
          { value: 'dumbbells', label: 'Dumbbells' },
          { value: 'kettlebells', label: 'Kettlebells' },
          { value: 'machines', label: 'Machines' },
        ]

        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepTitle}>What equipment do you have?</Text>
            </View>

            <View style={styles.stepContent}>
              <View style={styles.optionsContainer}>
                {EQUIPMENT_OPTIONS.map((item) => {
                  const isSelected = data.equipment.includes(item.value)

                  return (
                    <HapticButton
                      key={item.value}
                      style={[styles.card, isSelected && styles.cardSelected]}
                      onPress={() => {
                        // If selecting equipment, remove "none" if present
                        const withoutNone = data.equipment.filter(
                          (e) => e !== 'none',
                        )
                        if (withoutNone.includes(item.value)) {
                          // Deselect
                          setData({
                            ...data,
                            equipment: withoutNone.filter(
                              (e) => e !== item.value,
                            ),
                          })
                        } else {
                          // Select
                          setData({
                            ...data,
                            equipment: [...withoutNone, item.value],
                          })
                        }
                      }}
                      hapticStyle="light"
                    >
                      <View style={styles.cardContent}>
                        <Text style={styles.cardLabel}>{item.label}</Text>
                        <View
                          style={[
                            styles.radioButton,
                            isSelected && styles.radioButtonSelected,
                          ]}
                        >
                          {isSelected && (
                            <View style={styles.radioButtonInner} />
                          )}
                        </View>
                      </View>
                    </HapticButton>
                  )
                })}
              </View>

              {/* None of the above - simple text option */}
              <HapticButton
                style={styles.equipmentNoneOption}
                onPress={() => {
                  setData({ ...data, equipment: ['none'] })
                }}
                hapticStyle="light"
              >
                <View
                  style={[
                    styles.radioButton,
                    data.equipment.includes('none') &&
                      styles.radioButtonSelected,
                  ]}
                >
                  {data.equipment.includes('none') && (
                    <View style={styles.radioButtonInner} />
                  )}
                </View>
                <Text style={styles.equipmentNoneText}>None of the above</Text>
              </HapticButton>
            </View>
          </View>
        )
      case 6:
        // Tailored Preview Step
        const primaryGoal = data.goal[0] || 'build_muscle'
        const goalInfo: Record<
          string,
          { text: string; color: string; exercise: string; gif: string }
        > = {
          build_muscle: {
            text: 'GAIN MUSCLE',
            color: '#8B5CF6',
            exercise: 'Barbell Incline Bench Press',
            gif: '3TZduzM.gif',
          },
          lose_fat: {
            text: 'LOSE FAT',
            color: '#EF4444',
            exercise: 'Burpee',
            gif: 'dK9394r.gif',
          },
          gain_strength: {
            text: 'GET STRONGER',
            color: '#F59E0B',
            exercise: 'Barbell Squat',
            gif: 'DhMl549.gif',
          },
          improve_cardio: {
            text: 'IMPROVE CARDIO',
            color: '#3B82F6',
            exercise: 'Burpee',
            gif: 'dK9394r.gif',
          },
          become_flexible: {
            text: 'GET FLEXIBLE',
            color: '#10B981',
            exercise: 'Stiff Leg Deadlift',
            gif: 'kuMiR2T.gif',
          },
          general_fitness: {
            text: 'STAY FIT',
            color: '#6366F1',
            exercise: 'Goblet Squat',
            gif: 'ZA8b5hc.gif',
          },
        }

        const currentGoalInfo =
          goalInfo[primaryGoal as string] || goalInfo.build_muscle

        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Text style={styles.tailoredTitle}>
                I&apos;ll create workouts that will help you{' '}
                <Text
                  style={{ color: currentGoalInfo.color, fontStyle: 'italic' }}
                >
                  {currentGoalInfo.text}
                </Text>
                !
              </Text>
            </View>

            <View style={styles.tailoredMockupContainer}>
              <View style={styles.tailoredPhoneFrame}>
                <View style={styles.tailoredStatusBar}>
                  <Text style={styles.tailoredStatusTime}>9:41</Text>
                  <View style={styles.tailoredDynamicIsland} />
                  <View style={styles.tailoredStatusIcons}>
                    <Ionicons name="cellular" size={12} color="#000" />
                    <Ionicons name="wifi" size={12} color="#000" />
                    <Ionicons name="battery-full" size={12} color="#000" />
                  </View>
                </View>

                <View style={styles.tailoredExerciseContent}>
                  <View style={styles.tailoredGifContainer}>
                    <ExerciseMediaThumbnail
                      gifUrl={currentGoalInfo.gif}
                      style={styles.tailoredGif}
                    />
                  </View>
                  <View style={styles.tailoredExerciseInfo}>
                    <View style={styles.tailoredExerciseMeta}>
                      <View style={styles.tailoredExerciseIconContainer}>
                        <Ionicons name="barbell" size={16} color="#4F46E5" />
                      </View>
                      <View>
                        <Text style={styles.tailoredExerciseName}>
                          {currentGoalInfo.exercise}
                        </Text>
                        <Text style={styles.tailoredExerciseSub}>
                          Round 1/3 • Exercise 1/3
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          </View>
        )
      case 12:
        // Stats Entry Step
        const StatRow = ({
          label,
          value,
          onPress,
        }: {
          label: string
          value: string
          onPress: () => void
        }) => (
          <TouchableOpacity
            style={styles.statRow}
            onPress={onPress}
            activeOpacity={0.7}
          >
            <Text style={styles.statRowLabel}>{label}</Text>
            <View style={styles.statRowValueContainer}>
              <Text style={styles.statRowValue}>{value}</Text>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={colors.textSecondary}
              />
            </View>
          </TouchableOpacity>
        )

        const getAgeString = () => {
          if (!data.birth_day || !data.birth_month || !data.birth_year)
            return 'Select Age'
          // Simple age calculation for display
          const birthDate = new Date(
            parseInt(data.birth_year),
            parseInt(data.birth_month) - 1,
            parseInt(data.birth_day),
          )
          const today = new Date()
          let age = today.getFullYear() - birthDate.getFullYear()
          const monthDiff = today.getMonth() - birthDate.getMonth()
          if (
            monthDiff < 0 ||
            (monthDiff === 0 && today.getDate() < birthDate.getDate())
          ) {
            age--
          }

          const months = [
            'Jan',
            'Feb',
            'Mar',
            'Apr',
            'May',
            'Jun',
            'Jul',
            'Aug',
            'Sep',
            'Oct',
            'Nov',
            'Dec',
          ]
          const monthName = months[parseInt(data.birth_month) - 1] || 'Jan'
          return `${age} (${monthName} ${data.birth_day}, ${data.birth_year})`
        }

        const getHeightString = () => {
          if (weightUnit === 'kg') {
            return `${data.height_cm || '180'} cm`
          } else {
            return `${data.height_feet || '5'}'${data.height_inches || '10'}"`
          }
        }

        const getWeightString = () => {
          return `${data.weight_kg || '75'} ${
            weightUnit === 'kg' ? 'kg' : 'lb'
          }`
        }

        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Text style={styles.statsTitle}>
                Perfect! Let&apos;s just confirm your stats, {data.name}.
              </Text>
            </View>

            <View style={styles.statsList}>
              <StatRow
                label="Units"
                value={weightUnit === 'kg' ? 'Metric' : 'Imperial'}
                onPress={() => setEditingField('units')}
              />
              <StatRow
                label="Age"
                value={getAgeString()}
                onPress={() => setEditingField('age')}
              />
              <StatRow
                label="Height"
                value={getHeightString()}
                onPress={() => setEditingField('height')}
              />
              <StatRow
                label="Weight"
                value={getWeightString()}
                onPress={() => setEditingField('weight')}
              />
            </View>
          </View>
        )
      case 13: {
        // Target Weight Step
        const selectedCoachForWeight =
          COACH_OPTIONS.find((c) => c.id === data.coach) || COACH_OPTIONS[0]
        const currentW = parseFloat(data.weight_kg) || 75
        const diff = targetWeight - currentW
        const percentChange = (diff / currentW) * 100

        let feedbackTitle = ''
        let feedbackDesc = ''
        let feedbackColor = ''

        if (diff < 0) {
          // Weight loss
          const lossPercent = Math.abs(percentChange)
          if (lossPercent <= 3) {
            feedbackTitle = `Quick win: Lose ${Math.round(lossPercent)}%`
            feedbackDesc =
              'A great starting point! This is very achievable with some simple lifestyle changes. Build momentum with quick wins.'
            feedbackColor = '#22C55E' // Green
          } else if (lossPercent <= 7) {
            feedbackTitle = `Moderate goal: Lose ${Math.round(lossPercent)}%`
            feedbackDesc =
              "A solid, achievable target. With consistent effort and good habits, you'll see great results in a few months."
            feedbackColor = '#84CC16' // Lime
          } else if (lossPercent <= 12) {
            feedbackTitle = `Challenging goal: Lose ${Math.round(lossPercent)}%`
            feedbackDesc =
              "This is ambitious but doable! It'll require real commitment to your nutrition and training. Stay disciplined!"
            feedbackColor = '#F97316' // Orange
          } else {
            feedbackTitle = `Very ambitious: Lose ${Math.round(lossPercent)}%`
            feedbackDesc =
              'This is a significant transformation. Consider breaking it into smaller milestones and give yourself time to succeed.'
            feedbackColor = '#EF4444' // Red
          }
        } else if (diff > 0) {
          // Weight gain (Muscle) - tighter thresholds since muscle gain is slower
          const gainPercent = Math.round(percentChange)
          if (gainPercent <= 2) {
            feedbackTitle = `Steady gains: Add ${gainPercent}%`
            feedbackDesc =
              'A realistic target for lean muscle growth. Stay consistent with your training and protein intake.'
            feedbackColor = '#22C55E' // Green
          } else if (gainPercent <= 5) {
            feedbackTitle = `Solid goal: Gain ${gainPercent}%`
            feedbackDesc =
              'Good target! Building quality muscle takes time. Focus on progressive overload and proper nutrition.'
            feedbackColor = '#84CC16' // Lime
          } else if (gainPercent <= 8) {
            feedbackTitle = `Challenging goal: Gain ${gainPercent}%`
            feedbackDesc =
              'This will take serious dedication. Expect this to take 6+ months with optimal training and nutrition.'
            feedbackColor = '#F97316' // Orange
          } else {
            feedbackTitle = `Very ambitious: Gain ${gainPercent}%`
            feedbackDesc =
              'Building this much muscle takes significant time. Most people gain 1-2% muscle per month at best. Plan for the long haul!'
            feedbackColor = '#EF4444' // Red
          }
        } else {
          feedbackTitle = 'Maintenance Goal'
          feedbackDesc =
            'Keeping your current weight is a great way to focus on body recomposition and fitness.'
          feedbackColor = '#22C55E' // Green
        }

        // Generate ruler ticks (range +/- 15 units)
        const range = 15
        const startWeight = Math.floor(currentW - range)
        const ticks = Array.from(
          { length: range * 2 * 10 + 1 },
          (_, i) => startWeight + i * 0.1,
        )

        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Text style={styles.statsTitle}>What is your target weight?</Text>
            </View>

            <View style={styles.targetWeightContainer}>
              <View style={styles.targetWeightDisplay}>
                <Text style={styles.targetWeightValue}>
                  {targetWeight.toFixed(1).replace('.', ',')}
                </Text>
                <Text style={styles.targetWeightUnit}>{weightUnit}</Text>
              </View>

              <View style={styles.rulerContainer}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  snapToInterval={10} // Snap to small ticks
                  decelerationRate="fast"
                  contentContainerStyle={styles.rulerContent}
                  onScroll={(e) => {
                    const offsetX = e.nativeEvent.contentOffset.x
                    // 10px per 0.1 unit -> 100px per 1 unit
                    // Offset 0 is startWeight
                    const value = startWeight + offsetX / 100
                    setTargetWeight(Math.round(value * 10) / 10)
                  }}
                  scrollEventThrottle={16}
                  // Start in middle (current weight)
                  contentOffset={{ x: (currentW - startWeight) * 100, y: 0 }}
                >
                  {ticks.map((t, i) => {
                    const isInt = Math.abs(t % 1) < 0.05
                    const isFilled = t <= targetWeight
                    const tickColor = isFilled
                      ? colors.primary
                      : isInt
                      ? colors.text + '40'
                      : colors.text + '15'

                    return (
                      <View
                        key={i}
                        style={[styles.rulerTickContainer, { width: 10 }]}
                      >
                        {isInt && (
                          <Text
                            style={[
                              styles.rulerTickText,
                              {
                                color: isFilled
                                  ? colors.primary
                                  : colors.textSecondary,
                              },
                            ]}
                          >
                            {Math.round(t)}
                          </Text>
                        )}
                        <View
                          style={[
                            styles.rulerTick,
                            {
                              height: isInt ? 36 : 18,
                              backgroundColor: tickColor,
                              marginTop: isInt ? 0 : 24, // Align short ticks to bottom
                            },
                          ]}
                        />
                      </View>
                    )
                  })}
                </ScrollView>
              </View>

              <View style={styles.feedbackCard}>
                <View style={styles.feedbackCoachIconContainer}>
                  <Image
                    source={selectedCoachForWeight.image}
                    style={styles.feedbackCoachImage}
                  />
                </View>
                <Text style={[styles.feedbackTitle, { color: feedbackColor }]}>
                  {feedbackTitle}
                </Text>
                <Text style={styles.feedbackDesc}>{feedbackDesc}</Text>
              </View>
            </View>
          </View>
        )
      }
      case 14: {
        // Body Scan Feature Step
        const currentWeightNum = parseFloat(data.weight_kg) || 75
        const isLosing = targetWeight < currentWeightNum
        const goalAction = isLosing ? 'FAT LOSS' : 'MUSCLE GAIN'

        // Placeholder values for the scan
        const mockMuscleMass = (currentWeightNum * 0.78).toFixed(1)
        const mockBodyFat = isLosing ? '24' : '18'

        const scanImage =
          data.gender === 'female'
            ? require('../../assets/images/coach/body-scan-female.png')
            : require('../../assets/images/coach/body-scan-male.png')

        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Text style={styles.bodyScanTitle}>
                Body Scan analyzes your lean muscle so you can accurately track
                your{' '}
                <Text style={{ color: '#8B5CF6', fontStyle: 'italic' }}>
                  {goalAction}
                </Text>
                !
              </Text>
            </View>

            <View style={styles.bodyScanMockupContainer}>
              <View style={styles.bodyScanPhoneFrame}>
                <Image
                  source={scanImage}
                  defaultSource={require('../../assets/images/icon.png')}
                  style={styles.bodyScanImage}
                />
                <View style={styles.bodyScanOverlay}>
                  <View style={styles.scanLine} />
                  <View style={[styles.scanLine, { top: '45%' }]} />
                  <View style={[styles.scanLine, { top: '60%' }]} />
                </View>
              </View>

              {/* Right side callouts */}
              <View style={styles.bodyScanCallouts}>
                <View style={styles.bodyScanCalloutItem}>
                  <Text style={styles.bodyScanCalloutLabel}>Muscle Mass</Text>
                  <Text
                    style={[styles.bodyScanCalloutValue, { color: '#F59E0B' }]}
                  >
                    {mockMuscleMass} kg
                  </Text>
                  <View style={styles.bodyScanCalloutLineContainer}>
                    <View style={styles.bodyScanCalloutLine} />
                  </View>
                </View>

                <View style={[styles.bodyScanCalloutItem, { marginTop: 60 }]}>
                  <Text style={styles.bodyScanCalloutLabel}>Body Fat</Text>
                  <Text
                    style={[styles.bodyScanCalloutValue, { color: '#EF4444' }]}
                  >
                    {mockBodyFat}%
                  </Text>
                  <View style={styles.bodyScanCalloutLineContainer}>
                    <View
                      style={[
                        styles.bodyScanCalloutLine,
                        { transform: [{ rotate: '-10deg' }] },
                      ]}
                    />
                  </View>
                </View>
              </View>
            </View>
          </View>
        )
      }
      case 15: {
        const MUSCLE_GROUP_MAPPING: Record<
          string,
          { label: string; slugs: BodyPartSlug[] }
        > = {
          shoulders: { label: 'Shoulders', slugs: ['deltoids', 'neck'] },
          arms: { label: 'Arms', slugs: ['biceps', 'triceps', 'forearm'] },
          back: {
            label: 'Back',
            slugs: ['upper-back', 'trapezius', 'lower-back'],
          },
          chest: { label: 'Chest', slugs: ['chest'] },
          abs: { label: 'Abs', slugs: ['abs', 'obliques'] },
          butt: { label: 'Butt', slugs: ['gluteal'] },
          legs: {
            label: 'Legs',
            slugs: ['quadriceps', 'hamstring', 'calves', 'adductors'],
          },
        }

        const allMuscleSlugs: BodyPartSlug[] = Object.values(
          MUSCLE_GROUP_MAPPING,
        ).flatMap((v) => v.slugs)

        const bodyData = focusAreas.map((slug) => ({
          slug,
          intensity: 1,
        }))

        const toggleArea = (groupKey: string) => {
          const slugsToToggle = MUSCLE_GROUP_MAPPING[groupKey].slugs
          setFocusAreas((prev) => {
            const hasAll = slugsToToggle.every((s) => prev.includes(s))
            if (hasAll) {
              return prev.filter((p) => !slugsToToggle.includes(p))
            } else {
              const newAreas = [...prev]
              slugsToToggle.forEach((s) => {
                if (!newAreas.includes(s)) newAreas.push(s)
              })
              return newAreas
            }
          })
        }

        const handleBodyPartPress = (bodyPart: { slug?: string }) => {
          if (!bodyPart.slug) return
          // Find which group this anatomical slug belongs to
          const groupKey = Object.keys(MUSCLE_GROUP_MAPPING).find((key) =>
            MUSCLE_GROUP_MAPPING[key].slugs.includes(
              bodyPart.slug as BodyPartSlug,
            ),
          )
          if (groupKey) {
            toggleArea(groupKey)
          }
        }

        const isFullBody = focusAreas.length >= allMuscleSlugs.length

        return (
          <View style={styles.stepContainer}>
            <View style={styles.focusAreasHeader}>
              <Text style={styles.focusAreasTitle}>
                Choose your focus areas
              </Text>
            </View>

            <View style={styles.bodyHighlightContainer}>
              {/* Side-by-side body views */}
              <View style={styles.bodySideBySide}>
                <View style={styles.bodyViewItem}>
                  <Body
                    data={bodyData}
                    gender={data.gender === 'female' ? 'female' : 'male'}
                    side="front"
                    scale={0.72}
                    colors={[colors.primary]}
                    onBodyPartPress={handleBodyPartPress}
                    border={colors.text}
                  />
                </View>
                <View style={styles.bodyViewItem}>
                  <Body
                    data={bodyData}
                    gender={data.gender === 'female' ? 'female' : 'male'}
                    side="back"
                    scale={0.72}
                    colors={[colors.primary]}
                    onBodyPartPress={handleBodyPartPress}
                    border={colors.text}
                  />
                </View>
              </View>

              {/* Muscle selection buttons in organized rows */}
              <View style={styles.focusMuscleGrid}>
                {/* Row 1: Back, Arm, Shoulder */}
                <View style={styles.focusMuscleRow}>
                  {['back', 'arms', 'shoulders'].map((key) => {
                    const group = MUSCLE_GROUP_MAPPING[key]
                    const isSelected =
                      group.slugs.every((s) => focusAreas.includes(s)) &&
                      !isFullBody
                    return (
                      <TouchableOpacity
                        key={key}
                        style={[
                          styles.focusMuscleButton,
                          isSelected && styles.focusMuscleButtonSelected,
                        ]}
                        onPress={() => toggleArea(key)}
                      >
                        <Text
                          style={[
                            styles.focusMuscleButtonText,
                            isSelected && styles.focusMuscleButtonTextSelected,
                          ]}
                        >
                          {group.label}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>

                {/* Row 2: Abs, Chest, Leg */}
                <View style={styles.focusMuscleRow}>
                  {['abs', 'chest', 'legs'].map((key) => {
                    const group = MUSCLE_GROUP_MAPPING[key]
                    const isSelected =
                      group.slugs.every((s) => focusAreas.includes(s)) &&
                      !isFullBody
                    return (
                      <TouchableOpacity
                        key={key}
                        style={[
                          styles.focusMuscleButton,
                          isSelected && styles.focusMuscleButtonSelected,
                        ]}
                        onPress={() => toggleArea(key)}
                      >
                        <Text
                          style={[
                            styles.focusMuscleButtonText,
                            isSelected && styles.focusMuscleButtonTextSelected,
                          ]}
                        >
                          {group.label}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>

                {/* Row 3: Glutes, Full body */}
                <View style={styles.focusMuscleRow}>
                  <TouchableOpacity
                    style={[
                      styles.focusMuscleButton,
                      MUSCLE_GROUP_MAPPING['butt'].slugs.every((s) =>
                        focusAreas.includes(s),
                      ) &&
                        !isFullBody &&
                        styles.focusMuscleButtonSelected,
                    ]}
                    onPress={() => toggleArea('butt')}
                  >
                    <Text
                      style={[
                        styles.focusMuscleButtonText,
                        MUSCLE_GROUP_MAPPING['butt'].slugs.every((s) =>
                          focusAreas.includes(s),
                        ) &&
                          !isFullBody &&
                          styles.focusMuscleButtonTextSelected,
                      ]}
                    >
                      Glutes
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.focusMuscleButton,
                      isFullBody && styles.focusMuscleButtonSelected,
                    ]}
                    onPress={() => {
                      if (isFullBody) {
                        setFocusAreas([])
                      } else {
                        setFocusAreas([...allMuscleSlugs])
                      }
                    }}
                  >
                    <Text
                      style={[
                        styles.focusMuscleButtonText,
                        isFullBody && styles.focusMuscleButtonTextSelected,
                      ]}
                    >
                      Full body
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        )
      }
      case 16: {
        return (
          <ProcessingStepContent
            data={data}
            setStep={setStep}
            colors={colors}
            styles={styles}
          />
        )
      }
      case 17: {
        return (
          <FinalPlanStepContent
            data={data}
            colors={colors}
            styles={styles}
            weightUnit={weightUnit}
          />
        )
      }
      case 18: {
        return (
          <CommitmentStepContent
            data={data}
            setStep={setStep}
            onNext={handleNext}
            colors={colors}
            styles={styles}
            insets={insets}
            onHoldingChange={setIsCommitmentHolding}
          />
        )
      }
      default:
        return null
    }
  }

  const renderEditingModal = () => {
    if (!editingField) return null

    const renderPicker = () => {
      switch (editingField) {
        case 'units':
          return (
            <Picker
              selectedValue={weightUnit}
              onValueChange={(itemValue: 'kg' | 'lb') => {
                if (itemValue === weightUnit) return

                setData((prev) => {
                  // Convert weight
                  let newWeight = prev.weight_kg
                  if (itemValue === 'lb') {
                    newWeight = Math.round(
                      parseFloat(prev.weight_kg) * 2.20462,
                    ).toString()
                  } else {
                    newWeight = Math.round(
                      parseFloat(prev.weight_kg) / 2.20462,
                    ).toString()
                  }

                  // Convert height
                  let newHeightCm = prev.height_cm
                  let newHeightFeet = prev.height_feet
                  let newHeightInches = prev.height_inches

                  if (itemValue === 'lb') {
                    // cm to ft/in
                    const totalInches = parseFloat(prev.height_cm) / 2.54
                    newHeightFeet = Math.floor(totalInches / 12).toString()
                    newHeightInches = Math.round(totalInches % 12).toString()
                    if (newHeightInches === '12') {
                      newHeightFeet = (parseInt(newHeightFeet) + 1).toString()
                      newHeightInches = '0'
                    }
                  } else {
                    // ft/in to cm
                    newHeightCm = Math.round(
                      (parseFloat(prev.height_feet) * 12 +
                        parseFloat(prev.height_inches)) *
                        2.54,
                    ).toString()
                  }

                  return {
                    ...prev,
                    weight_kg: newWeight,
                    height_cm: newHeightCm,
                    height_feet: newHeightFeet,
                    height_inches: newHeightInches,
                  }
                })

                setWeightUnit(itemValue)
              }}
              style={styles.picker}
            >
              <Picker.Item
                label="Metric (kg/cm)"
                value="kg"
                color={colors.text}
              />
              <Picker.Item
                label="Imperial (lb/in)"
                value="lb"
                color={colors.text}
              />
            </Picker>
          )
        case 'age': {
          const currentYear = new Date().getFullYear()
          const years = Array.from({ length: 100 }, (_, i) =>
            (currentYear - i).toString(),
          )
          const months = Array.from({ length: 12 }, (_, i) => (i + 1).toString())
          const days = Array.from({ length: 31 }, (_, i) => (i + 1).toString())
          const monthNames = [
            'Jan',
            'Feb',
            'Mar',
            'Apr',
            'May',
            'Jun',
            'Jul',
            'Aug',
            'Sep',
            'Oct',
            'Nov',
            'Dec',
          ]

          return (
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={data.birth_day}
                onValueChange={(itemValue: string) =>
                  setData((prev) => ({ ...prev, birth_day: itemValue }))
                }
                style={[styles.picker, { flex: 1 }]}
              >
                {days.map((d) => (
                  <Picker.Item
                    key={d}
                    label={d}
                    value={d}
                    color={colors.text}
                  />
                ))}
              </Picker>
              <Picker
                selectedValue={data.birth_month}
                onValueChange={(itemValue: string) =>
                  setData((prev) => ({ ...prev, birth_month: itemValue }))
                }
                style={[styles.picker, { flex: 1 }]}
              >
                {months.map((m) => (
                  <Picker.Item
                    key={m}
                    label={monthNames[parseInt(m) - 1]}
                    value={m}
                    color={colors.text}
                  />
                ))}
              </Picker>
              <Picker
                selectedValue={data.birth_year}
                onValueChange={(itemValue: string) =>
                  setData((prev) => ({ ...prev, birth_year: itemValue }))
                }
                style={[styles.picker, { flex: 1 }]}
              >
                {years.map((y) => (
                  <Picker.Item
                    key={y}
                    label={y}
                    value={y}
                    color={colors.text}
                  />
                ))}
              </Picker>
            </View>
          )
        }
        case 'height':
          if (weightUnit === 'kg') {
            const cms = Array.from({ length: 151 }, (_, i) =>
              (100 + i).toString(),
            )
            return (
              <Picker
                selectedValue={data.height_cm}
                onValueChange={(itemValue: string) =>
                  setData((prev) => ({ ...prev, height_cm: itemValue }))
                }
                style={styles.picker}
              >
                {cms.map((c) => (
                  <Picker.Item
                    key={c}
                    label={`${c} cm`}
                    value={c}
                    color={colors.text}
                  />
                ))}
              </Picker>
            )
          } else {
            const feet = ['4', '5', '6', '7']
            const inches = Array.from({ length: 12 }, (_, i) => i.toString())
            return (
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={data.height_feet}
                  onValueChange={(itemValue: string) =>
                    setData((prev) => ({ ...prev, height_feet: itemValue }))
                  }
                  style={[styles.picker, { flex: 1 }]}
                >
                  {feet.map((f) => (
                    <Picker.Item
                      key={f}
                      label={`${f} ft`}
                      value={f}
                      color={colors.text}
                    />
                  ))}
                </Picker>
                <Picker
                  selectedValue={data.height_inches}
                  onValueChange={(itemValue: string) =>
                    setData((prev) => ({ ...prev, height_inches: itemValue }))
                  }
                  style={[styles.picker, { flex: 1 }]}
                >
                  {inches.map((i) => (
                    <Picker.Item
                      key={i}
                      label={`${i} in`}
                      value={i}
                      color={colors.text}
                    />
                  ))}
                </Picker>
              </View>
            )
          }
        case 'weight':
          const values =
            weightUnit === 'kg'
              ? Array.from({ length: 271 }, (_, i) => (30 + i).toString())
              : Array.from({ length: 641 }, (_, i) => (60 + i).toString())
          return (
            <Picker
              selectedValue={data.weight_kg}
              onValueChange={(itemValue: string) =>
                setData((prev) => ({ ...prev, weight_kg: itemValue }))
              }
              style={styles.picker}
            >
              {values.map((v) => (
                <Picker.Item
                  key={v}
                  label={`${v} ${weightUnit === 'kg' ? 'kg' : 'lb'}`}
                  value={v}
                  color={colors.text}
                />
              ))}
            </Picker>
          )
        default:
          return null
      }
    }

    return (
      <Modal
        visible={!!editingField}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setEditingField(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setEditingField(null)}
        >
          <TouchableOpacity activeOpacity={1} style={{ width: '100%' }}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setEditingField(null)}>
                  <Text style={styles.modalCloseText}>Done</Text>
                </TouchableOpacity>
              </View>
              {renderPicker()}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    )
  }

  return (
    <SafeAreaView
      style={styles.container}
      edges={
        step === 18
          ? ['left', 'right']
          : step === 16 || step === 17
          ? ['top', 'left', 'right']
          : ['top', 'bottom', 'left', 'right']
      }
    >
      <View style={styles.wrapper}>
        {/* Header */}
        <View
          style={[
            styles.header,
            step === 18 && {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 1000,
              paddingTop:
                Math.max(insets.top, Platform.OS === 'ios' ? 44 : 0) + 20,
              backgroundColor: 'transparent',
            },
          ]}
        >
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons
              name="arrow-back"
              size={24}
              color={
                step === 18
                  ? isCommitmentHolding || (step === 18 && false) // Logic for transition could go here, for now stick to consistency
                    ? '#fff'
                    : colors.text
                  : colors.text
              }
            />
          </TouchableOpacity>

          <View style={[styles.headerCenter, { opacity: 0, height: 0 }]}>
            <View style={styles.progressBarWrapper}>
              <Animated.View
                style={[
                  styles.headerProgressBarFill,
                  {
                    width: `${(step / 17) * 100}%`,
                    backgroundColor: colors.primary,
                  },
                ]}
              />
            </View>
          </View>

          <View style={styles.placeholder} />
        </View>

        {/* Content */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 25 : 20}
        >
          <ScrollView
            ref={scrollViewRef}
            style={styles.content}
            contentContainerStyle={[
              styles.contentContainer,
              (step === 16 || step === 17) && { paddingBottom: 0 },
              !hasAutoSwipe() &&
                step !== 16 &&
                step !== 17 && { paddingBottom: 140 },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            bounces={step !== 16}
          >
            <View style={styles.contentWrapper}>
              <Animated.View
                style={[
                  stepHasNativePicker
                    ? { opacity: fadeAnim }
                    : {
                        opacity: fadeAnim,
                        transform: [{ translateX: slideAnim }],
                      },
                  styles.animatedContent,
                ]}
              >
                {renderStep()}
              </Animated.View>
            </View>
          </ScrollView>

          {/* Footer - Fixed at bottom */}
          {!hasAutoSwipe() && (
            <View style={styles.footer}>
              <HapticButton
                style={[
                  styles.nextButton,
                  !canProceed() && styles.nextButtonDisabled,
                ]}
                onPress={handleNext}
                disabled={!canProceed()}
                hapticEnabled={canProceed()}
                hapticStyle="heavy"
              >
                <Text style={styles.nextButtonText}>
                  {step === 2
                    ? "Let's Go"
                    : step === 4
                    ? "Let's Get Started!"
                    : step === 16
                    ? 'Get Started'
                    : 'Next'}
                </Text>
              </HapticButton>
            </View>
          )}
        </KeyboardAvoidingView>
      </View>
      {renderEditingModal()}
    </SafeAreaView>
  )
}

const createStyles = (
  colors: ReturnType<typeof useThemedColors>,
  weightUnit: 'kg' | 'lb',
) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background, // Light/Dark background
    },
    wrapper: {
      flex: 1,
    },
    keyboardView: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 16,
    },
    backButton: {
      padding: 4,
    },
    headerCenter: {
      flex: 1,
      alignItems: 'center',
      gap: 12,
    },
    stepIndicatorContainer: {
      paddingHorizontal: 12,
      paddingVertical: 4,
      backgroundColor: colors.border + '30',
      borderRadius: 12,
    },
    stepIndicatorText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    progressBarWrapper: {
      height: 6,
      width: '70%',
      backgroundColor: colors.border + '50',
      borderRadius: 3,
      overflow: 'hidden',
    },
    headerProgressBarFill: {
      height: '100%',
      borderRadius: 3,
    },
    placeholder: {
      width: 32,
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      flexGrow: 1,
      paddingHorizontal: 24,
      paddingBottom: 40,
    },
    contentWrapper: {
      flex: 1,
      justifyContent: 'flex-start', // Top aligned
      paddingTop: 20,
    },
    animatedContent: {
      flex: 1,
    },
    stepContainer: {
      flex: 1,
    },
    stepHeader: {
      paddingBottom: 32,
    },
    stepTitle: {
      fontSize: 32,
      fontWeight: '800',
      color: colors.text,
      textAlign: 'left',
      marginBottom: 8,
      letterSpacing: -0.5,
    },
    stepContent: {
      flex: 1,
    },
    optionsContainer: {
      gap: 12,
    },
    multiSelectContainer: {
      gap: 8,
    },

    // Card Styles (New)
    card: {
      backgroundColor: colors.backgroundWhite,
      borderRadius: 16,
      padding: 16,
      marginBottom: 2,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    cardSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.backgroundWhite, // Keep white background
    },
    equipmentNoneOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      marginTop: 16,
      gap: 10,
    },
    equipmentNoneText: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    cardContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
    },
    cardLabel: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
      flex: 1,
    },
    iconContainer: {
      width: 40,
      justifyContent: 'center',
      alignItems: 'flex-start',
    },

    // Coach Specific
    coachContent: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
    },
    coachAvatar: {
      marginRight: 16,
      position: 'relative',
    },
    coachImage: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.textSecondary,
    },
    emojiBadge: {
      position: 'absolute',
      bottom: -4,
      right: -4,
      backgroundColor: colors.backgroundWhite,
      borderRadius: 12,
      width: 24,
      height: 24,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    emojiText: {
      fontSize: 14,
    },
    textContainer: {
      flex: 1,
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 2,
    },
    cardSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: '500',
    },

    // Radio Button
    radioButton: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border, // Inactive border
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 12,
    },
    radioButtonSelected: {
      borderColor: colors.primary, // Active border
      backgroundColor: colors.backgroundWhite,
    },
    radioButtonInner: {
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: colors.primary,
    },

    // Input
    inputContainer: {
      marginBottom: 24,
    },
    nameInput: {
      height: 64,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 20,
      paddingHorizontal: 24,
      fontSize: 22,
      fontWeight: '600',
      color: colors.text,
      backgroundColor: colors.backgroundWhite,
    },
    bioInput: {
      minHeight: 160,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 20,
      paddingHorizontal: 24,
      paddingVertical: 20,
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.backgroundWhite,
      textAlignVertical: 'top',
    },
    characterCount: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'right',
      marginTop: 8,
    },

    // Footer
    footer: {
      paddingHorizontal: 24,
      paddingVertical: 16,
      paddingBottom: 40,
    },
    nextButton: {
      height: 64,
      backgroundColor: colors.text, // Black/Dark button
      borderRadius: 32,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: colors.text,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 4,
    },
    nextButtonDisabled: {
      opacity: 0.5,
      shadowOpacity: 0,
    },
    nextButtonText: {
      color: colors.background, // White/Light text
      fontSize: 18,
      fontWeight: '700',
    },

    // Remaining styles
    stepContentInner: {},
    pickerRow: {
      flexDirection: 'row',
      gap: 12,
      justifyContent: 'center',
      paddingHorizontal: 16,
    },
    pickerColumn: {
      flex: 1,
      alignItems: 'center',
      maxWidth: 150,
    },
    pickerLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
      textAlign: 'center',
    },
    pickerContainer: {
      height: 200,
      flexDirection: 'row',
      backgroundColor: colors.backgroundWhite,
      borderRadius: 16,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    picker: {
      width: '100%',
      height: 200,
    },
    pickerItem: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      height: 200,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.backgroundWhite,
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      paddingBottom: 40,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalCloseText: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.primary,
    },
    unitToggleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      marginBottom: 32,
    },
    unitToggleLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    unitToggleLabelActive: {
      color: colors.text,
    },
    imperialContainer: {
      flexDirection: 'row',
      gap: 12,
      justifyContent: 'center',
      paddingHorizontal: 16,
    },
    imperialHeightGroup: {
      alignItems: 'center',
    },
    imperialHeightPickers: {
      flexDirection: 'row',
      gap: 8,
    },
    imperialHeightPickerWrapper: {
      width: 90,
      alignItems: 'center',
    },
    imperialWeightColumn: {
      alignItems: 'center',
      width: 110,
    },
    birthDateRow: {
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'center',
    },
    birthDateColumnSmall: {
      flex: 1,
    },
    birthDateColumnYear: {
      flex: 1.2,
    },

    // Stats & Chart (Keeping references but simplifying if needed)
    trackingBenefitsContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    chartContainer: {
      width: '100%',
      borderRadius: 24,
      backgroundColor: colors.backgroundWhite,
      paddingVertical: 20,
      paddingHorizontal: 16,
      marginBottom: 32,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 12,
      elevation: 2,
    },
    statContainer: {
      alignItems: 'center',
      marginBottom: 32,
    },
    statNumber: {
      fontSize: 48,
      fontWeight: '800',
      color: colors.primary,
      marginBottom: 8,
      letterSpacing: -1,
    },
    statDescription: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
      lineHeight: 26,
    },
    trackingFooter: {
      backgroundColor: colors.backgroundWhite,
      borderRadius: 16,
      padding: 20,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    trackingFooterText: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
    },
    // Greeting Styles
    greetingAvatarContainer: {
      marginBottom: 24,
      position: 'relative',
      alignSelf: 'flex-start',
    },
    greetingAvatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.textSecondary,
    },
    greetingBadge: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      backgroundColor: '#8B5CF6', // Purple like Messenger/AI
      width: 28,
      height: 28,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: colors.background,
    },
    greetingText: {
      fontSize: 34,
      fontWeight: '800',
      color: colors.text,
      lineHeight: 42,
      letterSpacing: -0.5,
    },
    coachMessageContainer: {
      marginTop: 32,
      paddingTop: 24,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    coachSecondaryText: {
      fontSize: 22,
      fontWeight: '600',
      color: colors.textSecondary,
      lineHeight: 30,
    },
    // Chat Intro Step Styles
    chatIntroContainer: {
      flex: 1,
    },
    chatIntroHeader: {
      paddingBottom: 32,
    },
    chatIntroTitle: {
      fontSize: 30,
      fontWeight: '800',
      color: colors.text,
      textAlign: 'left',
      letterSpacing: -0.5,
      lineHeight: 38,
    },

    // Tailored Preview Styles
    tailoredTitle: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.text,
      textAlign: 'left',
      lineHeight: 38,
      letterSpacing: -0.5,
    },
    tailoredMockupContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 20,
    },
    tailoredPhoneFrame: {
      width: 280,
      height: 480,
      backgroundColor: colors.backgroundWhite,
      borderRadius: 40,
      borderWidth: 8,
      borderColor: colors.textSecondary + '20',
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 20 },
      shadowOpacity: 0.1,
      shadowRadius: 30,
      elevation: 10,
    },
    tailoredStatusBar: {
      height: 34,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
    },
    tailoredStatusTime: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
    },
    tailoredDynamicIsland: {
      width: 60,
      height: 18,
      backgroundColor: '#000',
      borderRadius: 9,
    },
    tailoredStatusIcons: {
      flexDirection: 'row',
      gap: 4,
    },
    tailoredExerciseContent: {
      flex: 1,
      backgroundColor: '#f6f6f8',
    },
    tailoredGifContainer: {
      width: '100%',
      aspectRatio: 1,
      backgroundColor: '#fff',
      overflow: 'hidden',
    },
    tailoredGif: {
      width: '100%',
      height: '100%',
    },
    tailoredExerciseInfo: {
      flex: 1,
      padding: 16,
      backgroundColor: '#fff',
      borderTopWidth: 1,
      borderTopColor: '#f0f0f0',
    },
    tailoredExerciseMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    tailoredExerciseIconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: '#F3F4FB',
      justifyContent: 'center',
      alignItems: 'center',
    },
    tailoredExerciseName: {
      fontSize: 16,
      fontWeight: '700',
      color: '#1A1A1A', // Fixed dark color for white background mockup
      marginBottom: 2,
    },
    tailoredExerciseSub: {
      fontSize: 12,
      color: '#666666', // Fixed dark color for white background mockup
      fontWeight: '500',
    },

    // Stats Entry Styles
    statsTitle: {
      fontSize: 32,
      fontWeight: '800',
      color: colors.text,
      textAlign: 'left',
      lineHeight: 40,
      letterSpacing: -1,
    },
    statsList: {
      marginTop: 32,
      backgroundColor: colors.backgroundWhite,
      borderRadius: 20,
      paddingVertical: 8,
    },
    statRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 18,
      borderBottomWidth: 1,
      borderBottomColor: colors.border + '40',
    },
    statRowLabel: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
    },
    statRowValueContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    statRowValue: {
      fontSize: 17,
      color: colors.textSecondary,
    },

    // Target Weight Styles
    targetWeightContainer: {
      flex: 1,
      alignItems: 'center',
      marginTop: 20,
    },
    targetWeightDisplay: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 6,
      marginBottom: 32,
    },
    targetWeightValue: {
      fontSize: 48,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -1,
    },
    targetWeightUnit: {
      fontSize: 20,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    rulerContainer: {
      height: 100,
      width: '100%',
      marginBottom: 32,
      justifyContent: 'center',
    },
    rulerContent: {
      paddingHorizontal: SCREEN_WIDTH / 2 - 5, // Subtract half tick width (10/2)
      alignItems: 'center',
    },
    rulerTickContainer: {
      height: 70,
      justifyContent: 'flex-end',
      alignItems: 'center',
    },
    rulerTick: {
      width: 2,
      borderRadius: 1,
    },
    rulerTickText: {
      position: 'absolute',
      top: 0,
      width: 40,
      left: -19, // Center 40px label on 2px tick (40/2 - 2/2 = 19)
      textAlign: 'center',
      fontSize: 15,
      fontWeight: '700',
    },
    feedbackCard: {
      width: '100%',
      backgroundColor: colors.backgroundWhite,
      borderRadius: 20,
      padding: 20,
    },
    feedbackCoachIconContainer: {
      width: 36,
      height: 36,
      borderRadius: 18,
      position: 'absolute',
      top: -18,
      left: 20,
      borderWidth: 2,
      borderColor: colors.backgroundWhite,
      overflow: 'hidden',
      backgroundColor: colors.backgroundWhite,
    },
    feedbackCoachImage: {
      width: '100%',
      height: '100%',
    },
    feedbackTitle: {
      fontSize: 16,
      fontWeight: '700',
      marginBottom: 6,
      lineHeight: 22,
    },
    feedbackDesc: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.textSecondary,
      fontWeight: '400',
    },

    // Body Scan Styles
    bodyScanTitle: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.text,
      textAlign: 'left',
      lineHeight: 36,
      letterSpacing: -0.5,
    },
    bodyScanMockupContainer: {
      flex: 1,
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      paddingLeft: 20,
      marginTop: -20,
    },
    bodyScanPhoneFrame: {
      width: SCREEN_WIDTH * 0.52,
      height: SCREEN_WIDTH * 1.05,
      borderRadius: 40,
      borderWidth: 8,
      borderColor: '#1a1a1a',
      backgroundColor: '#000',
      overflow: 'hidden',
      transform: [{ rotate: '-10deg' }],
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.2,
      shadowRadius: 20,
      elevation: 10,
    },
    bodyScanImage: {
      width: '100%',
      height: '100%',
      opacity: 0.9,
    },
    bodyScanOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
    },
    scanLine: {
      position: 'absolute',
      width: '80%',
      height: 1.5,
      backgroundColor: 'rgba(255, 255, 255, 0.4)',
      top: '30%',
      shadowColor: '#fff',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.5,
      shadowRadius: 4,
    },
    bodyScanCallouts: {
      flex: 1,
      paddingLeft: 20,
      paddingBottom: 40,
    },
    bodyScanCalloutItem: {
      position: 'relative',
    },
    bodyScanCalloutLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },
    bodyScanCalloutValue: {
      fontSize: 28,
      fontWeight: '800',
    },
    bodyScanCalloutLineContainer: {
      position: 'absolute',
      left: -60,
      top: 25,
      width: 60,
      height: 100,
      overflow: 'visible',
    },
    bodyScanCalloutLine: {
      width: 50,
      height: 1,
      backgroundColor: '#ccc',
      transform: [{ rotate: '25deg' }],
    },

    // Focus Areas Styles
    bodyHighlightContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'flex-start',
      marginTop: 0,
    },
    stepSubtitle: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'left',
      marginTop: 4,
      lineHeight: 20,
    },
    bodyScrollView: {
      width: SCREEN_WIDTH - 48,
      height: 310,
      flexGrow: 0,
    },
    bodyScrollContent: {
      alignItems: 'center',
    },
    bodyPage: {
      width: SCREEN_WIDTH - 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bodySideLabel: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.textSecondary,
      marginBottom: 8,
      letterSpacing: 1.5,
    },
    swipeHintContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 8,
      marginBottom: 18,
      opacity: 0.5,
    },
    swipeHintText: {
      fontSize: 11,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    muscleGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      justifyContent: 'center',
      paddingHorizontal: 0,
    },
    muscleButton: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: colors.backgroundWhite,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border + '50',
    },
    muscleButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },

    // Focus Areas Step - New Styles
    focusAreasHeader: {
      alignItems: 'center',
      marginBottom: 16,
    },
    focusAreasTitle: {
      fontSize: 26,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
    },
    bodySideBySide: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 16,
      marginBottom: 24,
      paddingHorizontal: 8,
    },
    bodyViewItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    focusMuscleGrid: {
      gap: 12,
      alignItems: 'center',
      paddingHorizontal: 16,
    },
    focusMuscleRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 10,
    },
    focusMuscleButton: {
      paddingHorizontal: 20,
      paddingVertical: 12,
      backgroundColor: colors.border + '40',
      borderRadius: 12,
      minWidth: 80,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border + '60',
    },
    focusMuscleButtonSelected: {
      backgroundColor: colors.primary + '20',
      borderWidth: 1.5,
      borderColor: colors.primary,
    },
    focusMuscleButtonText: {
      fontSize: 15,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    focusMuscleButtonTextSelected: {
      color: colors.primary,
      fontWeight: '600',
    },

    // Processing Step Styles
    processingHeader: {
      marginBottom: 32,
    },
    processingTitle: {
      fontSize: 34,
      fontWeight: '800',
      color: colors.text,
      textAlign: 'center',
      lineHeight: 42,
    },
    progressSection: {
      gap: 24,
      marginBottom: 40,
    },
    progressItem: {
      gap: 10,
    },
    progressLabelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    progressLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    progressPercent: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.text,
    },
    progressBarBg: {
      height: 10,
      backgroundColor: colors.border + '30',
      borderRadius: 5,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      backgroundColor: '#A855F7',
      borderRadius: 5,
    },
    socialProofSection: {
      alignItems: 'center',
    },
    socialProofTitle: {
      fontSize: 24,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 20,
    },
    testimonialCard: {
      backgroundColor: colors.backgroundWhite,
      borderRadius: 24,
      padding: 24,
      width: '100%',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 10,
      elevation: 3,
    },
    testimonialHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 16,
    },
    testimonialAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
    },
    testimonialName: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    testimonialTime: {
      fontSize: 12,
      color: colors.textTertiary,
    },
    testimonialText: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.textSecondary,
      marginBottom: 16,
    },
    testimonialSource: {
      fontSize: 12,
      color: colors.textTertiary,
      fontStyle: 'italic',
    },
    testimonialDots: {
      flexDirection: 'row',
      gap: 6,
      marginTop: 16,
      marginBottom: 10,
    },
    testimonialDot: {
      width: 20,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
    },
    testimonialDotActive: {
      backgroundColor: colors.text,
    },
    appStoreBadge: {
      backgroundColor: colors.backgroundWhite,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 20,
      marginBottom: 20,
    },
    ratingValue: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 2,
    },

    // Plan Ready Styles
    planReadyHeader: {
      marginBottom: 32,
    },
    planReadyTitle: {
      fontSize: 36,
      fontWeight: '900',
      color: colors.text,
      lineHeight: 44,
      letterSpacing: -1,
    },
    summaryCard: {
      backgroundColor: colors.backgroundWhite,
      borderRadius: 28,
      padding: 24,
      marginBottom: 32,
    },
    summaryCardTitle: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 20,
    },
    summaryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 20,
      justifyContent: 'space-between',
    },
    summaryItem: {
      width: '45%',
      gap: 4,
    },
    summaryLabel: {
      fontSize: 14,
      color: colors.textTertiary,
      fontWeight: '500',
    },
    summaryValue: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
    },
    customCraftedSection: {
      gap: 16,
    },
    customCraftedTitle: {
      fontSize: 24,
      fontWeight: '800',
      color: colors.text,
    },
    planPreviewCard: {
      width: '100%',
      height: 450,
      borderRadius: 32,
      overflow: 'hidden',
      backgroundColor: '#000',
    },
    planPreviewImage: {
      width: '100%',
      height: '100%',
      opacity: 0.8,
    },
    planPreviewGradient: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'flex-end',
    },
    planPreviewContent: {
      padding: 24,
      gap: 12,
    },
    planPreviewName: {
      fontSize: 32,
      fontWeight: '900',
      color: '#fff',
    },
    planPreviewDesc: {
      fontSize: 16,
      color: 'rgba(255,255,255,0.8)',
      lineHeight: 22,
      marginBottom: 12,
    },
    planPreviewStats: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: 'rgba(255,255,255,0.2)',
    },
    planStatItem: {
      alignItems: 'center',
      gap: 4,
    },
    planStatValue: {
      fontSize: 16,
      fontWeight: '800',
      color: '#fff',
    },
    planStatLabel: {
      fontSize: 12,
      color: 'rgba(255,255,255,0.6)',
      fontWeight: '600',
    },
    planStatDivider: {
      width: 1,
      height: 30,
      backgroundColor: 'rgba(255,255,255,0.2)',
    },
  })
