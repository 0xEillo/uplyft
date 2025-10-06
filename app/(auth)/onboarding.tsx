import { useThemedColors } from '@/hooks/useThemedColors'
import { Gender, Goal } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'

type OnboardingData = {
  name: string
  gender: Gender | null
  height_cm: string
  weight_kg: string
  goal: Goal | null
  bio: string
}

const GOALS: { value: Goal; label: string; icon: string }[] = [
  { value: 'build_muscle', label: 'Build Muscle', icon: 'fitness' },
  { value: 'gain_strength', label: 'Gain Strength', icon: 'barbell' },
  { value: 'lose_fat', label: 'Lose Fat', icon: 'flame' },
  { value: 'general_fitness', label: 'General Fitness', icon: 'heart' },
]

const GENDERS: { value: Gender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
]

export default function OnboardingScreen() {
  const [step, setStep] = useState(1)
  const [data, setData] = useState<OnboardingData>({
    name: '',
    gender: null,
    height_cm: '',
    weight_kg: '',
    goal: null,
    bio: '',
  })
  const colors = useThemedColors()
  const styles = createStyles(colors)

  const handleNext = () => {
    if (step < 6) {
      setStep(step + 1)
    } else {
      // Navigate to signup with onboarding data
      router.push({
        pathname: '/(auth)/signup',
        params: {
          onboarding_data: JSON.stringify({
            name: data.name,
            gender: data.gender,
            height_cm: data.height_cm ? parseFloat(data.height_cm) : null,
            weight_kg: data.weight_kg ? parseFloat(data.weight_kg) : null,
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
        return data.gender !== null
      case 3:
        return data.height_cm !== '' && parseFloat(data.height_cm) > 0
      case 4:
        return data.weight_kg !== '' && parseFloat(data.weight_kg) > 0
      case 5:
        return data.goal !== null
      case 6:
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
              <Ionicons name="person-outline" size={48} color={colors.primary} />
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
      case 2:
        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Ionicons name="person" size={48} color={colors.primary} />
              <Text style={styles.stepTitle}>What's your gender?</Text>
              <Text style={styles.stepSubtitle}>
                This helps us personalize your experience
              </Text>
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
      case 3:
        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Ionicons name="resize" size={48} color={colors.primary} />
              <Text style={styles.stepTitle}>What's your height?</Text>
              <Text style={styles.stepSubtitle}>Enter in centimeters</Text>
            </View>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="e.g., 175"
                placeholderTextColor={colors.textSecondary}
                value={data.height_cm}
                onChangeText={(text) => setData({ ...data, height_cm: text })}
                keyboardType="decimal-pad"
                autoFocus
              />
              <Text style={styles.inputLabel}>cm</Text>
            </View>
          </View>
        )
      case 4:
        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Ionicons name="scale" size={48} color={colors.primary} />
              <Text style={styles.stepTitle}>What's your weight?</Text>
              <Text style={styles.stepSubtitle}>Enter in kilograms</Text>
            </View>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="e.g., 70"
                placeholderTextColor={colors.textSecondary}
                value={data.weight_kg}
                onChangeText={(text) => setData({ ...data, weight_kg: text })}
                keyboardType="decimal-pad"
                autoFocus
              />
              <Text style={styles.inputLabel}>kg</Text>
            </View>
          </View>
        )
      case 5:
        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Ionicons name="trophy" size={48} color={colors.primary} />
              <Text style={styles.stepTitle}>What's your goal?</Text>
              <Text style={styles.stepSubtitle}>Choose your main focus</Text>
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
                    name={goal.icon as any}
                    size={32}
                    color={data.goal === goal.value ? colors.buttonText : colors.primary}
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
      case 6:
        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Ionicons name="chatbubbles-outline" size={48} color={colors.primary} />
              <Text style={styles.stepTitle}>Personalize your AI</Text>
              <Text style={styles.stepSubtitle}>
                Help your AI better understand you
              </Text>
            </View>
            <TextInput
              style={styles.bioInput}
              placeholder="E.g., I have a knee injury, I do powerlifting, I'm a beginner..."
              placeholderTextColor={colors.textSecondary}
              value={data.bio}
              onChangeText={(text) => setData({ ...data, bio: text })}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              autoFocus
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.progressContainer}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
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
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {renderStep()}
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.nextButton,
              !canProceed() && styles.nextButtonDisabled,
            ]}
            onPress={handleNext}
            disabled={!canProceed()}
          >
            <Text style={styles.nextButtonText}>
              {step === 6 ? 'Finish' : 'Next'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    keyboardView: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
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
  })
