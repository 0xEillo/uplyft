import { GENDERS, GOALS } from '@/constants/options'
import { useThemedColors } from '@/hooks/useThemedColors'
import { Gender, Goal } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { Picker } from '@react-native-picker/picker'
import { router } from 'expo-router'
import React, { useEffect, useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

type OnboardingData = {
  name: string
  gender: Gender | null
  height_cm: string
  weight_kg: string
  birth_day: string
  birth_month: string
  birth_year: string
  goal: Goal | null
  bio: string
}

// Animated TouchableOpacity with press animation
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity)

// Animated Button with scale press effect
function AnimatedButton({
  onPress,
  disabled,
  style,
  children,
}: {
  onPress: () => void
  disabled?: boolean
  style: any
  children: React.ReactNode
}) {
  const scale = useSharedValue(1)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const handlePressIn = () => {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 400 })
  }

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 })
  }

  return (
    <AnimatedTouchable
      style={[style, animatedStyle]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      activeOpacity={0.9}
    >
      {children}
    </AnimatedTouchable>
  )
}

export default function OnboardingScreen() {
  const [step, setStep] = useState(1)
  const [data, setData] = useState<OnboardingData>({
    name: '',
    gender: null,
    height_cm: '',
    weight_kg: '',
    birth_day: '',
    birth_month: '',
    birth_year: '',
    goal: null,
    bio: '',
  })
  const colors = useThemedColors()
  const styles = createStyles(colors)

  // Animation values
  const contentOpacity = useSharedValue(1)
  const contentTranslateY = useSharedValue(0)

  // Trigger animation when step changes
  useEffect(() => {
    contentOpacity.value = 0
    contentTranslateY.value = 30
    contentOpacity.value = withSpring(1, { damping: 20, stiffness: 90 })
    contentTranslateY.value = withSpring(0, { damping: 20, stiffness: 90 })
  }, [step])

  // Animated style for content
  const animatedContentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateY: contentTranslateY.value }],
  }))

  const handleNext = () => {
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

      // Navigate to congratulations screen with onboarding data
      router.push({
        pathname: '/(auth)/congratulations',
        params: {
          onboarding_data: JSON.stringify({
            name: data.name,
            gender: data.gender,
            height_cm: data.height_cm ? parseFloat(data.height_cm) : null,
            weight_kg: data.weight_kg ? parseFloat(data.weight_kg) : null,
            age: age,
            goal: data.goal,
            bio: data.bio.trim() || null,
          }),
        },
      })
    }
  }

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1)
    } else {
      router.back()
    }
  }

  const canProceed = () => {
    switch (step) {
      case 1:
        return data.name.trim() !== ''
      case 2:
        return true // Feature screen
      case 3:
        return data.gender !== null
      case 4:
        const height = parseFloat(data.height_cm)
        const weight = parseFloat(data.weight_kg)
        return (
          data.height_cm !== '' &&
          !isNaN(height) &&
          height >= 50 &&
          height <= 300 &&
          data.weight_kg !== '' &&
          !isNaN(weight) &&
          weight >= 20 &&
          weight <= 500
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
        return data.goal !== null
      case 8:
        return true // Optional step
      default:
        return false
    }
  }

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <Animated.View style={[styles.stepContainer, animatedContentStyle]}>
            <Animated.View
              style={styles.stepHeader}
              entering={FadeInDown.delay(100).springify()}
            >
              <Ionicons
                name="person-outline"
                size={48}
                color={colors.primary}
              />
              <Text style={styles.stepTitle}>Choose your name</Text>
            </Animated.View>
            <Animated.View entering={FadeInDown.delay(200).springify()}>
              <TextInput
                style={styles.nameInput}
                placeholder="Enter your name"
                placeholderTextColor={colors.textSecondary}
                value={data.name}
                onChangeText={(text) => setData({ ...data, name: text })}
                autoFocus
                maxLength={50}
              />
            </Animated.View>
          </Animated.View>
        )
      case 2:
        return (
          <Animated.View style={[styles.stepContainer, animatedContentStyle]}>
            <View style={styles.featureScreenHeader}>
              <Animated.View
                style={styles.featureIconContainer}
                entering={FadeIn.delay(100).duration(600)}
              >
                <Ionicons
                  name="chatbubble-ellipses"
                  size={56}
                  color={colors.primary}
                />
              </Animated.View>

              <Animated.Text
                style={styles.featureHook}
                entering={FadeIn.delay(200).duration(600)}
              >
                Log workouts in seconds
              </Animated.Text>
            </View>

            <View style={styles.featureExampleContainer}>
              <Animated.View
                style={styles.featureBubble}
                entering={FadeIn.delay(300).duration(600)}
              >
                <Text style={styles.featureBubbleText}>
                  "I did bench press, 3 sets of 8 reps at 185lbs"
                </Text>
              </Animated.View>

              <Animated.View
                style={styles.featureArrow}
                entering={FadeIn.delay(400).duration(600)}
              >
                <Ionicons name="arrow-down" size={32} color={colors.primary} />
              </Animated.View>

              <Animated.View
                style={styles.featureResult}
                entering={FadeIn.delay(500).duration(600)}
              >
                <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                <Text style={styles.featureResultText}>
                  Logged instantly by your AI
                </Text>
              </Animated.View>
            </View>
          </Animated.View>
        )
      case 3:
        return (
          <Animated.View style={[styles.stepContainer, animatedContentStyle]}>
            <Animated.View
              style={styles.stepHeader}
              entering={FadeInDown.delay(100).springify()}
            >
              <Ionicons name="person" size={48} color={colors.primary} />
              <Text style={styles.stepTitle}>Choose your gender</Text>
            </Animated.View>
            <View style={styles.optionsContainer}>
              {GENDERS.map((gender, index) => (
                <Animated.View
                  key={gender.value}
                  entering={FadeInDown.delay(200 + index * 80).springify()}
                >
                  <TouchableOpacity
                    style={[
                      styles.optionButton,
                      data.gender === gender.value &&
                        styles.optionButtonSelected,
                    ]}
                    onPress={() => setData({ ...data, gender: gender.value })}
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
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </View>
          </Animated.View>
        )
      case 4:
        return (
          <Animated.View style={[styles.stepContainer, animatedContentStyle]}>
            <Animated.View
              style={styles.stepHeader}
              entering={FadeInDown.delay(100).springify()}
            >
              <Ionicons name="body" size={48} color={colors.primary} />
              <Text style={styles.stepTitle}>Height & Weight</Text>
            </Animated.View>
            <Animated.View
              style={styles.pickerRow}
              entering={FadeInDown.delay(200).springify()}
            >
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>Height (cm)</Text>
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
                          label={`${height}`}
                          value={`${height}`}
                        />
                      ),
                    )}
                  </Picker>
                </View>
              </View>
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>Weight (kg)</Text>
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
                          label={`${weight}`}
                          value={`${weight}`}
                        />
                      ),
                    )}
                  </Picker>
                </View>
              </View>
            </Animated.View>
          </Animated.View>
        )
      case 5:
        return (
          <Animated.View style={[styles.stepContainer, animatedContentStyle]}>
            <Animated.View
              style={styles.stepHeader}
              entering={FadeInDown.delay(100).springify()}
            >
              <Ionicons name="calendar" size={48} color={colors.primary} />
              <Text style={styles.stepTitle}>When were you born?</Text>
            </Animated.View>
            <Animated.View
              style={styles.birthDateRow}
              entering={FadeInDown.delay(200).springify()}
            >
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
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                      <Picker.Item
                        key={day}
                        label={`${day}`}
                        value={`${day}`}
                      />
                    ))}
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
            </Animated.View>
          </Animated.View>
        )
      case 6:
        return (
          <Animated.View style={[styles.stepContainer, animatedContentStyle]}>
            <View style={styles.thankYouHeader}>
              <Animated.View
                style={styles.clappingIconContainer}
                entering={FadeInDown.delay(100).springify()}
              >
                <Ionicons name="happy" size={72} color={colors.primary} />
              </Animated.View>
              <Animated.Text
                style={styles.thankYouTitle}
                entering={FadeInDown.delay(200).springify()}
              >
                Thank you for trusting us!
              </Animated.Text>
              <Animated.Text
                style={styles.thankYouSubtitle}
                entering={FadeInDown.delay(300).springify()}
              >
                Now let's personalize Rep AI for you...
              </Animated.Text>
            </View>

            <Animated.View
              style={styles.privacyFooter}
              entering={FadeInDown.delay(400).springify()}
            >
              <Text style={styles.privacyTitle}>
                Your privacy and security matter to us.
              </Text>
              <Text style={styles.privacySubtitle}>
                We promise to always keep your personal information safe and
                secure.
              </Text>
            </Animated.View>
          </Animated.View>
        )
      case 7:
        return (
          <Animated.View style={[styles.stepContainer, animatedContentStyle]}>
            <Animated.View
              style={styles.stepHeader}
              entering={FadeInDown.delay(100).springify()}
            >
              <Text style={styles.stepTitle}>
                What would you like to accomplish?
              </Text>
            </Animated.View>
            <View style={styles.optionsContainer}>
              {GOALS.map((goal, index) => (
                <Animated.View
                  key={goal.value}
                  entering={FadeInDown.delay(200 + index * 100).springify()}
                >
                  <TouchableOpacity
                    style={[
                      styles.goalButton,
                      data.goal === goal.value && styles.goalButtonSelected,
                    ]}
                    onPress={() => setData({ ...data, goal: goal.value })}
                  >
                    <Ionicons
                      name={goal.icon}
                      size={32}
                      color={
                        data.goal === goal.value
                          ? colors.buttonText
                          : colors.primary
                      }
                    />
                    <Text
                      style={[
                        styles.goalText,
                        data.goal === goal.value && styles.goalTextSelected,
                      ]}
                    >
                      {goal.label}
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </View>
          </Animated.View>
        )
      case 8:
        return (
          <Animated.View style={[styles.stepContainer, animatedContentStyle]}>
            <Animated.View
              style={styles.stepHeader}
              entering={FadeInDown.delay(100).springify()}
            >
              <Ionicons name="flash" size={48} color={colors.primary} />
              <Text style={styles.stepTitle}>Tell your AI about yourself</Text>
            </Animated.View>
            <Animated.Text
              style={styles.optionalText}
              entering={FadeInDown.delay(200).springify()}
            >
              Optional
            </Animated.Text>
            <Animated.View entering={FadeInDown.delay(250).springify()}>
              <TextInput
                style={styles.bioInput}
                placeholder="e.g., I've been lifting for 2 years but took a 6-month break recently. I have an old knee injury so I avoid heavy squats. I prefer high volume training with shorter rest periods."
                placeholderTextColor={colors.textSecondary}
                value={data.bio}
                onChangeText={(text) => setData({ ...data, bio: text })}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                maxLength={500}
              />
              <Text style={styles.characterCount}>{data.bio.length}/500</Text>
            </Animated.View>
          </Animated.View>
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
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <Animated.View
                key={i}
                style={[
                  styles.progressDot,
                  i <= step && styles.progressDotActive,
                ]}
                entering={FadeIn.delay(i * 50).springify()}
              />
            ))}
          </View>
          <View style={styles.placeholder} />
        </View>

        {/* Content */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {renderStep()}
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Footer - Fixed at bottom */}
        <Animated.View
          style={styles.footer}
          entering={FadeInDown.delay(100).springify()}
        >
          <AnimatedButton
            style={[
              styles.nextButton,
              !canProceed() && styles.nextButtonDisabled,
            ]}
            onPress={handleNext}
            disabled={!canProceed()}
          >
            <Text style={styles.nextButtonText}>Next</Text>
          </AnimatedButton>
        </Animated.View>
      </View>
    </SafeAreaView>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
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
    stepContainer: {
      flex: 1,
      justifyContent: 'center',
      paddingVertical: 32,
    },
    stepHeader: {
      alignItems: 'center',
      marginBottom: 48,
    },
    stepTitle: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
      marginTop: 24,
      textAlign: 'center',
    },
    stepSubtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      marginTop: 8,
      textAlign: 'center',
    },
    optionsContainer: {
      gap: 12,
    },
    optionButton: {
      height: 56,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 12,
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
      borderRadius: 12,
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
      borderRadius: 12,
      paddingHorizontal: 20,
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
    },
    goalButton: {
      height: 80,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      backgroundColor: colors.background,
    },
    goalButtonSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    goalText: {
      fontSize: 18,
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
      borderRadius: 12,
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
      borderRadius: 12,
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
      alignItems: 'center',
      marginBottom: 40,
    },
    featureBubble: {
      backgroundColor: colors.primary + '15',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: colors.primary + '30',
      marginBottom: 16,
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
    },
    featureResult: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: '#10B98115',
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 12,
      borderLeftWidth: 3,
      borderLeftColor: '#10B981',
    },
    featureResultText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
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
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 12,
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
      marginHorizontal: 20,
      marginBottom: 0,
      paddingVertical: 16,
      paddingHorizontal: 20,
      backgroundColor: colors.primary + '08',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.primary + '20',
      alignItems: 'center',
    },
    privacyTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 6,
    },
    privacySubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 18,
      paddingHorizontal: 4,
    },
  })
