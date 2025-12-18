import { AnimatedInput } from '@/components/animated-input'
import { HapticButton } from '@/components/haptic-button'
import { AnalyticsEvents } from '@/constants/analytics-events'
import {
  COMMITMENTS,
  GENDERS,
  GOALS,
  TRAINING_YEARS
} from '@/constants/options'
import { useAnalytics } from '@/contexts/analytics-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { COACH_OPTIONS, DEFAULT_COACH_ID } from '@/lib/coaches'
import { Gender, Goal, TrainingYears } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import {
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

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
  commitment: string | null
  training_years: TrainingYears | null
  bio: string
  coach: string
}

// Map step numbers to their human-readable names
const STEP_NAMES: { [key: number]: string } = {
  2: 'coach_selection',
  3: 'goals_selection',
  4: 'name_entry',
  5: 'gender_selection',
  6: 'commitment_level',
  7: 'experience_level',
  8: 'training_bio',
}

export default function OnboardingScreen() {
  const [step, setStep] = useState(2)
  const [data, setData] = useState<OnboardingData>({
    name: '',
    gender: null,
    height_cm: '170',
    height_feet: '5',
    height_inches: '8',
    weight_kg: '70',
    birth_day: '1',
    birth_month: '1',
    birth_year: '2000',
    goal: [],
    commitment: null,
    training_years: null,
    bio: '',
    coach: DEFAULT_COACH_ID,
  })
  const colors = useThemedColors()
  const { weightUnit, convertInputToKg } = useWeightUnits()
  const { trackEvent } = useAnalytics()
  const styles = createStyles(colors, weightUnit)

  // Animation refs for step transitions
  const fadeAnim = useRef(new Animated.Value(1)).current
  const slideAnim = useRef(new Animated.Value(0)).current
  const prevStep = useRef(step)

  // Progress dot animations
  const progressDotAnims = useRef(
    Array.from({ length: 7 }, () => new Animated.Value(1)),
  ).current

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
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ]).start()
      }

      // Animate progress dot
      if (step >= 2 && step <= 8) {
        Animated.sequence([
          Animated.spring(progressDotAnims[step - 2], {
            toValue: 1.3,
            useNativeDriver: true,
            tension: 200,
            friction: 10,
          }),
          Animated.spring(progressDotAnims[step - 2], {
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

    if (step < 8) {
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

      // Navigate to trial offer screen with onboarding data
      router.push({
        pathname: '/(auth)/trial-offer',
        params: {
          onboarding_data: JSON.stringify({
            name: data.name,
            gender: data.gender,
            height_cm: heightCm,
            weight_kg: weightKg,
            age: age,
            goal: data.goal,
            commitment: data.commitment,
            training_years: data.training_years,
            bio: data.bio.trim() || null,
            coach: data.coach,
          }),
        },
      })

      trackEvent(AnalyticsEvents.ONBOARDING_COMPLETED, {
        name: data.name,
        goal: data.goal,
        age,
        gender: data.gender,
        height: heightCm,
        weight: weightKg,
        commitment: data.commitment,
        training_years: data.training_years,
        bio: data.bio,
        coach: data.coach,
      })
    }
  }

  const handleBack = () => {
    // Strong haptic for back navigation
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)

    if (step > 2) {
      setStep(step - 1)
    } else {
      router.back()
    }
  }

  const hasAutoSwipe = () => {
    // Steps 5 (gender) and 7 (experience) auto-swipe when an option is selected
    // Step 6 (commitment) is now multi-select, so it requires manual "Next"
    return step === 5 || step === 7
  }

  const canProceed = () => {
    switch (step) {
      case 2:
        return true // Coach selection
      case 3:
        return data.goal.length > 0
      case 4:
        return data.name.trim() !== ''
      case 5:
        return data.gender !== null
      case 6:
        return data.commitment !== null
      case 7:
        return data.training_years !== null
      case 8:
        return true // Optional step
      default:
        return false
    }
  }

  const renderStep = () => {
    switch (step) {
      case 2:
        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepTitle}>Choose your Coach</Text>
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
      case 3:
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
      case 4:
        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepTitle}>What&rsquo;s your name?</Text>
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
      case 5:
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
                      setData({ ...data, gender: gender.value })
                      setTimeout(() => setStep(step + 1), 300)
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
      case 6:
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
                      data.commitment === commitment.value && styles.cardSelected,
                    ]}
                    onPress={() => {
                      setData({ ...data, commitment: commitment.value })
                      // Frequency selection can auto-swipe like gender
                      setTimeout(() => setStep(step + 1), 300)
                    }}
                    hapticStyle="light"
                  >
                    <View style={styles.cardContent}>
                      <Text style={styles.cardLabel}>{commitment.label}</Text>
                      <View
                        style={[
                          styles.radioButton,
                          data.commitment === commitment.value &&
                            styles.radioButtonSelected,
                        ]}
                      >
                        {data.commitment === commitment.value && (
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
              <Text style={styles.stepTitle}>
                How long have you been training?
              </Text>
            </View>

            <View style={styles.stepContent}>
              <View style={styles.optionsContainer}>
                {TRAINING_YEARS.map((item) => (
                  <HapticButton
                    key={item.value}
                    style={[
                      styles.card,
                      data.training_years === item.value && styles.cardSelected,
                    ]}
                    onPress={() => {
                      setData({ ...data, training_years: item.value })
                      setTimeout(() => setStep(step + 1), 300)
                    }}
                    hapticStyle="light"
                  >
                    <View style={styles.cardContent}>
                      <Text style={styles.cardLabel}>{item.label}</Text>
                      <View
                        style={[
                          styles.radioButton,
                          data.training_years === item.value &&
                            styles.radioButtonSelected,
                        ]}
                      >
                        {data.training_years === item.value && (
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
        // Get the selected coach's first name for personalization
        const selectedCoach = COACH_OPTIONS.find((c) => c.id === data.coach)
        const coachFirstName = selectedCoach?.name.split(' ').pop() || 'your coach'

        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepTitle}>
                Anything {coachFirstName} should know about you?
              </Text>
            </View>

            <View style={styles.stepContent}>
              <View>
                <AnimatedInput
                  style={styles.bioInput}
                  placeholder="e.g., I have a lower back injury, prefer morning workouts, and want to focus on building my chest..."
                  placeholderTextColor={colors.textSecondary}
                  value={data.bio}
                  onChangeText={(text) => setData({ ...data, bio: text })}
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                  maxLength={500}
                  returnKeyType="done"
                  onSubmitEditing={handleNext}
                />
                <Text style={styles.characterCount}>{data.bio.length}/500</Text>
              </View>
            </View>
          </View>
        )
      default:
        return null
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.wrapper}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.progressContainer}>
            {[2, 3, 4, 5, 6, 7, 8].map((i) => (
              <Animated.View
                key={i}
                style={[
                  styles.progressDot,
                  i <= step && styles.progressDotActive,
                  {
                    transform: [
                      {
                        scale: i === step ? progressDotAnims[i - 2] : 1,
                      },
                    ],
                  },
                ]}
              />
            ))}
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
            style={styles.content}
            contentContainerStyle={[
              styles.contentContainer,
              !hasAutoSwipe() && { paddingBottom: 140 },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            bounces={true}
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
                <Text style={styles.nextButtonText}>Next</Text>
              </HapticButton>
            </View>
          )}
        </KeyboardAvoidingView>
      </View>
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
    progressContainer: {
      flexDirection: 'row',
      gap: 6,
      height: 4,
      borderRadius: 2,
      overflow: 'hidden',
      backgroundColor: colors.border,
      width: 120,
    },
    progressDot: {
      flex: 1,
      height: '100%',
      backgroundColor: 'transparent',
    },
    progressDotActive: {
      backgroundColor: colors.primary,
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
      width: '100%',
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
  })
