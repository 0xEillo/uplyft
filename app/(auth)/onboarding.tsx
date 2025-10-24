import { AnimatedInput } from '@/components/animated-input'
import { HapticButton } from '@/components/haptic-button'
import { AnalyticsEvents } from '@/constants/analytics-events'
import {
  COMMITMENTS,
  GENDERS,
  GOALS,
  TRAINING_YEARS,
} from '@/constants/options'
import { useAnalytics } from '@/contexts/analytics-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { Gender, Goal, TrainingYears } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { Picker } from '@react-native-picker/picker'
import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
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
}

export default function OnboardingScreen() {
  const [step, setStep] = useState(1)
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
    Array.from({ length: 10 }, () => new Animated.Value(1)),
  ).current

  // Animate step transitions
  useEffect(() => {
    if (prevStep.current !== step) {
      // Start from right, slide and fade in
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

      // Animate progress dot
      if (step >= 1 && step <= 10) {
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

  const handleNext = () => {
    trackEvent(AnalyticsEvents.ONBOARDING_STEP_COMPLETED, {
      step,
    })

    if (step < 10) {
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

      // Navigate to trial offer screen with onboarding data
      router.push({
        pathname: '/(auth)/trial-offer',
        params: {
          onboarding_data: JSON.stringify({
            name: data.name,
            gender: data.gender,
            height_cm: heightCm,
            weight_kg: data.weight_kg
              ? convertInputToKg(parseFloat(data.weight_kg))
              : null,
            age: age,
            goal: data.goal,
            commitment: data.commitment,
            training_years: data.training_years,
            bio: data.bio.trim() || null,
          }),
        },
      })

      trackEvent(AnalyticsEvents.ONBOARDING_COMPLETED, {
        name: data.name,
        goal: data.goal,
        age,
        gender: data.gender,
        height: data.height,
        weight: weightInKg,
        commitment: data.commitment,
        training_years: data.training_years,
        bio: data.bio,
      })
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

  const canProceed = () => {
    switch (step) {
      case 1:
        return true // Feature screen
      case 2:
        return data.name.trim() !== ''
      case 3:
        return data.gender !== null
      case 4:
        const weight = parseFloat(data.weight_kg)
        const weightKg = convertInputToKg(isNaN(weight) ? null : weight)

        let heightValid = false
        if (weightUnit === 'kg') {
          const height = parseFloat(data.height_cm)
          heightValid =
            data.height_cm !== '' &&
            !isNaN(height) &&
            height >= 50 &&
            height <= 300
        } else {
          const feet = parseFloat(data.height_feet)
          const inches = parseFloat(data.height_inches)
          heightValid =
            data.height_feet !== '' &&
            data.height_inches !== '' &&
            !isNaN(feet) &&
            !isNaN(inches) &&
            feet >= 3 &&
            feet <= 9 &&
            inches >= 0 &&
            inches < 12
        }

        return (
          heightValid &&
          data.weight_kg !== '' &&
          weightKg !== null &&
          weightKg >= 20 &&
          weightKg <= 500
        )
      case 5:
        if (!data.birth_day || !data.birth_month || !data.birth_year) {
          return false
        }
        const day = parseInt(data.birth_day)
        const month = parseInt(data.birth_month)
        const year = parseInt(data.birth_year)
        const currentYear = new Date().getFullYear()
        return (
          !isNaN(day) &&
          day >= 1 &&
          day <= 31 &&
          !isNaN(month) &&
          month >= 1 &&
          month <= 12 &&
          !isNaN(year) &&
          year >= currentYear - 120 &&
          year <= currentYear - 13
        )
      case 6:
        return true // Info screen
      case 7:
        return data.goal.length > 0
      case 8:
        return data.commitment !== null
      case 9:
        return data.training_years !== null
      case 10:
        return true // Optional step
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
              <Text style={styles.stepTitle}>Log workouts in seconds</Text>
              <Text style={styles.stepSubtitle}>
                Use <Text style={styles.stepSubtitleBold}>notes</Text>,{' '}
                <Text style={styles.stepSubtitleBold}>camera</Text>, or{' '}
                <Text style={styles.stepSubtitleBold}>voice</Text> to log your
                workouts
              </Text>
            </View>

            <View style={styles.stepContent}>
              <View style={styles.featureExampleContainer}>
                  <View style={styles.featureBubble}>
                    <Text style={styles.featureBubbleText}>
                      &ldquo;I did 3 sets of bench, 8 reps at 185lbs&rdquo;
                    </Text>
                  </View>

                  <View style={styles.featureArrow}>
                    <Text style={styles.featureArrowText}>↓</Text>
                  </View>

                  <View style={styles.workoutGridPreview}>
                    {/* Table Header */}
                    <View style={styles.workoutTableHeader}>
                      <Text
                        style={[
                          styles.workoutTableHeaderText,
                          styles.workoutExerciseCol,
                        ]}
                      >
                        Exercise
                      </Text>
                      <Text
                        style={[
                          styles.workoutTableHeaderText,
                          styles.workoutSetsCol,
                        ]}
                      >
                        Sets
                      </Text>
                      <Text
                        style={[
                          styles.workoutTableHeaderText,
                          styles.workoutRepsCol,
                        ]}
                      >
                        Reps
                      </Text>
                      <Text
                        style={[
                          styles.workoutTableHeaderText,
                          styles.workoutWeightCol,
                        ]}
                      >
                        Wt (lb)
                      </Text>
                    </View>
                    <View style={styles.workoutHeaderDivider} />

                    {/* Table Row */}
                    <View style={styles.workoutTableRow}>
                      <View
                        style={[
                          styles.workoutExerciseCol,
                          styles.workoutExerciseCell,
                        ]}
                      >
                        <Text
                          style={styles.workoutExerciseName}
                          numberOfLines={1}
                        >
                          Bench Press
                        </Text>
                        <View style={styles.workoutPrBadge}>
                          <Text style={styles.workoutPrBadgeText}>PR</Text>
                        </View>
                      </View>
                      <Text
                        style={[styles.workoutTableCell, styles.workoutSetsCol]}
                      >
                        3
                      </Text>
                      <Text
                        style={[styles.workoutTableCell, styles.workoutRepsCol]}
                      >
                        8
                      </Text>
                      <Text
                        style={[
                          styles.workoutTableCell,
                          styles.workoutWeightCol,
                        ]}
                      >
                        185
                      </Text>
                    </View>
                  </View>
              </View>
            </View>
          </View>
        )
      case 2:
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
      case 3:
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
                      styles.optionButton,
                      data.gender === gender.value &&
                        styles.optionButtonSelected,
                    ]}
                    onPress={() => setData({ ...data, gender: gender.value })}
                    hapticStyle="light"
                  >
                    <Text
                      style={[
                        styles.optionText,
                        data.gender === gender.value &&
                          styles.optionTextSelected,
                      ]}
                    >
                      {gender.label}
                    </Text>
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
              <Text style={styles.stepTitle}>Height & Weight</Text>
              <Text style={styles.stepSubtitle}>
                This helps personalize your fitness goals
              </Text>
            </View>

            <View style={styles.stepContent}>
              {/* Unit System Toggle */}
              <View style={styles.unitToggleContainer}>
                <Text
                  style={[
                    styles.unitToggleLabel,
                    weightUnit === 'kg' && styles.unitToggleLabelActive,
                  ]}
                >
                  Metric
                </Text>
                <Switch
                  value={weightUnit === 'lb'}
                  onValueChange={(value) => {
                    Haptics.selectionAsync()
                    setWeightUnit(value ? 'lb' : 'kg')
                  }}
                  trackColor={{
                    false: colors.primary,
                    true: colors.primary,
                  }}
                  thumbColor={colors.buttonText}
                  ios_backgroundColor={colors.primary}
                />
                <Text
                  style={[
                    styles.unitToggleLabel,
                    weightUnit === 'lb' && styles.unitToggleLabelActive,
                  ]}
                >
                  Imperial
                </Text>
              </View>

              {weightUnit === 'kg' ? (
                // Metric: Single height picker (cm) + weight (kg)
                <View style={styles.pickerRow}>
                  <View style={styles.pickerColumn}>
                    <Text style={styles.pickerLabel}>Height</Text>
                    <View style={styles.pickerContainer}>
                      <Picker
                        selectedValue={data.height_cm || '170'}
                        onValueChange={(value) =>
                          setData({ ...data, height_cm: value })
                        }
                        style={styles.picker}
                        itemStyle={styles.pickerItem}
                      >
                        {Array.from({ length: 251 }, (_, i) => i + 50).map(
                          (height) => (
                            <Picker.Item
                              key={height}
                              label={`${height} cm`}
                              value={`${height}`}
                            />
                          ),
                        )}
                      </Picker>
                    </View>
                  </View>
                  <View style={styles.pickerColumn}>
                    <Text style={styles.pickerLabel}>Weight</Text>
                    <View style={styles.pickerContainer}>
                      <Picker
                        selectedValue={data.weight_kg || '70'}
                        onValueChange={(value) =>
                          setData({ ...data, weight_kg: value })
                        }
                        style={styles.picker}
                        itemStyle={styles.pickerItem}
                      >
                        {Array.from({ length: 481 }, (_, i) => i + 20).map(
                          (weight) => (
                            <Picker.Item
                              key={weight}
                              label={`${weight} kg`}
                              value={`${weight}`}
                            />
                          ),
                        )}
                      </Picker>
                    </View>
                  </View>
                </View>
              ) : (
                // Imperial: Height (feet + inches) and Weight
                <View style={styles.imperialContainer}>
                  <View style={styles.imperialHeightGroup}>
                    <Text style={styles.pickerLabel}>Height</Text>
                    <View style={styles.imperialHeightPickers}>
                      <View style={styles.imperialHeightPickerWrapper}>
                        <View style={styles.pickerContainer}>
                          <Picker
                            selectedValue={data.height_feet || '5'}
                            onValueChange={(value) =>
                              setData({ ...data, height_feet: value })
                            }
                            style={styles.picker}
                            itemStyle={styles.pickerItem}
                          >
                            {Array.from({ length: 7 }, (_, i) => i + 3).map(
                              (feet) => (
                                <Picker.Item
                                  key={feet}
                                  label={`${feet} ft`}
                                  value={`${feet}`}
                                />
                              ),
                            )}
                          </Picker>
                        </View>
                      </View>
                      <View style={styles.imperialHeightPickerWrapper}>
                        <View style={styles.pickerContainer}>
                          <Picker
                            selectedValue={data.height_inches || '8'}
                            onValueChange={(value) =>
                              setData({ ...data, height_inches: value })
                            }
                            style={styles.picker}
                            itemStyle={styles.pickerItem}
                          >
                            {Array.from({ length: 12 }, (_, i) => i).map(
                              (inches) => (
                                <Picker.Item
                                  key={inches}
                                  label={`${inches} in`}
                                  value={`${inches}`}
                                />
                              ),
                            )}
                          </Picker>
                        </View>
                      </View>
                    </View>
                  </View>
                  <View style={styles.imperialWeightColumn}>
                    <Text style={styles.pickerLabel}>Weight</Text>
                    <View style={styles.pickerContainer}>
                      <Picker
                        selectedValue={data.weight_kg || '154'}
                        onValueChange={(value) =>
                          setData({ ...data, weight_kg: value })
                        }
                        style={styles.picker}
                        itemStyle={styles.pickerItem}
                      >
                        {Array.from({ length: 551 }, (_, i) => i + 50).map(
                          (weight) => (
                            <Picker.Item
                              key={weight}
                              label={`${weight} lb`}
                              value={`${weight}`}
                            />
                          ),
                        )}
                      </Picker>
                    </View>
                  </View>
                </View>
              )}
            </View>
          </View>
        )
      case 5:
        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepTitle}>When were you born?</Text>
              <Text style={styles.stepSubtitle}>
                This helps calculate your body composition
              </Text>
            </View>

            <View style={styles.stepContent}>
              <View style={styles.birthDateRow}>
                <View style={styles.birthDateColumnSmall}>
                  <Text style={styles.pickerLabel}>Day</Text>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={data.birth_day || '1'}
                      onValueChange={(value) =>
                        setData({ ...data, birth_day: value })
                      }
                      style={styles.picker}
                      itemStyle={styles.pickerItem}
                    >
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(
                        (day) => (
                          <Picker.Item
                            key={day}
                            label={`${day}`}
                            value={`${day}`}
                          />
                        ),
                      )}
                    </Picker>
                  </View>
                </View>
                <View style={styles.birthDateColumnSmall}>
                  <Text style={styles.pickerLabel}>Month</Text>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={data.birth_month || '1'}
                      onValueChange={(value) =>
                        setData({ ...data, birth_month: value })
                      }
                      style={styles.picker}
                      itemStyle={styles.pickerItem}
                    >
                      {[
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
                      ].map((month, index) => (
                        <Picker.Item
                          key={index + 1}
                          label={month}
                          value={`${index + 1}`}
                        />
                      ))}
                    </Picker>
                  </View>
                </View>
                <View style={styles.birthDateColumnYear}>
                  <Text style={styles.pickerLabel}>Year</Text>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={data.birth_year || '2000'}
                      onValueChange={(value) =>
                        setData({ ...data, birth_year: value })
                      }
                      style={styles.picker}
                      itemStyle={styles.pickerItem}
                    >
                      {Array.from(
                        { length: 108 },
                        (_, i) => new Date().getFullYear() - 13 - i,
                      ).map((year) => (
                        <Picker.Item
                          key={year}
                          label={`${year}`}
                          value={`${year}`}
                        />
                      ))}
                    </Picker>
                  </View>
                </View>
              </View>
            </View>
          </View>
        )
      case 6:
        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepTitle}>Thank you for trusting us!</Text>
              <Text style={styles.stepSubtitle}>
                Now let&rsquo;s personalize Rep AI for you...
              </Text>
            </View>

            <View style={styles.stepContent}>
              <View style={styles.privacyFooter}>
                <View style={styles.privacyIconBadge}>
                  <Ionicons
                    name="lock-closed"
                    size={22}
                    color={colors.primary}
                  />
                </View>
                <Text style={styles.privacyTitle}>
                  Your privacy and security matter to us.
                </Text>
                <Text style={styles.privacySubtitle}>
                  We promise to always keep your personal information safe and
                  secure.
                </Text>
              </View>
            </View>
          </View>
        )
      case 7:
        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepTitle}>
                What would you like to accomplish?
              </Text>
            </View>

            <View style={styles.stepContent}>
              <View style={styles.optionsContainer}>
                {GOALS.map((goal) => (
                  <HapticButton
                    key={goal.value}
                    style={[
                      styles.goalButton,
                      data.goal.includes(goal.value) &&
                        styles.goalButtonSelected,
                    ]}
                    onPress={() => {
                      const newGoals = data.goal.includes(goal.value)
                        ? data.goal.filter((g) => g !== goal.value)
                        : [...data.goal, goal.value]
                      setData({ ...data, goal: newGoals })
                    }}
                    hapticStyle="light"
                  >
                    <Text
                      style={[
                        styles.goalText,
                        data.goal.includes(goal.value) &&
                          styles.goalTextSelected,
                      ]}
                    >
                      {goal.label}
                    </Text>
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
              <Text style={styles.stepTitle}>How often do you work out?</Text>
            </View>

            <View style={styles.stepContent}>
              <View style={styles.optionsContainer}>
                {COMMITMENTS.map((commitment) => (
                  <HapticButton
                    key={commitment.value}
                    style={[
                      styles.goalButton,
                      data.commitment === commitment.value &&
                        styles.goalButtonSelected,
                    ]}
                    onPress={() =>
                      setData({ ...data, commitment: commitment.value })
                    }
                    hapticStyle="light"
                  >
                    <Text
                      style={[
                        styles.goalText,
                        data.commitment === commitment.value &&
                          styles.goalTextSelected,
                      ]}
                    >
                      {commitment.label}
                    </Text>
                  </HapticButton>
                ))}
              </View>
            </View>
          </View>
        )
      case 9:
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
                      styles.goalButton,
                      data.training_years === item.value &&
                        styles.goalButtonSelected,
                    ]}
                    onPress={() =>
                      setData({ ...data, training_years: item.value })
                    }
                    hapticStyle="light"
                  >
                    <Text
                      style={[
                        styles.goalText,
                        data.training_years === item.value &&
                          styles.goalTextSelected,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </HapticButton>
                ))}
              </View>
            </View>
          </View>
        )
      case 10:
        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepTitle}>Help train your AI assistant</Text>
              <Text style={styles.stepSubtitle}>
                <Text style={{ fontWeight: '700' }}>Optional</Text> - Helps
                personalize your experience
              </Text>
            </View>

            <View style={styles.stepContent}>
              <View>
                <AnimatedInput
                  style={styles.bioInput}
                  placeholder="e.g., I've been lifting for 2 years but took a 6-month break recently. I have an old knee injury so I avoid heavy squats."
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
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
              <Animated.View
                key={i}
                style={[
                  styles.progressDot,
                  i <= step && styles.progressDotActive,
                  {
                    transform: [
                      {
                        scale: i === step ? progressDotAnims[i - 1] : 1,
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
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
            scrollEnabled={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <View style={styles.contentWrapper}>
              <Animated.View
                style={[
                  {
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
      backgroundColor: colors.background,
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
      paddingTop: 40,
      paddingBottom: 16,
    },
    backButton: {
      padding: 4,
    },
    progressContainer: {
      flexDirection: 'row',
      gap: 8,
    },
    progressDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.border,
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
      paddingHorizontal: 32,
    },
    contentWrapper: {
      flex: 1,
      justifyContent: 'center',
    },
    animatedContent: {
      flex: 1,
    },
    stepContainer: {
      flex: 1,
      justifyContent: 'flex-start',
    },
    stepHeader: {
      paddingTop: 0,
      paddingBottom: 24,
    },
    stepTitle: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'left',
      marginBottom: 8,
    },
    stepSubtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'left',
      lineHeight: 22,
    },
    stepSubtitleBold: {
      fontWeight: '700',
      color: colors.text,
    },
    stepContent: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'stretch',
    },
    stepContentInner: {
      // Natural size, centered by parent
    },
    optionsContainer: {
      gap: 12,
    },
    optionButton: {
      height: 56,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    optionButtonSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    optionText: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
    },
    optionTextSelected: {
      color: colors.buttonText,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    input: {
      flex: 1,
      height: 64,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 32,
      paddingHorizontal: 20,
      fontSize: 24,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
    },
    inputLabel: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    nameInput: {
      height: 64,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 32,
      paddingHorizontal: 20,
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
    },
    goalButton: {
      height: 64,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 32,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    goalButtonSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    goalText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    goalTextSelected: {
      color: colors.buttonText,
    },
    footer: {
      paddingHorizontal: 32,
      paddingVertical: 16,
      paddingBottom: 32,
    },
    nextButton: {
      height: 56,
      backgroundColor: colors.primary,
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
    },
    nextButtonDisabled: {
      opacity: 0.4,
    },
    nextButtonText: {
      color: colors.buttonText,
      fontSize: 18,
      fontWeight: '700',
    },
    bioInput: {
      minHeight: 150,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 24,
      paddingHorizontal: 20,
      paddingVertical: 16,
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.inputBackground,
    },
    characterCount: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'right',
      marginTop: 8,
    },
    commitmentNote: {
      marginTop: 16,
      paddingHorizontal: 20,
      paddingVertical: 12,
      backgroundColor: colors.primary + '10',
      borderRadius: 12,
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
    },
    commitmentNoteText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.text,
      textAlign: 'center',
    },
    optionalText: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.textSecondary,
      marginBottom: 8,
    },
    aiProfileHeader: {
      alignItems: 'center',
      marginBottom: 48,
    },
    sparkleContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.primary + '15',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 20,
    },
    aiProfileTitle: {
      fontSize: 30,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 8,
    },
    aiProfileSubtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      paddingHorizontal: 20,
    },
    aiFeaturesList: {
      gap: 18,
      marginBottom: 40,
    },
    aiFeatureItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      paddingHorizontal: 4,
    },
    aiFeatureIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.primary + '15',
      justifyContent: 'center',
      alignItems: 'center',
    },
    aiFeatureContent: {
      flex: 1,
      justifyContent: 'center',
    },
    aiFeatureTitle: {
      fontSize: 19,
      fontWeight: '600',
      color: colors.text,
    },
    aiFeatureDescription: {
      fontSize: 15,
      color: colors.textSecondary,
      lineHeight: 21,
    },
    aiProfileFooter: {
      paddingTop: 28,
      paddingHorizontal: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      marginTop: 8,
    },
    aiProfileFooterText: {
      fontSize: 15,
      fontWeight: '500',
      color: colors.primary,
      textAlign: 'center',
      lineHeight: 21,
    },
    featureScreenHeader: {
      alignItems: 'center',
      marginBottom: 48,
    },
    featureIconContainer: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: colors.primary + '15',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 32,
    },
    featureHook: {
      fontSize: 36,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 8,
    },
    featureSubhook: {
      fontSize: 28,
      fontWeight: '600',
      color: colors.textSecondary,
      textAlign: 'center',
    },
    featureExampleContainer: {
      alignItems: 'stretch',
      paddingHorizontal: 0,
    },
    featureBubble: {
      backgroundColor: colors.primary + '15',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: colors.primary + '30',
      marginBottom: 16,
      alignSelf: 'center',
    },
    featureBubbleText: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.text,
      textAlign: 'center',
      lineHeight: 24,
    },
    featureArrow: {
      marginBottom: 16,
      alignSelf: 'center',
    },
    featureArrowText: {
      fontSize: 32,
      color: colors.primary,
      textAlign: 'center',
    },
    featureResult: {
      backgroundColor: '#10B98115',
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderRadius: 12,
      borderLeftWidth: 3,
      borderLeftColor: '#10B981',
    },
    featureResultText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
    },
    featureFooter: {
      paddingTop: 24,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    featureFooterText: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
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
      backgroundColor: colors.background,
      overflow: 'hidden',
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
    birthDateRow: {
      flexDirection: 'row',
      gap: 6,
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    birthDateColumnSmall: {
      flex: 1,
      alignItems: 'center',
      minWidth: 90,
    },
    birthDateColumnYear: {
      flex: 1.3,
      alignItems: 'center',
      minWidth: 120,
    },
    thankYouHeader: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 40,
      paddingBottom: 20,
    },
    clappingIconContainer: {
      marginBottom: 32,
    },
    thankYouTitle: {
      fontSize: 32,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 12,
      paddingHorizontal: 20,
    },
    thankYouSubtitle: {
      fontSize: 17,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
      paddingHorizontal: 24,
    },
    privacyFooter: {
      position: 'relative',
      marginHorizontal: 20,
      marginTop: 24,
      marginBottom: 0,
      paddingTop: 28,
      paddingBottom: 20,
      paddingHorizontal: 24,
      backgroundColor: colors.primary + '08',
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.primary + '20',
      alignItems: 'center',
    },
    privacyIconBadge: {
      position: 'absolute',
      top: -21,
      alignSelf: 'center',
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.primary + '20',
      justifyContent: 'center',
      alignItems: 'center',
    },
    privacyTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 8,
    },
    privacySubtitle: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 21,
      paddingHorizontal: 4,
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
    workoutGridPreview: {
      borderRadius: 12,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.white,
    },
    workoutTableHeader: {
      flexDirection: 'row',
      paddingVertical: 8,
      paddingHorizontal: 4,
      backgroundColor: colors.backgroundLight,
    },
    workoutTableHeaderText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    workoutHeaderDivider: {
      height: 1,
      backgroundColor: colors.border,
    },
    workoutTableRow: {
      flexDirection: 'row',
      paddingVertical: 10,
      paddingHorizontal: 4,
      backgroundColor: colors.backgroundLight,
    },
    workoutTableCell: {
      fontSize: 14,
      color: colors.text,
    },
    workoutExerciseCol: {
      flex: 3,
    },
    workoutSetsCol: {
      flex: 1,
      textAlign: 'center',
    },
    workoutRepsCol: {
      flex: 1.5,
      textAlign: 'center',
    },
    workoutWeightCol: {
      flex: 1.5,
      textAlign: 'right',
    },
    workoutExerciseName: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    workoutExerciseCell: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    workoutPrBadge: {
      backgroundColor: colors.primary,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      marginLeft: 2,
    },
    workoutPrBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.white,
      letterSpacing: 0.5,
    },
  })
