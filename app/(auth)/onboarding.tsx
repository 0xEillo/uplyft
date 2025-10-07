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
  age: string
  goal: Goal | null
  commitment: string | null
  bio: string
}

const GOALS: { value: Goal; label: string; icon: string }[] = [
  { value: 'build_muscle', label: 'Build Muscle', icon: 'body' },
  { value: 'gain_strength', label: 'Gain Strength', icon: 'barbell' },
  { value: 'lose_fat', label: 'Lose Fat', icon: 'flame' },
  { value: 'general_fitness', label: 'General Fitness', icon: 'heart' },
]

const GENDERS: { value: Gender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
]

const COMMITMENTS: { value: string; label: string; icon: string }[] = [
  { value: '2_times', label: '2x per week', icon: 'calendar' },
  { value: '3_times', label: '3x per week', icon: 'calendar' },
  { value: '4_times', label: '4x per week', icon: 'calendar' },
  { value: '5_plus', label: '5+ per week', icon: 'flame' },
]

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

  const handleNext = () => {
    if (step < 6) {
      setStep(step + 1)
    } else {
      // Navigate to rating screen with onboarding data
      router.push({
        pathname: '/(auth)/rating',
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
        return data.name.trim() !== ''
      case 2:
        return data.gender !== null
      case 3:
        const height = parseFloat(data.height_cm)
        const weight = parseFloat(data.weight_kg)
        const age = parseInt(data.age)
        return (
          data.height_cm !== '' &&
          !isNaN(height) &&
          height >= 50 &&
          height <= 300 &&
          data.weight_kg !== '' &&
          !isNaN(weight) &&
          weight >= 20 &&
          weight <= 500 &&
          data.age !== '' &&
          !isNaN(age) &&
          age >= 13 &&
          age <= 120
        )
      case 4:
        return data.goal !== null
      case 5:
        return data.commitment !== null
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
              <Ionicons
                name="person-outline"
                size={48}
                color={colors.primary}
              />
              <Text style={styles.stepTitle}>What's your name</Text>
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
              <Text style={styles.stepTitle}>What's your gender</Text>
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
              <Ionicons name="body" size={48} color={colors.primary} />
              <Text style={styles.stepTitle}>Your body stats</Text>
              <View style={styles.socialProofBadge}>
                <Ionicons name="analytics" size={16} color={colors.primary} />
                <Text style={styles.socialProofText}>
                  For AI-powered body metrics
                </Text>
              </View>
            </View>
            <View style={styles.statsContainer}>
              <View style={styles.statInputGroup}>
                <Text style={styles.statLabel}>Height</Text>
                <View style={styles.statInputContainer}>
                  <TextInput
                    style={styles.statInput}
                    placeholder="175"
                    placeholderTextColor={colors.textSecondary}
                    value={data.height_cm}
                    onChangeText={(text) => {
                      // Only allow numbers and decimal point
                      const cleaned = text.replace(/[^0-9.]/g, '')
                      // Ensure only one decimal point
                      const parts = cleaned.split('.')
                      const formatted = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : cleaned
                      setData({ ...data, height_cm: formatted })
                    }}
                    keyboardType="decimal-pad"
                  />
                  <Text style={styles.statUnit}>cm</Text>
                </View>
              </View>
              <View style={styles.statInputGroup}>
                <Text style={styles.statLabel}>Weight</Text>
                <View style={styles.statInputContainer}>
                  <TextInput
                    style={styles.statInput}
                    placeholder="70"
                    placeholderTextColor={colors.textSecondary}
                    value={data.weight_kg}
                    onChangeText={(text) => {
                      // Only allow numbers and decimal point
                      const cleaned = text.replace(/[^0-9.]/g, '')
                      // Ensure only one decimal point
                      const parts = cleaned.split('.')
                      const formatted = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : cleaned
                      setData({ ...data, weight_kg: formatted })
                    }}
                    keyboardType="decimal-pad"
                  />
                  <Text style={styles.statUnit}>kg</Text>
                </View>
              </View>
              <View style={styles.statInputGroup}>
                <Text style={styles.statLabel}>Age</Text>
                <View style={styles.statInputContainer}>
                  <TextInput
                    style={styles.statInput}
                    placeholder="25"
                    placeholderTextColor={colors.textSecondary}
                    value={data.age}
                    onChangeText={(text) => {
                      // Only allow whole numbers for age
                      const cleaned = text.replace(/[^0-9]/g, '')
                      setData({ ...data, age: cleaned })
                    }}
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                  <Text style={styles.statUnit}>yrs</Text>
                </View>
              </View>
            </View>
          </View>
        )
      case 4:
        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Ionicons name="trophy" size={48} color={colors.primary} />
              <Text style={styles.stepTitle}>What's your goal</Text>
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
      case 5:
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
                    name={commitment.icon as any}
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
      case 6:
        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Ionicons
                name="flash"
                size={48}
                color={colors.primary}
              />
              <Text style={styles.stepTitle}>Tell your AI about yourself</Text>
              <Text style={styles.stepSubtitle}>
                Help your AI coach understand you better
              </Text>
            </View>
            <Text style={styles.optionalText}>Optional</Text>
            <TextInput
              style={styles.bioInput}
              placeholder="e.g., I'm recovering from a shoulder injury and prefer morning workouts"
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
      <View style={styles.wrapper}>
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
            <Text style={styles.nextButtonText}>
              {step === 6 ? 'Finish' : 'Next'}
            </Text>
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
    socialProofBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 16,
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: colors.primary + '15',
      borderRadius: 20,
    },
    socialProofText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primary,
    },
    statsContainer: {
      gap: 20,
    },
    statInputGroup: {
      gap: 8,
    },
    statLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      marginLeft: 4,
    },
    statInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    statInput: {
      flex: 1,
      height: 56,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 20,
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
      backgroundColor: colors.inputBackground,
    },
    statUnit: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textSecondary,
      width: 40,
    },
    commitmentNote: {
      marginTop: 16,
      paddingHorizontal: 20,
      paddingVertical: 12,
      backgroundColor: colors.primary + '10',
      borderRadius: 12,
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
      borderRightWidth: 3,
      borderRightColor: colors.primary,
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
  })
