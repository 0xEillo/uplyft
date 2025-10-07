import { COMMITMENTS, GENDERS, GOALS } from '@/constants/options'
import { useThemedColors } from '@/hooks/useThemedColors'
import { Gender, Goal } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

type OnboardingData = {
  name: string
  gender: Gender | null
  height_cm: string
  weight_kg: string
  age: string
  goal: Goal | null
  commitment: string | null
  bio: string
}

export default function OnboardingScreen() {
  const [step, setStep] = useState(1)
  const [data, setData] = useState<OnboardingData>({
    name: '',
    gender: null,
    height_cm: '',
    weight_kg: '',
    age: '',
    goal: null,
    commitment: null,
    bio: '',
  })
  const colors = useThemedColors()
  const styles = createStyles(colors)

  // Animation for lightning bolt
  const flashAnim = useRef(new Animated.Value(1)).current
  const pulseAnim = useRef(new Animated.Value(1)).current

  useEffect(() => {
    if (step === 7) {
      // Flash animation - quick opacity changes
      const flash = Animated.loop(
        Animated.sequence([
          Animated.timing(flashAnim, {
            toValue: 0.3,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(flashAnim, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(flashAnim, {
            toValue: 0.5,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(flashAnim, {
            toValue: 1,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.delay(2000),
        ]),
      )

      // Pulse animation - gentle scale
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      )

      // Delay animations by 0.2s
      const timer = setTimeout(() => {
        flash.start()
        pulse.start()
      }, 500)

      return () => {
        clearTimeout(timer)
        flash.stop()
        pulse.stop()
      }
    }
  }, [step])

  const handleNext = () => {
    if (step < 10) {
      setStep(step + 1)
    } else {
      // Navigate to congratulations screen with onboarding data
      router.push({
        pathname: '/(auth)/congratulations',
        params: {
          onboarding_data: JSON.stringify({
            name: data.name,
            gender: data.gender,
            height_cm: data.height_cm ? parseFloat(data.height_cm) : null,
            weight_kg: data.weight_kg ? parseFloat(data.weight_kg) : null,
            age: data.age ? parseInt(data.age) : null,
            goal: data.goal,
            commitment: data.commitment,
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
        return true // Feature screen
      case 2:
        return data.name.trim() !== ''
      case 3:
        return data.gender !== null
      case 4:
        const height = parseFloat(data.height_cm)
        return (
          data.height_cm !== '' &&
          !isNaN(height) &&
          height >= 50 &&
          height <= 300
        )
      case 5:
        const weight = parseFloat(data.weight_kg)
        return (
          data.weight_kg !== '' &&
          !isNaN(weight) &&
          weight >= 20 &&
          weight <= 500
        )
      case 6:
        const age = parseInt(data.age)
        return data.age !== '' && !isNaN(age) && age >= 13 && age <= 120
      case 7:
        return true // Info screen
      case 8:
        return data.goal !== null
      case 9:
        return true // Optional step
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
            <View style={styles.featureScreenHeader}>
              <View style={styles.featureIconContainer}>
                <Ionicons
                  name="chatbubble-ellipses"
                  size={56}
                  color={colors.primary}
                />
              </View>

              <Text style={styles.featureHook}>Log workouts in seconds</Text>

              <Text style={styles.featureSubhook}>Not minutes</Text>
            </View>

            <View style={styles.featureExampleContainer}>
              <View style={styles.featureBubble}>
                <Text style={styles.featureBubbleText}>
                  "I did bench press, 3 sets of 8 reps at 185lbs"
                </Text>
              </View>

              <View style={styles.featureArrow}>
                <Ionicons name="arrow-down" size={32} color={colors.primary} />
              </View>

              <View style={styles.featureResult}>
                <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                <Text style={styles.featureResultText}>
                  Logged instantly by your AI
                </Text>
              </View>
            </View>

            <View style={styles.featureFooter}>
              <Text style={styles.featureFooterText}>
                Your AI understands natural language. No tedious forms.
              </Text>
            </View>
          </View>
        )
      case 2:
        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Ionicons
                name="person-outline"
                size={48}
                color={colors.primary}
              />
              <Text style={styles.stepTitle}>What's your name?</Text>
              <Text style={styles.stepSubtitle}>
                This will be your display name
              </Text>
            </View>
            <TextInput
              style={styles.nameInput}
              placeholder="Enter your name"
              placeholderTextColor={colors.textSecondary}
              value={data.name}
              onChangeText={(text) => setData({ ...data, name: text })}
              autoFocus
              maxLength={50}
            />
          </View>
        )
      case 3:
        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Ionicons name="person" size={48} color={colors.primary} />
              <Text style={styles.stepTitle}>What's your gender?</Text>
            </View>
            <View style={styles.optionsContainer}>
              {GENDERS.map((gender) => (
                <TouchableOpacity
                  key={gender.value}
                  style={[
                    styles.optionButton,
                    data.gender === gender.value && styles.optionButtonSelected,
                  ]}
                  onPress={() => setData({ ...data, gender: gender.value })}
                >
                  <Text
                    style={[
                      styles.optionText,
                      data.gender === gender.value && styles.optionTextSelected,
                    ]}
                  >
                    {gender.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )
      case 4:
        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Ionicons name="resize" size={48} color={colors.primary} />
              <Text style={styles.stepTitle}>How tall are you?</Text>
            </View>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="175"
                placeholderTextColor={colors.textSecondary}
                value={data.height_cm}
                onChangeText={(text) => {
                  const cleaned = text.replace(/[^0-9.]/g, '')
                  const parts = cleaned.split('.')
                  const formatted =
                    parts.length > 2
                      ? parts[0] + '.' + parts.slice(1).join('')
                      : cleaned
                  setData({ ...data, height_cm: formatted })
                }}
                keyboardType="decimal-pad"
                autoFocus
                maxLength={5}
              />
              <Text style={styles.inputLabel}>cm</Text>
            </View>
          </View>
        )
      case 5:
        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Ionicons name="barbell" size={48} color={colors.primary} />
              <Text style={styles.stepTitle}>What's your weight?</Text>
            </View>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="70"
                placeholderTextColor={colors.textSecondary}
                value={data.weight_kg}
                onChangeText={(text) => {
                  const cleaned = text.replace(/[^0-9.]/g, '')
                  const parts = cleaned.split('.')
                  const formatted =
                    parts.length > 2
                      ? parts[0] + '.' + parts.slice(1).join('')
                      : cleaned
                  setData({ ...data, weight_kg: formatted })
                }}
                keyboardType="decimal-pad"
                autoFocus
                maxLength={5}
              />
              <Text style={styles.inputLabel}>kg</Text>
            </View>
          </View>
        )
      case 6:
        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Ionicons name="calendar" size={48} color={colors.primary} />
              <Text style={styles.stepTitle}>How old are you?</Text>
            </View>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="25"
                placeholderTextColor={colors.textSecondary}
                value={data.age}
                onChangeText={(text) => {
                  const cleaned = text.replace(/[^0-9]/g, '')
                  setData({ ...data, age: cleaned })
                }}
                keyboardType="number-pad"
                autoFocus
                maxLength={3}
              />
              <Text style={styles.inputLabel}>years old</Text>
            </View>
          </View>
        )
      case 7:
        return (
          <View style={styles.stepContainer}>
            <View style={styles.aiProfileHeader}>
              <View style={styles.sparkleContainer}>
                <Animated.View
                  style={{
                    opacity: flashAnim,
                    transform: [{ scale: pulseAnim }],
                  }}
                >
                  <Ionicons name="flash" size={48} color={colors.primary} />
                </Animated.View>
              </View>
              <Text style={styles.aiProfileTitle}>Building Your AI</Text>
              <Text style={styles.aiProfileSubtitle}>
                We're creating a personalized training assistant designed
                specifically for you
              </Text>
            </View>

            <View style={styles.aiFeaturesList}>
              <View style={styles.aiFeatureItem}>
                <View style={styles.aiFeatureIcon}>
                  <Ionicons name="fitness" size={24} color={colors.primary} />
                </View>
                <View style={styles.aiFeatureContent}>
                  <Text style={styles.aiFeatureTitle}>Tailored Workouts</Text>
                  <Text style={styles.aiFeatureDescription}>
                    Programs designed around your body, experience, and goals
                  </Text>
                </View>
              </View>

              <View style={styles.aiFeatureItem}>
                <View style={styles.aiFeatureIcon}>
                  <Ionicons
                    name="trending-up"
                    size={24}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.aiFeatureContent}>
                  <Text style={styles.aiFeatureTitle}>Smart Progression</Text>
                  <Text style={styles.aiFeatureDescription}>
                    Your AI adapts as you get stronger, ensuring constant growth
                  </Text>
                </View>
              </View>

              <View style={styles.aiFeatureItem}>
                <View style={styles.aiFeatureIcon}>
                  <Ionicons
                    name="chatbubbles"
                    size={24}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.aiFeatureContent}>
                  <Text style={styles.aiFeatureTitle}>24/7 Assistance</Text>
                  <Text style={styles.aiFeatureDescription}>
                    Ask anything, anytime. Form tips, exercise swaps, nutrition
                    advice
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.aiProfileFooter}>
              <Text style={styles.aiProfileFooterText}>
                Help us complete your profile to unlock the full power of your
                AI coach
              </Text>
            </View>
          </View>
        )
      case 7:
        return (
          <View style={styles.stepContainer}>
            <View style={styles.featureScreenHeader}>
              <View style={styles.featureIconContainer}>
                <Ionicons
                  name="chatbubble-ellipses"
                  size={56}
                  color={colors.primary}
                />
              </View>

              <Text style={styles.featureHook}>Log workouts in seconds</Text>

              <Text style={styles.featureSubhook}>Not minutes</Text>
            </View>

            <View style={styles.featureExampleContainer}>
              <View style={styles.featureBubble}>
                <Text style={styles.featureBubbleText}>
                  "I did bench press, 3 sets of 8 reps at 185lbs"
                </Text>
              </View>

              <View style={styles.featureArrow}>
                <Ionicons name="arrow-down" size={32} color={colors.primary} />
              </View>

              <View style={styles.featureResult}>
                <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                <Text style={styles.featureResultText}>
                  Logged instantly by your AI
                </Text>
              </View>
            </View>

            <View style={styles.featureFooter}>
              <Text style={styles.featureFooterText}>
                Your AI understands natural language. No tedious forms.
              </Text>
            </View>
          </View>
        )
      case 8:
        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepTitle}>What's your goal?</Text>
            </View>
            <View style={styles.optionsContainer}>
              {GOALS.map((goal) => (
                <TouchableOpacity
                  key={goal.value}
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
              ))}
            </View>
          </View>
        )
      case 9:
        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Ionicons name="rocket" size={48} color={colors.primary} />
              <Text style={styles.stepTitle}>Your commitment</Text>
              <View style={styles.commitmentNote}>
                <Text style={styles.commitmentNoteText}>
                  People who commit are 3x more likely to reach their goals
                </Text>
              </View>
            </View>
            <Text style={styles.optionalText}>Optional</Text>
            <View style={styles.optionsContainer}>
              {COMMITMENTS.map((commitment) => (
                <TouchableOpacity
                  key={commitment.value}
                  style={[
                    styles.optionButton,
                    data.commitment === commitment.value &&
                      styles.optionButtonSelected,
                  ]}
                  onPress={() =>
                    setData({ ...data, commitment: commitment.value })
                  }
                >
                  <Ionicons
                    name={commitment.icon}
                    size={24}
                    color={
                      data.commitment === commitment.value
                        ? colors.buttonText
                        : colors.primary
                    }
                  />
                  <Text
                    style={[
                      styles.optionText,
                      data.commitment === commitment.value &&
                        styles.optionTextSelected,
                    ]}
                  >
                    {commitment.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )
      case 10:
        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Ionicons name="flash" size={48} color={colors.primary} />
              <Text style={styles.stepTitle}>Tell your AI about yourself</Text>
            </View>
            <Text style={styles.optionalText}>Optional</Text>
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
              <View
                key={i}
                style={[
                  styles.progressDot,
                  i <= step && styles.progressDotActive,
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
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.nextButton,
              !canProceed() && styles.nextButtonDisabled,
            ]}
            onPress={handleNext}
            disabled={!canProceed()}
          >
            <Text style={styles.nextButtonText}>Next</Text>
          </TouchableOpacity>
        </View>
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
      marginBottom: 40,
    },
    sparkleContainer: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: colors.primary + '15',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 24,
    },
    aiProfileTitle: {
      fontSize: 32,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 12,
    },
    aiProfileSubtitle: {
      fontSize: 17,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
      paddingHorizontal: 16,
    },
    aiFeaturesList: {
      gap: 20,
      marginBottom: 32,
    },
    aiFeatureItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 16,
    },
    aiFeatureIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.primary + '15',
      justifyContent: 'center',
      alignItems: 'center',
    },
    aiFeatureContent: {
      flex: 1,
      paddingTop: 4,
    },
    aiFeatureTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    aiFeatureDescription: {
      fontSize: 15,
      color: colors.textSecondary,
      lineHeight: 21,
    },
    aiProfileFooter: {
      paddingTop: 24,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    aiProfileFooterText: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.primary,
      textAlign: 'center',
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
  })
