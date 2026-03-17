import { AnimatedInput } from '@/components/animated-input'
import { HapticButton } from '@/components/haptic-button'
import { StrengthLevelIntroStep } from '@/components/onboarding/StrengthLevelIntroStep'
import {
  EQUIPMENT_PREF_KEY,
  WORKOUT_PLANNING_PREFS_KEY,
} from '@/components/workout-planning-wizard'
import { AnalyticsEvents } from '@/constants/analytics-events'
import { COMMITMENTS, GENDERS, GOALS } from '@/constants/options'
import { useAnalytics } from '@/contexts/analytics-context'
import { useAuth } from '@/contexts/auth-context'
import { useProfile } from '@/contexts/profile-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { BodyPartSlug } from '@/lib/body-mapping'
import { COACH_OPTIONS, DEFAULT_COACH_ID } from '@/lib/coaches'
import { database } from '@/lib/database'
import { requestTrackingPermissionDetailed } from '@/lib/facebook-sdk'
import { haptic, hapticSuccess } from '@/lib/haptics'
import { supabase } from '@/lib/supabase'
import { ExperienceLevel, Gender, Goal } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Picker } from '@react-native-picker/picker'
import { Asset } from 'expo-asset'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Animated,
  Dimensions,
  Easing,
  FlatList,
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
import Body from '@/components/PatchedBodyHighlighter'
import ConfettiCannon from 'react-native-confetti-cannon'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const HEIGHT_RULER_TICK_SPACING = 14

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
  // Calorie tracking fields
  wantsCalorieTracking: boolean | null
  calorieGoal: number | null
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

type StrengthIntroPhase =
  | 'select'
  | 'input'
  | 'result'
  | 'affirmation'
  | 'rating'

// Map step numbers to their human-readable names
// Three section interstitials are inserted to group the onboarding flow.
const STEP_NAMES: { [key: number]: string } = {
  1: 'coach_selection',
  2: 'coach_greeting',
  3: 'name_entry',
  4: 'chat_feature_intro',
  5: 'section_goals',
  6: 'goals_selection',
  7: 'tailored_preview',
  8: 'gender_selection',
  9: 'section_body_nutrition',
  10: 'weight_entry',
  // Strength level comes first so user gets their rank
  11: 'strength_level_intro',
  // Calorie tracking branch
  12: 'nutrition_opt_in',
  13: 'height_entry',
  14: 'age_entry',
  15: 'calorie_goal_selection',
  16: 'nutrition_target_summary',
  17: 'section_plan',
  18: 'commitment_level',
  19: 'habit_reinforcement',
  20: 'equipment_selection',
  // Continuation of main flow
  21: 'focus_areas',
  22: 'body_scan_feature',
  23: 'processing',
  24: 'plan_ready',
  25: 'commitment_pledge',
}

// Total number of steps in the onboarding flow
const TOTAL_STEPS = 25

const GOAL_COLORS: Record<string, string> = {
  gain_strength: '#EF4444', // Red
  build_muscle: '#F59E0B', // Amber
  lose_fat: '#3B82F6', // Blue
  improve_cardio: '#EC4899', // Pink
  become_flexible: '#8B5CF6', // Purple
  general_fitness: '#10B981', // Green
}

const getGoalColor = (goal: string | undefined): string => {
  if (!goal) return GOAL_COLORS.general_fitness
  return GOAL_COLORS[goal] || GOAL_COLORS.general_fitness
}

const calculateAgeFromBirthDate = (
  birthYear: string,
  birthMonth: string,
  birthDay: string,
  today: Date = new Date(),
): number | null => {
  const year = parseInt(birthYear, 10)
  const month = parseInt(birthMonth, 10)
  const day = parseInt(birthDay, 10)

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  ) {
    return null
  }

  const birthDate = new Date(year, month - 1, day)
  const isSameDate =
    birthDate.getFullYear() === year &&
    birthDate.getMonth() === month - 1 &&
    birthDate.getDate() === day

  if (!isSameDate) {
    return null
  }

  let age = today.getFullYear() - year
  const monthDiff = today.getMonth() - (month - 1)
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < day)) {
    age -= 1
  }

  return age >= 0 ? age : null
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
          <Text
            style={[chatMockupStyles.statusTime, { color: colors.textPrimary }]}
          >
            9:41
          </Text>
          <View style={chatMockupStyles.dynamicIsland} />
          <View style={chatMockupStyles.statusIcons}>
            <Ionicons name="cellular" size={14} color={colors.textPrimary} />
            <Ionicons name="wifi" size={14} color={colors.textPrimary} />
            <Ionicons
              name="battery-full"
              size={14}
              color={colors.textPrimary}
            />
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
          <Text
            style={[chatMockupStyles.chatTitle, { color: colors.textPrimary }]}
          >
            {coachFirstName}
          </Text>
        </View>

        {/* Messages Container */}
        <ScrollView
          style={[
            chatMockupStyles.messagesContainer,
            { backgroundColor: colors.bg },
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
                          { backgroundColor: colors.surface },
                        ]
                      : [
                          chatMockupStyles.userBubble,
                          { backgroundColor: '#000' },
                        ],
                  ]}
                >
                  <Text
                    style={[
                      chatMockupStyles.messageText,
                      { color: isCoach ? colors.textPrimary : '#fff' },
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
              backgroundColor: colors.bg,
              borderTopColor: colors.border,
            },
          ]}
        >
          <View
            style={[
              chatMockupStyles.inputField,
              {
                backgroundColor: colors.surface,
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
            style={[chatMockupStyles.sendButton, { backgroundColor: '#000' }]}
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
    // Analytics tracked via parent component now
  }, [])

  const activeGoal = data.goal[0] || 'build_muscle'
  const habitGoalInfo: Record<string, { text: string; color: string }> = {
    build_muscle: { text: 'GAIN MUSCLE', color: GOAL_COLORS.build_muscle },
    lose_fat: { text: 'LOSE FAT', color: GOAL_COLORS.lose_fat },
    gain_strength: { text: 'GET STRONGER', color: GOAL_COLORS.gain_strength },
    improve_cardio: {
      text: 'IMPROVE CARDIO',
      color: GOAL_COLORS.improve_cardio,
    },
    become_flexible: {
      text: 'STAY FLEXIBLE',
      color: GOAL_COLORS.become_flexible,
    },
    general_fitness: { text: 'STAY FIT', color: GOAL_COLORS.general_fitness },
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
      setTimeout(() => setStep(24), 400)
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
              color: getGoalColor(data.goal[0]),
              fontFamily: 'System',
              fontStyle: 'italic',
              fontWeight: '900',
            }}
          >
            {coloredGoal}
          </Text>{' '}
          plan.
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
              style={[
                styles.progressBarFill,
                {
                  width: `${progress1}%`,
                  backgroundColor: getGoalColor(data.goal[0]),
                },
              ]}
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
              style={[
                styles.progressBarFill,
                {
                  width: `${progress2}%`,
                  backgroundColor: getGoalColor(data.goal[0]),
                },
              ]}
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
              style={[
                styles.progressBarFill,
                {
                  width: `${progress3}%`,
                  backgroundColor: getGoalColor(data.goal[0]),
                },
              ]}
            />
          </View>
        </View>
      </View>

      <View style={styles.socialProofSection}>
        <View style={styles.appStoreBadge}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ionicons name="leaf" size={24} color="#000" />
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.ratingValue}>5.0 on App Store.</Text>
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
        hapticSuccess()
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
    marginBottom: 0,
    flex: 1,
  }

  const spin = waveAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  })

  // Theme-based colors for the "water" effect
  const isDark = colors.bg === '#000000'
  const waveColor = isDark ? '#F97316' : '#000000'

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
          colors.brandPrimary,
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
              backgroundColor: waveColor,
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
              backgroundColor: waveColor, // Same as body
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
              backgroundColor: waveColor,
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
                {isCommitted && (
                  <Animated.View
                    style={{
                      marginBottom: 40,
                      width: 140,
                      height: 140,
                      borderRadius: 70,
                      borderWidth: 0,
                      backgroundColor: 'rgba(255,255,255,0.2)',
                      justifyContent: 'center',
                      alignItems: 'center',
                      transform: [{ scale: scaleAnim }],
                      shadowColor: '#fff',
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.4,
                      shadowRadius: 30,
                      elevation: 10,
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
                      <Ionicons name="checkmark" size={64} color="white" />
                    </View>
                  </Animated.View>
                )}
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
                  {isCommitted ? '' : 'Commitment takes discipline.'}
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
              <View
                style={{
                  backgroundColor: colors.surface,
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
                  style={{
                    fontSize: 16,
                    lineHeight: 22,
                    color: colors.textPrimary,
                  }}
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
                  color: colors.textPrimary,
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
                  backgroundColor: colors.brandPrimary,
                  paddingVertical: 12,
                  paddingHorizontal: 20,
                  borderRadius: 100,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  shadowColor: colors.brandPrimary,
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
              zIndex: 50,
              elevation: 50,
              marginTop: 'auto',
              paddingBottom: Math.max(insets?.bottom || 0, 20) + 10,
            },
          ]}
        >
          {!isCommitted && (
            <View
              style={{ alignItems: 'center', width: '100%', marginBottom: 60 }}
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
                    backgroundColor: waveColor,
                    justifyContent: 'center',
                    alignItems: 'center',
                    shadowColor: waveColor,
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
                Tap and hold to commit.
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
              hapticIntensity="medium"
            >
              <Text style={[styles.nextButtonText, { color: waveColor }]}>
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
  const age = calculateAgeFromBirthDate(
    data.birth_year,
    data.birth_month,
    data.birth_day,
  )
  const displayAge = age !== null ? age.toString() : '35'

  // Determine Optimal Intensity (biased towards High)
  const intensity =
    data.experience_level === 'beginner' && data.commitment.length < 3
      ? 'Moderate'
      : 'High'

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
    { label: 'Optimal Intensity', value: intensity },
  ]

  const planImage =
    data.gender === 'female'
      ? require('../../assets/images/female_plan_preview.png')
      : require('../../assets/images/male_plan_preview.png')

  return (
    <View style={styles.stepContainer}>
      <View style={styles.planReadyHeader}>
        <Text style={styles.planReadyTitle}>
          {data.name || 'Oli'}, your plan{'\n'}is ready!
        </Text>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryCardTitle}>It&apos;s all about you.</Text>
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
        <Text style={styles.customCraftedTitle}>Custom-Crafted.</Text>

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
  const [strengthIntroPhase, setStrengthIntroPhase] = useState<
    StrengthIntroPhase
  >('select')
  const [isCommitmentHolding, setIsCommitmentHolding] = useState(false)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [focusAreas, setFocusAreas] = useState<BodyPartSlug[]>([])
  const [heightRulerWidth, setHeightRulerWidth] = useState(SCREEN_WIDTH - 48)
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
    // Calorie tracking
    wantsCalorieTracking: null,
    calorieGoal: null,
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
  const hasRequestedAttPermissionRef = useRef(false)

  // Reset scroll position for specific steps
  useEffect(() => {
    if (step === 21) {
      scrollViewRef.current?.scrollTo({ x: 0, y: 0, animated: false })
    }
  }, [step])

  useEffect(() => {
    if (step !== 11 && strengthIntroPhase !== 'select') {
      setStrengthIntroPhase('select')
    }
  }, [step, strengthIntroPhase])

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

  // Request ATT permission during the "preparing your plan" loading screen.
  // This keeps it in an engaged moment while still happening before signup/purchase events.
  useEffect(() => {
    if (step !== 23) return
    if (hasRequestedAttPermissionRef.current) return
    hasRequestedAttPermissionRef.current = true

    // Small delay so the loading UI renders before the ATT prompt appears
    const timer = setTimeout(() => {
      void (async () => {
        const attResult = await requestTrackingPermissionDetailed()
        await trackEvent(AnalyticsEvents.ATT_PERMISSION_RESULT, {
          context: 'onboarding',
          granted: attResult.granted,
          prompt_shown: attResult.promptShown,
          initial_status: attResult.initialStatus,
          final_status: attResult.finalStatus,
          sdk_available: attResult.sdkAvailable,
          platform: attResult.platform,
        })
      })()
    }, 800)
    return () => clearTimeout(timer)
  }, [step, trackEvent])

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

  // Auto-advance section interstitial pages so they only act as flow separators.
  useEffect(() => {
    const SECTION_STEP_TRANSITIONS: Record<number, number> = {
      5: 6,
      9: 10,
      17: 18,
    }

    const nextStep = SECTION_STEP_TRANSITIONS[step]
    if (!nextStep) return

    const timeout = setTimeout(() => {
      setStep((current) => (current === step ? nextStep : current))
    }, 1700)

    return () => clearTimeout(timeout)
  }, [step])

  const handleNext = () => {
    // Collect step-specific metadata for analytics
    const stepMetadata: Record<string, any> = {}

    switch (step) {
      case 1:
        stepMetadata.coach_id = data.coach
        break
      case 3:
        stepMetadata.name_provided = !!data.name
        break
      case 6:
        stepMetadata.goals = data.goal
        break
      case 8:
        stepMetadata.gender = data.gender
        break
      case 18:
        stepMetadata.commitment = data.commitment
        break
      case 10:
        stepMetadata.weight = data.weight_kg
        stepMetadata.unit = weightUnit
        break
      case 12:
        stepMetadata.wants_calorie_tracking = data.wantsCalorieTracking
        break
      case 13:
        stepMetadata.height_cm = data.height_cm
        stepMetadata.height_feet = data.height_feet
        stepMetadata.height_inches = data.height_inches
        break
      case 14:
        stepMetadata.age = data.birth_year
        break
      case 15:
        stepMetadata.calorie_goal = data.calorieGoal
        break
      case 20:
        stepMetadata.equipment = data.equipment
        break
      case 21:
        stepMetadata.focus_areas = focusAreas
        break
    }

    trackEvent(AnalyticsEvents.ONBOARDING_STEP_COMPLETED, {
      step,
      step_name: STEP_NAMES[step],
      ...stepMetadata,
    })

    // Save goal preference when leaving goal selection step
    // This pre-fills the "Goal" in the workout generation wizard
    if (step === 6 && data.goal.length > 0) {
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
    if (step === 20 && data.equipment.length > 0) {
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

    // Initialize target weight logic removed as step is gone

    // Handle calorie tracking branch navigation
    // Step 13: User chose whether to track calories
    // If they said no (wantsCalorieTracking === false), skip to step 17 (plan section interstitial)
    // If they said yes, continue to step 14 (height entry)
    if (step === 13 && data.wantsCalorieTracking === false) {
      setStep(17) // Skip to plan section
      return
    }

    if (step < TOTAL_STEPS) {
      setStep(step + 1)
    } else {
      const age = calculateAgeFromBirthDate(
        data.birth_year,
        data.birth_month,
        data.birth_day,
      )

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

              // Save calorie goal to today's daily log if user opted in
              if (data.wantsCalorieTracking && data.calorieGoal) {
                try {
                  await database.dailyLog.updateDay(currentUserId, {
                    calorieGoal: data.calorieGoal,
                  })
                } catch (calorieError) {
                  console.error('Error saving calorie goal:', calorieError)
                }
              }
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
            wants_calorie_tracking: data.wantsCalorieTracking,
            calorie_goal: data.calorieGoal,
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
    haptic('medium')

    if (step > 1) {
      // Handle calorie tracking branch when going back
      // If user skipped calorie tracking (step 17) and goes back, return to step 12
      if (step === 17 && data.wantsCalorieTracking === false) {
        setStep(12) // Return to nutrition opt-in
      } else {
        setStep(step - 1)
      }
    } else {
      router.back()
    }
  }

  const hasAutoSwipe = () => {
    // Section pages auto-advance (5, 11, 20).
    // Step 8 (gender) auto-swipes when an option is selected.
    // Step 11 (strength level) has its own flow, except rating phase which uses the global fixed footer.
    // Step 15 (nutrition opt-in) auto-swipes on selection.
    // Step 23 (processing) auto-advances after bars fill.
    // Step 25 (commitment pledge) has its own custom footer/interaction.
    return (
      step === 5 ||
      step === 8 ||
      step === 9 ||
      (step === 11 && strengthIntroPhase !== 'rating') ||
      step === 12 ||
      step === 17 ||
      step === 23 ||
      step === 25
    )
  }

  const calculateEstimatedTDEE = useCallback(() => {
    let heightCm = parseFloat(data.height_cm)
    if (weightUnit === 'lb') {
      const feet = parseFloat(data.height_feet)
      const inches = parseFloat(data.height_inches)
      if (Number.isFinite(feet) && Number.isFinite(inches)) {
        heightCm = (feet * 12 + inches) * 2.54
      }
    }
    if (!Number.isFinite(heightCm)) {
      heightCm = 170
    }

    const weightKgRaw = convertInputToKg(parseFloat(data.weight_kg))
    const weightKg =
      typeof weightKgRaw === 'number' && Number.isFinite(weightKgRaw)
        ? weightKgRaw
        : 75
    const age =
      calculateAgeFromBirthDate(
        data.birth_year,
        data.birth_month,
        data.birth_day,
      ) ?? 25

    // Mifflin-St Jeor Equation + lightly active multiplier
    let bmr = 10 * weightKg + 6.25 * heightCm - 5 * age
    if (data.gender === 'male') {
      bmr += 5
    } else {
      bmr -= 161
    }
    return Math.round(bmr * 1.375)
  }, [
    convertInputToKg,
    data.birth_day,
    data.birth_month,
    data.birth_year,
    data.gender,
    data.height_cm,
    data.height_feet,
    data.height_inches,
    data.weight_kg,
    weightUnit,
  ])

  // If user doesn't explicitly choose a cut/bulk plan, default to maintenance.
  useEffect(() => {
    if (step !== 15 || data.calorieGoal !== null) return
    const maintenanceCalories = calculateEstimatedTDEE()
    setData((prev) => {
      if (prev.calorieGoal !== null) return prev
      return { ...prev, calorieGoal: maintenanceCalories }
    })
  }, [calculateEstimatedTDEE, data.calorieGoal, step])

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
        return false // Section interstitial
      case 6:
        return data.goal.length > 0
      case 7:
        return true // Tailored preview step
      case 8:
        return data.gender !== null
      case 9:
        return false // Section interstitial
      case 10:
        return true // Weight entry step - defaults are fine
      case 11:
        return true // Strength level intro - handled by component
      case 12:
        return false // Nutrition opt-in - auto-swipes
      case 13:
        return true // Height entry - defaults are fine
      case 14:
        return true // Age entry - defaults are fine
      case 15:
        return data.calorieGoal !== null // Calorie goal selection
      case 16:
        return true // Calorie target summary
      case 17:
        return false // Section interstitial
      case 18:
        return data.commitment.length > 0
      case 19:
        return true // Habit reinforcement
      case 20:
        return data.equipment.length > 0 // Equipment selection
      case 21:
        return true // Focus areas (optional)
      case 22:
        return true // Body scan feature intro
      case 23:
        return false // Processing - auto-advances
      case 24:
        return true // Plan ready - has "Get Started"
      case 25:
        return false // Commitment pledge - has custom interaction
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
              <Text style={styles.stepTitle}>Pick your personal trainer.</Text>
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
                    hapticIntensity="light"
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
                        <Text style={styles.cardSubtitle}>
                          {coach.description}
                        </Text>
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
                coach and fuel your progress.
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
          <View style={styles.sectionScreen}>
            <Text style={styles.sectionIndex}>1</Text>
            <Text style={styles.sectionTitle}>Your Goals</Text>
            <View style={styles.sectionProgressTrack}>
              <View style={[styles.sectionProgressFill, { width: '33%' }]} />
            </View>
          </View>
        )
      case 6:
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
                    hapticIntensity="light"
                  >
                    <View style={styles.cardContent}>
                      <View style={styles.iconContainer}>
                        <Ionicons
                          name={goal.icon}
                          size={24}
                          color={getGoalColor(goal.value)}
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
      case 7: {
        // Goal Validation / Social Proof Step
        const goalValidation: Record<
          string,
          {
            title: string
            stat: string
            statLabel: string
            color: string
          }
        > = {
          gain_strength: {
            title: 'Building strength is the best investment you can make.',
            stat: '15%',
            statLabel: 'average strength increase for Rep AI users in 8 weeks',
            color: GOAL_COLORS.gain_strength,
          },
          build_muscle: {
            title: "There's no better time to build lean muscle.",
            stat: '3.2 lbs',
            statLabel: 'average muscle gain for Rep AI users in 12 weeks',
            color: GOAL_COLORS.build_muscle,
          },
          lose_fat: {
            title: "Let's get you lean and feeling amazing.",
            stat: '8 lbs',
            statLabel: 'average fat loss for Rep AI users in 8 weeks',
            color: GOAL_COLORS.lose_fat,
          },
          improve_cardio: {
            title: 'Heart health is the ultimate engine.',
            stat: '22%',
            statLabel: 'average endurance boost for Rep AI users in 6 weeks',
            color: GOAL_COLORS.improve_cardio,
          },
          general_fitness: {
            title: 'A solid fitness routine changes everything.',
            stat: '3×',
            statLabel: 'more consistent training for Rep AI users',
            color: GOAL_COLORS.general_fitness,
          },
        }

        const primaryGoal = data.goal[0] || 'general_fitness'
        const validation =
          goalValidation[primaryGoal] || goalValidation.general_fitness

        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Text
                style={[
                  styles.stepTitle,
                  { fontSize: 28, lineHeight: 36, fontWeight: '800' },
                ]}
              >
                {validation.title}
              </Text>
            </View>

            <View
              style={{ flex: 1, alignItems: 'center', paddingHorizontal: 20 }}
            >
              {/* Dynamic spacers to hit the optical center regardless of screen size */}
              <View style={{ flex: 1.5 }} />

              {/* Hero Stat Group */}
              <View
                style={{
                  alignItems: 'center',
                  width: '100%',
                }}
              >
                <Text
                  style={{
                    fontSize: 72,
                    fontWeight: '900',
                    color: validation.color,
                    letterSpacing: -3,
                    marginBottom: 12,
                    textAlign: 'center',
                    lineHeight: 72,
                  }}
                >
                  {validation.stat}
                </Text>
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: '700',
                    color: colors.textPrimary,
                    textAlign: 'center',
                    letterSpacing: -0.5,
                    lineHeight: 26,
                    maxWidth: '85%',
                  }}
                >
                  {validation.statLabel}
                </Text>
              </View>

              <View style={{ flex: 1 }} />
            </View>
          </View>
        )
      }
      case 8:
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
                    hapticIntensity="light"
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
      case 18:
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
                    hapticIntensity="light"
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
      case 19:
        return (
          <HabitReinforcementStepContent
            data={data}
            colors={colors}
            styles={styles}
          />
        )
      case 9:
        return (
          <View style={styles.sectionScreen}>
            <Text style={styles.sectionIndex}>2</Text>
            <Text style={styles.sectionTitle}>Your Body</Text>
            <View style={styles.sectionProgressTrack}>
              <View
                style={[
                  styles.sectionProgressFill,
                  { width: '66%', backgroundColor: getGoalColor(data.goal[0]) },
                ]}
              />
            </View>
          </View>
        )
      case 20:
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
                      hapticIntensity="light"
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
                hapticIntensity="light"
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
      case 10:
        // Stats Entry Step (Redesigned)
        const weightRange =
          weightUnit === 'kg'
            ? Array.from({ length: 271 }, (_, i) => (30 + i).toString())
            : Array.from({ length: 600 }, (_, i) => (60 + i).toString())

        const toggleWeightUnit = () => {
          const newUnit = weightUnit === 'kg' ? 'lb' : 'kg'
          const currentVal = parseFloat(data.weight_kg)
          let newVal
          if (newUnit === 'lb') {
            newVal = Math.round(currentVal * 2.20462).toString()
          } else {
            newVal = Math.round(currentVal / 2.20462).toString()
          }
          setData((prev) => ({ ...prev, weight_kg: newVal }))
          setWeightUnit(newUnit)
        }

        return (
          <View style={styles.stepContainer}>
            <View style={[styles.stepHeader, { paddingBottom: 64 }]}>
              <Text style={styles.stepTitle}>
                Enter your weight to get your strength ranks.
              </Text>
            </View>

            <View
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* Unit Toggle */}
              <View
                style={{
                  flexDirection: 'row',
                  backgroundColor: colors.surface,
                  borderRadius: 12,
                  padding: 4,
                  marginBottom: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <TouchableOpacity
                  onPress={() => weightUnit !== 'kg' && toggleWeightUnit()}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 24,
                    borderRadius: 12,
                    backgroundColor:
                      weightUnit === 'kg' ? colors.brandPrimary : 'transparent',
                  }}
                >
                  <Text
                    style={{
                      color:
                        weightUnit === 'kg' ? '#fff' : colors.textSecondary,
                      fontWeight: '700',
                      fontSize: 14,
                    }}
                  >
                    KG
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => weightUnit !== 'lb' && toggleWeightUnit()}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 24,
                    borderRadius: 12,
                    backgroundColor:
                      weightUnit === 'lb' ? colors.brandPrimary : 'transparent',
                  }}
                >
                  <Text
                    style={{
                      color:
                        weightUnit === 'lb' ? '#fff' : colors.textSecondary,
                      fontWeight: '700',
                      fontSize: 14,
                    }}
                  >
                    LBS
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Picker */}
              <View
                style={{
                  height: 250,
                  width: '100%',
                  overflow: 'hidden',
                }}
              >
                <Picker
                  selectedValue={data.weight_kg}
                  onValueChange={(itemValue) =>
                    setData((prev) => ({ ...prev, weight_kg: itemValue }))
                  }
                  style={{
                    color: colors.bg === '#000000' ? '#FFFFFF' : '#000000',
                  }}
                  itemStyle={{
                    color: colors.bg === '#000000' ? '#FFFFFF' : '#000000',
                    fontSize: 36,
                    fontWeight: '800',
                    height: 250,
                  }}
                >
                  {weightRange.map((v) => (
                    <Picker.Item
                      key={v}
                      label={`${v} ${weightUnit}`}
                      value={v}
                      color={colors.bg === '#000000' ? '#FFFFFF' : '#000000'}
                    />
                  ))}
                </Picker>
              </View>
            </View>
          </View>
        )
      // ========== Strength Level Intro (Step 11) ==========
      case 11:
        // Strength Level Intro
        return (
          <StrengthLevelIntroStep
            gender={data.gender as 'male' | 'female' | null}
            weightKg={
              data.weight_kg
                ? convertInputToKg(parseFloat(data.weight_kg)) || 75
                : 75
            }
            weightUnit={weightUnit}
            onComplete={handleNext}
            colors={colors}
            onPhaseChange={setStrengthIntroPhase}
          />
        )

      // ========== Calorie Tracking Branch (Steps 15-19) ==========
      case 12: {
        // Nutrition Opt-In Step
        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepTitle}>
                Want to track your nutrition?
              </Text>
              <Text
                style={[
                  styles.stepSubtitle,
                  { marginTop: 8, fontSize: 16, color: colors.textSecondary },
                ]}
              >
                We can calculate your daily calorie target based on your goals.
              </Text>
            </View>

            <View style={styles.stepContent}>
              <View style={styles.optionsContainer}>
                <HapticButton
                  style={[
                    styles.card,
                    data.wantsCalorieTracking === true && styles.cardSelected,
                  ]}
                  onPress={() => {
                    setData({ ...data, wantsCalorieTracking: true })
                    setTimeout(() => setStep(step + 1), 400)
                  }}
                  hapticIntensity="light"
                >
                  <View style={styles.cardContent}>
                    <View style={styles.iconContainer}>
                      <Ionicons name="restaurant" size={24} color="#10B981" />
                    </View>
                    <Text style={styles.cardLabel}>Yes, help me track</Text>
                    <View
                      style={[
                        styles.radioButton,
                        data.wantsCalorieTracking === true &&
                          styles.radioButtonSelected,
                      ]}
                    >
                      {data.wantsCalorieTracking === true && (
                        <View style={styles.radioButtonInner} />
                      )}
                    </View>
                  </View>
                </HapticButton>

                <HapticButton
                  style={[
                    styles.card,
                    data.wantsCalorieTracking === false && styles.cardSelected,
                  ]}
                  onPress={() => {
                    setData({ ...data, wantsCalorieTracking: false })
                    setTimeout(() => setStep(17), 400) // Skip to plan section
                  }}
                  hapticIntensity="light"
                >
                  <View style={styles.cardContent}>
                    <View style={styles.iconContainer}>
                      <Ionicons
                        name="close-circle-outline"
                        size={24}
                        color={colors.textSecondary}
                      />
                    </View>
                    <Text style={styles.cardLabel}>Skip for now</Text>
                    <View
                      style={[
                        styles.radioButton,
                        data.wantsCalorieTracking === false &&
                          styles.radioButtonSelected,
                      ]}
                    >
                      {data.wantsCalorieTracking === false && (
                        <View style={styles.radioButtonInner} />
                      )}
                    </View>
                  </View>
                </HapticButton>
              </View>
            </View>
          </View>
        )
      }
      case 13: {
        // Height Entry Step (stable non-Picker UI)
        const MIN_CM = 120
        const MAX_CM = 240
        const MIN_TOTAL_IN = 48 // 4'0"
        const MAX_TOTAL_IN = 95 // 7'11"

        const clamp = (value: number, min: number, max: number) =>
          Math.min(max, Math.max(min, value))

        const safeInt = (value: string, fallback: number) => {
          const parsed = parseInt(value, 10)
          return Number.isFinite(parsed) ? parsed : fallback
        }

        const setHeightFromCm = (cmInput: number) => {
          const cm = clamp(Math.round(cmInput), MIN_CM, MAX_CM)
          const totalInches = cm / 2.54
          const feet = Math.floor(totalInches / 12)
          const inches = Math.round(totalInches % 12)
          const normalizedFeet = inches === 12 ? feet + 1 : feet
          const normalizedInches = inches === 12 ? 0 : inches

          setData((prev) => ({
            ...prev,
            height_cm: cm.toString(),
            height_feet: normalizedFeet.toString(),
            height_inches: normalizedInches.toString(),
          }))
        }

        const setHeightFromImperial = (
          feetInput: number,
          inchesInput: number,
        ) => {
          const rawTotalInches = feetInput * 12 + inchesInput
          const totalInches = clamp(rawTotalInches, MIN_TOTAL_IN, MAX_TOTAL_IN)
          const feet = Math.floor(totalInches / 12)
          const inches = totalInches % 12
          const cm = Math.round(totalInches * 2.54)

          setData((prev) => ({
            ...prev,
            height_cm: cm.toString(),
            height_feet: feet.toString(),
            height_inches: inches.toString(),
          }))
        }

        const toggleHeightUnit = () => {
          const newUnit = weightUnit === 'kg' ? 'lb' : 'kg'
          if (newUnit === 'lb') {
            setHeightFromCm(safeInt(data.height_cm, 170))
          } else {
            setHeightFromImperial(
              safeInt(data.height_feet, 5),
              safeInt(data.height_inches, 7),
            )
          }
          setWeightUnit(newUnit)
        }

        const currentCm = clamp(safeInt(data.height_cm, 170), MIN_CM, MAX_CM)
        const currentFeet = clamp(safeInt(data.height_feet, 5), 4, 7)
        const currentInches = clamp(safeInt(data.height_inches, 7), 0, 11)
        const currentTotalInches = clamp(
          currentFeet * 12 + currentInches,
          MIN_TOTAL_IN,
          MAX_TOTAL_IN,
        )
        const displayFeet = Math.floor(currentCm / 30.48)
        const displayInches = Math.round((currentCm / 2.54) % 12)
        const rulerValues =
          weightUnit === 'kg'
            ? Array.from({ length: MAX_CM - MIN_CM + 1 }, (_, i) => MIN_CM + i)
            : Array.from(
                { length: MAX_TOTAL_IN - MIN_TOTAL_IN + 1 },
                (_, i) => MIN_TOTAL_IN + i,
              )
        const selectedRulerValue =
          weightUnit === 'kg' ? currentCm : currentTotalInches
        const initialRulerIndex = Math.max(
          0,
          rulerValues.findIndex((value) => value === selectedRulerValue),
        )

        const updateHeightFromRuler = (value: number) => {
          if (weightUnit === 'kg') {
            setHeightFromCm(value)
            return
          }

          const feet = Math.floor(value / 12)
          const inches = value % 12
          setHeightFromImperial(feet, inches)
        }

        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepTitle}>How tall are you?</Text>
            </View>

            <View style={styles.stepContent}>
              <View style={styles.heightUnitToggle}>
                <TouchableOpacity
                  onPress={() => weightUnit !== 'kg' && toggleHeightUnit()}
                  style={[
                    styles.heightUnitButton,
                    weightUnit === 'kg' && styles.heightUnitButtonActive,
                  ]}
                >
                  <Text
                    style={
                      weightUnit === 'kg'
                        ? styles.heightUnitTextActive
                        : styles.heightUnitText
                    }
                  >
                    CM
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => weightUnit !== 'lb' && toggleHeightUnit()}
                  style={[
                    styles.heightUnitButton,
                    weightUnit === 'lb' && styles.heightUnitButtonActive,
                  ]}
                >
                  <Text
                    style={
                      weightUnit === 'lb'
                        ? styles.heightUnitTextActive
                        : styles.heightUnitText
                    }
                  >
                    FT/IN
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.heightSummaryCard}>
                <Text style={styles.heightSummaryValue}>{currentCm} cm</Text>
                <Text style={styles.heightSummarySubvalue}>
                  {displayFeet}&apos;{displayInches}&quot;
                </Text>
              </View>

              <View style={styles.heightRulerCard}>
                <Text style={styles.heightControlLabel}>
                  {weightUnit === 'kg'
                    ? 'Scroll to set height in centimeters'
                    : 'Scroll to set height in feet/inches'}
                </Text>

                <View
                  style={styles.heightRulerViewport}
                  onLayout={(event) =>
                    setHeightRulerWidth(event.nativeEvent.layout.width)
                  }
                >
                  <FlatList
                    key={weightUnit}
                    horizontal
                    data={rulerValues}
                    keyExtractor={(item) => `${weightUnit}-${item}`}
                    showsHorizontalScrollIndicator={false}
                    bounces={false}
                    snapToInterval={HEIGHT_RULER_TICK_SPACING}
                    decelerationRate="fast"
                    initialScrollIndex={initialRulerIndex}
                    getItemLayout={(_, index) => ({
                      length: HEIGHT_RULER_TICK_SPACING,
                      offset: HEIGHT_RULER_TICK_SPACING * index,
                      index,
                    })}
                    contentContainerStyle={{
                      paddingHorizontal: Math.max(
                        0,
                        heightRulerWidth / 2 - HEIGHT_RULER_TICK_SPACING / 2,
                      ),
                    }}
                    onScroll={(event) => {
                      const offsetX = event.nativeEvent.contentOffset.x
                      const index = clamp(
                        Math.round(offsetX / HEIGHT_RULER_TICK_SPACING),
                        0,
                        rulerValues.length - 1,
                      )
                      updateHeightFromRuler(rulerValues[index])
                    }}
                    scrollEventThrottle={16}
                    renderItem={({ item }) => {
                      const isMajorTick =
                        weightUnit === 'kg' ? item % 5 === 0 : item % 4 === 0
                      const inches = item % 12
                      const feet = Math.floor(item / 12)
                      const label =
                        weightUnit === 'kg' ? `${item}` : `${feet}'${inches}`

                      return (
                        <View style={styles.heightRulerTickWrap}>
                          <View
                            style={[
                              styles.heightRulerTick,
                              isMajorTick && styles.heightRulerTickMajor,
                            ]}
                          />
                          {isMajorTick && (
                            <Text
                              numberOfLines={1}
                              style={styles.heightRulerTickLabel}
                            >
                              {label}
                            </Text>
                          )}
                        </View>
                      )
                    }}
                  />
                  <View
                    pointerEvents="none"
                    style={styles.heightRulerCenterLine}
                  />
                </View>
              </View>
            </View>
          </View>
        )
      }
      case 14: {
        // Age/Birthday Entry Step
        const currentYear = new Date().getFullYear()
        const years = Array.from({ length: 82 }, (_, i) =>
          (currentYear - 16 - i).toString(),
        ) // Ages 16-97
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
        const monthValues = months.map((_, idx) => (idx + 1).toString())

        const safeString = (value: unknown, fallback: string) => {
          if (typeof value === 'string') return value
          if (typeof value === 'number' && Number.isFinite(value))
            return value.toString()
          return fallback
        }

        const getMaxDaysInMonth = (monthValue: string, yearValue: string) => {
          const monthNumber = parseInt(monthValue, 10)
          const yearNumber = parseInt(yearValue, 10)
          const safeMonth = Number.isFinite(monthNumber) ? monthNumber : 1
          const safeYear = Number.isFinite(yearNumber)
            ? yearNumber
            : currentYear
          return new Date(safeYear, safeMonth, 0).getDate()
        }

        const maxDayForSelection = getMaxDaysInMonth(
          data.birth_month,
          data.birth_year,
        )
        const days = Array.from({ length: maxDayForSelection }, (_, i) =>
          (i + 1).toString(),
        )

        const normalizePickerValue = (
          itemValue: unknown,
          allowedValues: string[],
          fallbackValue: string,
        ) => {
          const normalized = safeString(itemValue, fallbackValue)
          return allowedValues.includes(normalized) ? normalized : fallbackValue
        }

        const selectedAge = calculateAgeFromBirthDate(
          data.birth_year,
          data.birth_month,
          data.birth_day,
        )
        const displayAge = selectedAge !== null ? selectedAge.toString() : '--'

        return (
          <View style={styles.stepContainer}>
            <View style={[styles.stepHeader, { paddingBottom: 32 }]}>
              <Text style={styles.stepTitle}>When were you born?</Text>
            </View>

            <View
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* Age Display */}
              <View style={styles.birthAgeBlock}>
                <Text style={styles.birthAgeValue}>{displayAge}</Text>
                <Text style={styles.birthAgeLabel}>years old</Text>
              </View>

              {/* Date Picker Card */}
              <View style={styles.birthPickerCard}>
                <View style={styles.birthPickerHeaderRow}>
                  <View style={styles.birthPickerColumnMonth}>
                    <Text style={styles.birthPickerHeaderText}>Month</Text>
                  </View>
                  <View style={styles.birthPickerColumnDay}>
                    <Text style={styles.birthPickerHeaderText}>Day</Text>
                  </View>
                  <View style={styles.birthPickerColumnYear}>
                    <Text style={styles.birthPickerHeaderText}>Year</Text>
                  </View>
                </View>

                <View style={styles.birthPickerRow}>
                  <View style={styles.birthPickerColumnMonth}>
                    <Picker
                      selectedValue={safeString(data.birth_month, '1')}
                      onValueChange={(itemValue) => {
                        const nextMonth = normalizePickerValue(
                          itemValue,
                          monthValues,
                          data.birth_month || '1',
                        )
                        setData((prev) => {
                          const maxDay = getMaxDaysInMonth(
                            nextMonth,
                            prev.birth_year,
                          )
                          const prevDayNumber = parseInt(prev.birth_day, 10)
                          const safePrevDay = Number.isFinite(prevDayNumber)
                            ? prevDayNumber
                            : 1
                          const nextDay = Math.min(
                            safePrevDay,
                            maxDay,
                          ).toString()
                          return {
                            ...prev,
                            birth_month: nextMonth,
                            birth_day: nextDay,
                          }
                        })
                      }}
                      style={styles.birthPicker}
                      itemStyle={styles.birthPickerItem}
                      selectionColor={colors.brandPrimary}
                    >
                      {months.map((m, idx) => (
                        <Picker.Item
                          key={m}
                          label={m}
                          value={(idx + 1).toString()}
                          color={colors.textPrimary}
                        />
                      ))}
                    </Picker>
                  </View>

                  <View style={styles.birthPickerColumnDay}>
                    <Picker
                      selectedValue={safeString(data.birth_day, '1')}
                      onValueChange={(itemValue) => {
                        const nextDay = normalizePickerValue(
                          itemValue,
                          days,
                          data.birth_day || '1',
                        )
                        setData((prev) => ({ ...prev, birth_day: nextDay }))
                      }}
                      style={styles.birthPicker}
                      itemStyle={styles.birthPickerItem}
                      selectionColor={colors.brandPrimary}
                    >
                      {days.map((d) => (
                        <Picker.Item
                          key={d}
                          label={d}
                          value={d}
                          color={colors.textPrimary}
                        />
                      ))}
                    </Picker>
                  </View>

                  <View style={styles.birthPickerColumnYear}>
                    <Picker
                      selectedValue={safeString(data.birth_year, years[0])}
                      onValueChange={(itemValue) => {
                        const nextYear = normalizePickerValue(
                          itemValue,
                          years,
                          data.birth_year || years[0],
                        )
                        setData((prev) => {
                          const maxDay = getMaxDaysInMonth(
                            prev.birth_month,
                            nextYear,
                          )
                          const prevDayNumber = parseInt(prev.birth_day, 10)
                          const safePrevDay = Number.isFinite(prevDayNumber)
                            ? prevDayNumber
                            : 1
                          const nextDay = Math.min(
                            safePrevDay,
                            maxDay,
                          ).toString()
                          return {
                            ...prev,
                            birth_year: nextYear,
                            birth_day: nextDay,
                          }
                        })
                      }}
                      style={styles.birthPicker}
                      itemStyle={styles.birthPickerItem}
                      selectionColor={colors.brandPrimary}
                    >
                      {years.map((y) => (
                        <Picker.Item
                          key={y}
                          label={y}
                          value={y}
                          color={colors.textPrimary}
                        />
                      ))}
                    </Picker>
                  </View>
                </View>
              </View>
            </View>
          </View>
        )
      }
      case 15: {
        // Calorie Goal Selection Step
        const tdee = calculateEstimatedTDEE()
        const selectedCalorieGoal = data.calorieGoal ?? tdee

        const calorieOptions = [
          {
            label: 'Bulk',
            description: '10% surplus',
            calories: Math.round(tdee * 1.1),
            color: '#10B981',
            icon: 'trending-up' as keyof typeof Ionicons.glyphMap,
          },
          {
            label: 'Maintenance',
            description: 'Stay the same',
            calories: tdee,
            color: '#3B82F6',
            icon: 'swap-horizontal' as keyof typeof Ionicons.glyphMap,
          },
          {
            label: 'Cut',
            description: '15% deficit',
            calories: Math.round(tdee * 0.85),
            color: '#F97316',
            icon: 'trending-down' as keyof typeof Ionicons.glyphMap,
          },
          {
            label: 'Aggressive Cut',
            description: '25% deficit',
            calories: Math.round(tdee * 0.75),
            color: '#EF4444',
            icon: 'flash' as keyof typeof Ionicons.glyphMap,
          },
        ]

        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepTitle}>Choose your daily target.</Text>
            </View>

            <View style={styles.stepContent}>
              <View style={styles.optionsContainer}>
                {calorieOptions.map((option) => (
                  <HapticButton
                    key={option.label}
                    style={[
                      styles.card,
                      selectedCalorieGoal === option.calories &&
                        styles.cardSelected,
                      selectedCalorieGoal === option.calories && {
                        borderColor: option.color,
                      },
                    ]}
                    onPress={() => {
                      setData({ ...data, calorieGoal: option.calories })
                    }}
                    hapticIntensity="light"
                  >
                    <View style={styles.cardContent}>
                      <View style={[styles.iconContainer, { width: 44 }]}>
                        <View
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            backgroundColor: option.color + '20',
                            justifyContent: 'center',
                            alignItems: 'center',
                          }}
                        >
                          <Ionicons
                            name={option.icon}
                            size={22}
                            color={option.color}
                          />
                        </View>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardLabel}>{option.label}</Text>
                        <Text
                          style={{
                            fontSize: 13,
                            color: colors.textSecondary,
                            marginTop: 2,
                          }}
                        >
                          {option.description}
                        </Text>
                      </View>
                      <Text
                        style={{
                          fontSize: 18,
                          fontWeight: '700',
                          color: option.color,
                        }}
                      >
                        {option.calories}
                      </Text>
                      <View
                        style={[
                          styles.radioButton,
                          selectedCalorieGoal === option.calories &&
                            styles.radioButtonSelected,
                          selectedCalorieGoal === option.calories && {
                            borderColor: option.color,
                          },
                        ]}
                      >
                        {selectedCalorieGoal === option.calories && (
                          <View
                            style={[
                              styles.radioButtonInner,
                              { backgroundColor: option.color },
                            ]}
                          />
                        )}
                      </View>
                    </View>
                  </HapticButton>
                ))}
              </View>
            </View>
          </View>
        )
      }
      // ========== End Calorie Tracking Branch ==========

      case 16: {
        const tdee = calculateEstimatedTDEE()
        const targetCalories = data.calorieGoal ?? tdee
        const dailyDelta = targetCalories - tdee
        const deltaRatio = tdee > 0 ? Math.abs(dailyDelta) / tdee : 0
        const weeklyLbs = Math.abs((dailyDelta * 7) / 3500)
        const weeklyKg = weeklyLbs * 0.453592
        const isMaintenance = Math.abs(dailyDelta) < 10
        const isCut = dailyDelta < 0
        const isAggressiveCut = isCut && deltaRatio >= 0.2
        const weeklyRate = weightUnit === 'kg' ? weeklyKg : weeklyLbs
        const weeklyUnit = weightUnit === 'kg' ? 'kg/week' : 'lb/week'
        const weeklyRateText = `${weeklyRate.toFixed(1)} ${weeklyUnit}`
        const planType = isMaintenance
          ? 'maintenance'
          : isCut
          ? isAggressiveCut
            ? 'aggressive_cut'
            : 'cut'
          : 'bulk'

        const affirmationCopy: Record<
          'bulk' | 'maintenance' | 'cut' | 'aggressive_cut',
          { title: string; description: string }
        > = {
          bulk: {
            title:
              'Strong choice. You are set up to build muscle and strength.',
            description: `Your target is ${targetCalories} kcal/day, aiming for about ${weeklyRateText}. Stay consistent and your lifts will keep climbing.`,
          },
          maintenance: {
            title: 'Smart call. Maintenance is perfect for body recomposition.',
            description: `Your target is ${targetCalories} kcal/day. You can gain strength and improve definition without big swings on the scale.`,
          },
          cut: {
            title:
              'Great pick. This cut is balanced, sustainable, and effective.',
            description: `Your target is ${targetCalories} kcal/day, aiming for about ${weeklyRateText}. You can lean out while keeping strong training momentum.`,
          },
          aggressive_cut: {
            title: 'Locked in. You chose an aggressive cut with clear intent.',
            description: `Your target is ${targetCalories} kcal/day, aiming for about ${weeklyRateText}. Stay disciplined and you can move fast while preserving muscle.`,
          },
        }
        const selectedAffirmation = affirmationCopy[planType]

        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepTitle}>{selectedAffirmation.title}</Text>
              <Text
                style={[
                  styles.stepSubtitle,
                  { marginTop: 10, fontSize: 16, lineHeight: 23 },
                ]}
              >
                {selectedAffirmation.description}
              </Text>
            </View>
          </View>
        )
      }

      case 17:
        return (
          <View style={styles.sectionScreen}>
            <Text style={styles.sectionIndex}>3</Text>
            <Text style={styles.sectionTitle}>Your Plan</Text>
            <View style={styles.sectionProgressTrack}>
              <View
                style={[
                  styles.sectionProgressFill,
                  {
                    width: '100%',
                    backgroundColor: getGoalColor(data.goal[0]),
                  },
                ]}
              />
            </View>
          </View>
        )
      case 21: {
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
          glutes: { label: 'Glutes', slugs: ['gluteal'] },
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
            <View style={styles.stepHeader}>
              <Text style={styles.stepTitle}>Choose your focus areas.</Text>
            </View>

            <View style={styles.bodyHighlightContainer}>
              {/* Side-by-side body views */}
              <View style={styles.bodySideBySide}>
                <View style={styles.bodyViewItem}>
                  <Body
                    data={bodyData}
                    gender={data.gender === 'female' ? 'female' : 'male'}
                    side="front"
                    scale={0.65}
                    colors={[getGoalColor(data.goal[0])]}
                    onBodyPartPress={handleBodyPartPress}
                    border={colors.textPrimary}
                  />
                </View>
                <View style={styles.bodyViewItem}>
                  <Body
                    data={bodyData}
                    gender={data.gender === 'female' ? 'female' : 'male'}
                    side="back"
                    scale={0.65}
                    colors={[getGoalColor(data.goal[0])]}
                    onBodyPartPress={handleBodyPartPress}
                    border={colors.textPrimary}
                  />
                </View>
              </View>

              {/* Muscle selection buttons in organized rows */}
              <View style={styles.focusMuscleGrid}>
                {/* Row 1: Full Body, Shoulders, Chest */}
                <View style={styles.focusMuscleRow}>
                  <TouchableOpacity
                    style={[
                      styles.focusMuscleButton,
                      isFullBody && styles.focusMuscleButtonSelected,
                      isFullBody && {
                        backgroundColor: getGoalColor(data.goal[0]) + '20',
                        borderColor: getGoalColor(data.goal[0]),
                      },
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
                        isFullBody && { color: getGoalColor(data.goal[0]) },
                      ]}
                    >
                      Full body
                    </Text>
                  </TouchableOpacity>

                  {['shoulders', 'chest'].map((key) => {
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
                            isSelected && { color: getGoalColor(data.goal[0]) },
                          ]}
                        >
                          {group.label}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>

                {/* Row 2: Back, Arms, Abs */}
                <View style={styles.focusMuscleRow}>
                  {['back', 'arms', 'abs'].map((key) => {
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
                            isSelected && { color: getGoalColor(data.goal[0]) },
                          ]}
                        >
                          {group.label}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>

                {/* Row 3: Glutes, Legs */}
                <View style={styles.focusMuscleRow}>
                  {['glutes', 'legs'].map((key) => {
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
                          isSelected && {
                            backgroundColor: getGoalColor(data.goal[0]) + '20',
                            borderColor: getGoalColor(data.goal[0]),
                          },
                        ]}
                        onPress={() => toggleArea(key)}
                      >
                        <Text
                          style={[
                            styles.focusMuscleButtonText,
                            isSelected && styles.focusMuscleButtonTextSelected,
                            isSelected && { color: getGoalColor(data.goal[0]) },
                          ]}
                        >
                          {group.label}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </View>
            </View>
          </View>
        )
      }
      case 22: {
        // Body Scan Feature Step
        const currentWeightNum = parseFloat(data.weight_kg) || 75
        const isLosing = data.goal.includes('lose_fat')
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
                <Text
                  style={{
                    color: getGoalColor(data.goal[0]),
                    fontStyle: 'italic',
                    fontWeight: '900',
                    fontFamily: 'System',
                  }}
                >
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
      case 23: {
        return (
          <ProcessingStepContent
            data={data}
            setStep={setStep}
            colors={colors}
            styles={styles}
          />
        )
      }
      case 24: {
        return (
          <FinalPlanStepContent
            data={data}
            colors={colors}
            styles={styles}
            weightUnit={weightUnit}
          />
        )
      }
      case 25: {
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
                color={colors.textPrimary}
              />
              <Picker.Item
                label="Imperial (lb/in)"
                value="lb"
                color={colors.textPrimary}
              />
            </Picker>
          )
        case 'age': {
          const currentYear = new Date().getFullYear()
          const years = Array.from({ length: 100 }, (_, i) =>
            (currentYear - i).toString(),
          )
          const months = Array.from({ length: 12 }, (_, i) =>
            (i + 1).toString(),
          )
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
                    color={colors.textPrimary}
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
                    color={colors.textPrimary}
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
                    color={colors.textPrimary}
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
                    color={colors.textPrimary}
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
                      color={colors.textPrimary}
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
                      color={colors.textPrimary}
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
                  color={colors.textPrimary}
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
                <View />
              </View>
              {renderPicker()}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    )
  }

  const isSectionDividerStep = step === 5 || step === 9 || step === 17
  const useOverlayHeader = step === 25 || isSectionDividerStep

  return (
    <SafeAreaView
      style={styles.container}
      edges={
        step === 25
          ? ['left', 'right']
          : step === 23 || step === 24
          ? ['top', 'left', 'right']
          : ['top', 'bottom', 'left', 'right']
      }
    >
      <View style={styles.wrapper}>
        {/* Header */}
        <View
          style={[
            styles.header,
            useOverlayHeader && styles.overlayHeader,
            step === 25 && {
              paddingTop:
                Math.max(insets.top, Platform.OS === 'ios' ? 44 : 0) + 20,
            },
          ]}
        >
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons
              name="arrow-back"
              size={24}
              color={
                step === 25
                  ? isCommitmentHolding || (step === 25 && false) // Logic for transition could go here, for now stick to consistency
                    ? '#fff'
                    : colors.textPrimary
                  : colors.textPrimary
              }
            />
          </TouchableOpacity>

          <View style={[styles.headerCenter, { opacity: 0, height: 0 }]}>
            <View style={styles.progressBarWrapper}>
              <Animated.View
                style={[
                  styles.headerProgressBarFill,
                  {
                    width: `${(step / TOTAL_STEPS) * 100}%`,
                    backgroundColor: colors.brandPrimary,
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
          keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 20}
        >
          <ScrollView
            ref={scrollViewRef}
            style={styles.content}
            contentContainerStyle={[
              styles.contentContainer,
              (step === 24 || step === 25 || isSectionDividerStep) && {
                paddingBottom: 0,
              },
              !hasAutoSwipe() &&
                step !== 24 &&
                step !== 25 && { paddingBottom: 140 },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            bounces={step !== 23}
          >
            <View
              style={[
                styles.contentWrapper,
                isSectionDividerStep && styles.sectionDividerContentWrapper,
              ]}
            >
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
            <View style={[styles.footer, step === 24 && { paddingBottom: 40 }]}>
              <HapticButton
                style={[
                  styles.nextButton,
                  !canProceed() && styles.nextButtonDisabled,
                ]}
                onPress={handleNext}
                disabled={!canProceed()}
                hapticEnabled={canProceed()}
                hapticIntensity="medium"
              >
                <Text style={styles.nextButtonText}>
                  {step === 2
                    ? "Let's Go"
                    : step === 4
                    ? "Let's Get Started!"
                    : step === 11 && strengthIntroPhase === 'rating'
                    ? 'Continue'
                    : step === 24
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
) => {
  const isDarkMode = colors.bg === '#000000'
  const heightPanelBackground = isDarkMode
    ? colors.surfaceSheet
    : colors.surface

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg, // Light/Dark background
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
    overlayHeader: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 1000,
      backgroundColor: 'transparent',
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
      paddingBottom: 20,
    },
    contentWrapper: {
      flex: 1,
      justifyContent: 'flex-start', // Top aligned
      paddingTop: 20,
    },
    sectionDividerContentWrapper: {
      paddingTop: 0,
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
      color: colors.textPrimary,
      textAlign: 'left',
      marginBottom: 8,
      letterSpacing: -0.5,
    },
    stepTitleOutcome: {
      fontSize: 30,
      fontWeight: '800',
      lineHeight: 38,
      letterSpacing: -0.6,
      color: colors.textPrimary,
    },
    stepTitleOutcomeAccent: {
      fontSize: 30,
      fontWeight: '800',
      lineHeight: 38,
      letterSpacing: -0.6,
    },
    sectionScreen: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    sectionIndex: {
      fontSize: 92,
      fontWeight: '900',
      color: colors.textPrimary,
      letterSpacing: -2,
      lineHeight: 96,
      marginBottom: 22,
    },
    sectionTitle: {
      fontSize: 46,
      fontWeight: '800',
      color: colors.textPrimary,
      textAlign: 'center',
      letterSpacing: -1.4,
      marginBottom: 20,
    },
    sectionProgressTrack: {
      width: '100%',
      maxWidth: 360,
      height: 10,
      borderRadius: 999,
      backgroundColor: colors.border + (isDarkMode ? '70' : 'A0'),
      overflow: 'hidden',
      marginBottom: 24,
    },
    sectionProgressFill: {
      height: '100%',
      borderRadius: 999,
      backgroundColor: colors.brandPrimary,
    },
    stepContent: {
      flex: 1,
    },
    heightUnitToggle: {
      flexDirection: 'row',
      alignSelf: 'center',
      backgroundColor: heightPanelBackground,
      borderRadius: 14,
      padding: 4,
      marginBottom: 20,
    },
    heightUnitButton: {
      minWidth: 100,
      paddingVertical: 10,
      paddingHorizontal: 18,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heightUnitButtonActive: {
      backgroundColor: colors.brandPrimary,
    },
    heightUnitText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    heightUnitTextActive: {
      fontSize: 14,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    heightSummaryCard: {
      backgroundColor: heightPanelBackground,
      borderRadius: 20,
      paddingVertical: 22,
      paddingHorizontal: 20,
      alignItems: 'center',
      marginBottom: 16,
    },
    heightSummaryValue: {
      fontSize: 42,
      fontWeight: '800',
      color: colors.textPrimary,
      letterSpacing: -1,
    },
    heightSummarySubvalue: {
      marginTop: 6,
      fontSize: 18,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    heightRulerCard: {
      backgroundColor: heightPanelBackground,
      borderRadius: 20,
      padding: 16,
      gap: 10,
    },
    heightControlLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    heightRulerViewport: {
      height: 94,
      justifyContent: 'center',
    },
    heightRulerTickWrap: {
      width: HEIGHT_RULER_TICK_SPACING,
      alignItems: 'center',
      justifyContent: 'flex-start',
      paddingTop: 8,
    },
    heightRulerTick: {
      width: 2,
      height: 20,
      borderRadius: 1,
      backgroundColor: colors.textSecondary + '88',
    },
    heightRulerTickMajor: {
      height: 34,
      backgroundColor: colors.textPrimary,
    },
    heightRulerTickLabel: {
      position: 'absolute',
      top: 46,
      left: '50%',
      width: 34,
      marginLeft: -17,
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      textAlign: 'center',
    },
    heightRulerCenterLine: {
      position: 'absolute',
      alignSelf: 'center',
      width: 3,
      height: 56,
      borderRadius: 2,
      backgroundColor: colors.brandPrimary,
      shadowColor: colors.brandPrimary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.35,
      shadowRadius: 6,
      elevation: 2,
    },
    birthAgeBlock: {
      marginBottom: 44,
      alignItems: 'center',
    },
    birthAgeValue: {
      fontSize: 80,
      fontWeight: '900',
      color: colors.textPrimary,
      letterSpacing: -2,
      lineHeight: 80,
    },
    birthAgeLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textSecondary,
      marginTop: 8,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    birthPickerCard: {
      width: '100%',
      borderRadius: 24,
      backgroundColor: heightPanelBackground,
      paddingHorizontal: 12,
      paddingTop: 12,
      paddingBottom: 10,
      overflow: 'hidden',
    },
    birthPickerHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 4,
      marginBottom: 4,
    },
    birthPickerHeaderText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      textAlign: 'center',
    },
    birthPickerRow: {
      height: 240,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    birthPickerColumnMonth: {
      flex: 1,
      minWidth: 90,
    },
    birthPickerColumnDay: {
      flex: 0.9,
      minWidth: 80,
    },
    birthPickerColumnYear: {
      flex: 1.3,
      minWidth: 110,
    },
    birthPicker: {
      width: '100%',
      height: 240,
    },
    birthPickerItem: {
      color: colors.textPrimary,
      fontSize: 22,
      fontWeight: '600',
      height: 240,
    },
    optionsContainer: {
      gap: 12,
    },
    multiSelectContainer: {
      gap: 8,
    },

    // Card Styles (New)
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 2,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardSelected: {
      borderColor: colors.brandPrimary,
      backgroundColor: colors.surface, // Keep white background
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
      color: colors.textPrimary,
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
      backgroundColor: colors.surface,
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
      color: colors.textPrimary,
      marginBottom: 2,
    },
    cardSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: '500',
      lineHeight: 18,
      marginBottom: 2,
    },
    cardDescription: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: '400',
      lineHeight: 18,
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
      borderColor: colors.brandPrimary, // Active border
      backgroundColor: colors.surface,
    },
    radioButtonInner: {
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: colors.brandPrimary,
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
      color: colors.textPrimary,
      backgroundColor: colors.surface,
    },
    bioInput: {
      minHeight: 160,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 20,
      paddingHorizontal: 24,
      paddingVertical: 20,
      fontSize: 16,
      color: colors.textPrimary,
      backgroundColor: colors.surface,
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
      paddingBottom: 20,
    },
    nextButton: {
      height: 64,
      backgroundColor: colors.textPrimary, // Black/Dark button
      borderRadius: 32,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: colors.textPrimary,
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
      color: colors.bg, // White/Light text
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
      color: colors.textPrimary,
      marginBottom: 12,
      textAlign: 'center',
    },
    pickerContainer: {
      height: 200,
      flexDirection: 'row',
      backgroundColor: colors.surface,
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
      color: colors.textPrimary,
      height: 200,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.surface,
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
      color: colors.brandPrimary,
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
      color: colors.textPrimary,
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
      backgroundColor: colors.surface,
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
      color: colors.brandPrimary,
      marginBottom: 8,
      letterSpacing: -1,
    },
    statDescription: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textPrimary,
      textAlign: 'center',
      lineHeight: 26,
    },
    trackingFooter: {
      backgroundColor: colors.surface,
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
      borderColor: colors.bg,
    },
    greetingText: {
      fontSize: 34,
      fontWeight: '800',
      color: colors.textPrimary,
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
      color: colors.textPrimary,
      textAlign: 'left',
      letterSpacing: -0.5,
      lineHeight: 38,
    },

    // Tailored Preview Styles
    tailoredTitle: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.textPrimary,
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
      backgroundColor: colors.surface,
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
      color: colors.textPrimary,
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
      color: colors.textPrimary,
      textAlign: 'left',
      lineHeight: 40,
      letterSpacing: -1,
    },
    statsList: {
      marginTop: 32,
      backgroundColor: colors.surface,
      borderRadius: 20,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: colors.border,
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
      color: colors.textPrimary,
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

    // Body Scan Styles
    bodyScanTitle: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.textPrimary,
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
      color: colors.textPrimary,
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
      backgroundColor: colors.surface,
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
      backgroundColor: colors.brandPrimary + '20',
      borderWidth: 1.5,
      borderColor: colors.brandPrimary,
    },
    focusMuscleButtonText: {
      fontSize: 15,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    focusMuscleButtonTextSelected: {
      color: colors.brandPrimary,
      fontWeight: '600',
    },

    // Processing Step Styles
    processingHeader: {
      marginBottom: 32,
    },
    processingTitle: {
      fontSize: 34,
      fontWeight: '800',
      color: colors.textPrimary,
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
      color: colors.textPrimary,
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
      color: colors.textPrimary,
      marginBottom: 20,
    },
    testimonialCard: {
      backgroundColor: colors.surfaceCard,
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
      color: colors.textPrimary,
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
      backgroundColor: colors.textPrimary,
    },
    appStoreBadge: {
      backgroundColor: colors.surfaceCard,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 20,
      marginBottom: 20,
    },
    ratingValue: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 2,
    },

    // Plan Ready Styles
    planReadyHeader: {
      marginBottom: 32,
    },
    planReadyTitle: {
      fontSize: 36,
      fontWeight: '900',
      color: colors.textPrimary,
      lineHeight: 44,
      letterSpacing: -1,
    },
    summaryCard: {
      backgroundColor: colors.surfaceCard,
      borderRadius: 28,
      padding: 24,
      marginBottom: 32,
    },
    summaryCardTitle: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.textPrimary,
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
      color: colors.textPrimary,
    },
    customCraftedSection: {
      gap: 16,
    },
    customCraftedTitle: {
      fontSize: 24,
      fontWeight: '800',
      color: colors.textPrimary,
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
}
