import AsyncStorage from '@react-native-async-storage/async-storage'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useEffect, useState } from 'react'
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native'

const PLAN_WORKOUT_PREFS_KEY = '@plan_workout_preferences'
const EQUIPMENT_PREF_KEY = '@equipment_preference'

export type EquipmentType =
  | 'full_gym'
  | 'dumbbells_only'
  | 'home_minimal'
  | 'bodyweight'
  | 'barbell_only'

export interface PlanWorkoutData {
  muscles: string
  duration: string
  intensity: string
  equipment: EquipmentType
  specifics: string
}

interface PlanWorkoutWizardProps {
  colors: {
    background: string
    backgroundLight: string
    text: string
    textSecondary: string
    primary: string
    border: string
    white: string
  }
  onComplete: (data: PlanWorkoutData) => void
  onCancel: () => void
}

type WizardStep = 'muscles' | 'duration' | 'intensity' | 'equipment' | 'specifics' | 'confirm'

const MUSCLE_OPTIONS = [
  { label: 'Push', value: 'Push (Chest, Shoulders, Triceps)' },
  { label: 'Pull', value: 'Pull (Back, Biceps)' },
  { label: 'Legs', value: 'Legs (Quads, Hamstrings, Glutes, Calves)' },
  { label: 'Upper Body', value: 'Upper Body' },
  { label: 'Lower Body', value: 'Lower Body' },
  { label: 'Full Body', value: 'Full Body' },
  { label: 'Chest', value: 'Chest' },
  { label: 'Back', value: 'Back' },
  { label: 'Shoulders', value: 'Shoulders' },
  { label: 'Arms', value: 'Arms (Biceps, Triceps)' },
  { label: 'Core', value: 'Core / Abs' },
]

const DURATION_OPTIONS = [
  { label: '20 min', value: '20 minutes' },
  { label: '30 min', value: '30 minutes' },
  { label: '45 min', value: '45 minutes' },
  { label: '1 hour', value: '1 hour' },
  { label: '90 min', value: '90 minutes' },
]

const INTENSITY_OPTIONS = [
  { label: 'Strength', value: 'Strength focus (heavy weight, low reps)' },
  { label: 'Hypertrophy', value: 'Hypertrophy (moderate weight, 8-12 reps)' },
  { label: 'Endurance', value: 'Endurance (lighter weight, high reps)' },
  { label: 'HIIT', value: 'HIIT / Circuit style' },
  { label: 'General', value: 'General fitness (balanced)' },
]

const EQUIPMENT_OPTIONS: { label: string; value: EquipmentType; description: string }[] = [
  { label: 'Full Gym', value: 'full_gym', description: 'All machines & free weights' },
  { label: 'Dumbbells Only', value: 'dumbbells_only', description: 'Just dumbbells' },
  { label: 'Home / Minimal', value: 'home_minimal', description: 'Basic home equipment' },
  { label: 'Bodyweight', value: 'bodyweight', description: 'No equipment needed' },
  { label: 'Barbell Only', value: 'barbell_only', description: 'Barbell & plates' },
]

const STEPS: WizardStep[] = ['muscles', 'duration', 'intensity', 'equipment', 'specifics', 'confirm']

export function PlanWorkoutWizard({ colors, onComplete, onCancel }: PlanWorkoutWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('muscles')
  const [data, setData] = useState<PlanWorkoutData>({
    muscles: '',
    duration: '',
    intensity: '',
    equipment: 'full_gym',
    specifics: '',
  })
  const [customInput, setCustomInput] = useState('')
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [savedEquipment, setSavedEquipment] = useState<EquipmentType | null>(null)

  // Load saved preferences on mount
  useEffect(() => {
    loadSavedPreferences()
  }, [])

  const loadSavedPreferences = async () => {
    try {
      const [prefsJson, equipmentJson] = await Promise.all([
        AsyncStorage.getItem(PLAN_WORKOUT_PREFS_KEY),
        AsyncStorage.getItem(EQUIPMENT_PREF_KEY),
      ])

      if (prefsJson) {
        const prefs = JSON.parse(prefsJson) as Partial<PlanWorkoutData>
        setData((prev) => ({
          ...prev,
          muscles: prefs.muscles || '',
          duration: prefs.duration || '',
          intensity: prefs.intensity || '',
          specifics: prefs.specifics || '',
        }))
      }

      if (equipmentJson) {
        const equipment = JSON.parse(equipmentJson) as EquipmentType
        setSavedEquipment(equipment)
        setData((prev) => ({ ...prev, equipment }))
      }
    } catch (error) {
      console.error('Error loading plan workout preferences:', error)
    }
  }

  const savePreferences = async (finalData: PlanWorkoutData) => {
    try {
      await Promise.all([
        AsyncStorage.setItem(PLAN_WORKOUT_PREFS_KEY, JSON.stringify({
          muscles: finalData.muscles,
          duration: finalData.duration,
          intensity: finalData.intensity,
          specifics: finalData.specifics,
        })),
        AsyncStorage.setItem(EQUIPMENT_PREF_KEY, JSON.stringify(finalData.equipment)),
      ])
    } catch (error) {
      console.error('Error saving plan workout preferences:', error)
    }
  }

  const currentStepIndex = STEPS.indexOf(currentStep)
  const totalSteps = STEPS.length

  const canGoNext = () => {
    switch (currentStep) {
      case 'muscles':
        return data.muscles.length > 0
      case 'duration':
        return data.duration.length > 0
      case 'intensity':
        return data.intensity.length > 0
      case 'equipment':
        return data.equipment.length > 0
      case 'specifics':
        return true // Optional
      case 'confirm':
        return true
      default:
        return false
    }
  }

  const handleNext = () => {
    if (!canGoNext()) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    
    // If using custom input, apply it
    if (showCustomInput && customInput.trim()) {
      const field = currentStep as keyof PlanWorkoutData
      if (field !== 'equipment') {
        setData((prev) => ({ ...prev, [field]: customInput.trim() }))
      }
      setCustomInput('')
      setShowCustomInput(false)
    }

    const nextIndex = currentStepIndex + 1
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex])
    }
  }

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setShowCustomInput(false)
    setCustomInput('')
    
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex])
    } else {
      onCancel()
    }
  }

  const handleSelectOption = (field: keyof PlanWorkoutData, value: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setData((prev) => ({ ...prev, [field]: value }))
    setShowCustomInput(false)
    setCustomInput('')
  }

  const handleConfirm = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    await savePreferences(data)
    onComplete(data)
  }

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    // For specifics step, just move to next without requiring input
    if (currentStep === 'specifics') {
      setData((prev) => ({ ...prev, specifics: '' }))
    }
    handleNext()
  }

  const renderStepIndicator = () => (
    <View style={styles.stepIndicatorContainer}>
      {STEPS.map((step, index) => (
        <View
          key={step}
          style={[
            styles.stepDot,
            {
              backgroundColor:
                index <= currentStepIndex ? colors.primary : colors.border,
            },
          ]}
        />
      ))}
    </View>
  )

  const renderChips = (
    options: { label: string; value: string; description?: string }[],
    field: keyof PlanWorkoutData,
    allowCustom = true
  ) => (
    <View style={styles.chipsContainer}>
      {options.map((option) => {
        const isSelected = data[field] === option.value
        return (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.chip,
              {
                backgroundColor: isSelected ? colors.primary : colors.backgroundLight,
                borderColor: isSelected ? colors.primary : colors.border,
              },
            ]}
            onPress={() => handleSelectOption(field, option.value)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.chipText,
                { color: isSelected ? colors.white : colors.text },
              ]}
            >
              {option.label}
            </Text>
            {option.description && (
              <Text
                style={[
                  styles.chipDescription,
                  { color: isSelected ? colors.white : colors.textSecondary },
                ]}
              >
                {option.description}
              </Text>
            )}
          </TouchableOpacity>
        )
      })}
      {allowCustom && (
        <TouchableOpacity
          style={[
            styles.chip,
            styles.customChip,
            {
              backgroundColor: showCustomInput ? colors.primary : colors.backgroundLight,
              borderColor: showCustomInput ? colors.primary : colors.border,
            },
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            setShowCustomInput(!showCustomInput)
          }}
          activeOpacity={0.7}
        >
          <Ionicons
            name="add"
            size={16}
            color={showCustomInput ? colors.white : colors.primary}
          />
          <Text
            style={[
              styles.chipText,
              { color: showCustomInput ? colors.white : colors.primary },
            ]}
          >
            Custom
          </Text>
        </TouchableOpacity>
      )}
    </View>
  )

  const renderCustomInput = (placeholder: string) => {
    if (!showCustomInput) return null
    return (
      <View style={[styles.customInputContainer, { backgroundColor: colors.backgroundLight }]}>
        <TextInput
          style={[styles.customInput, { color: colors.text }]}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          value={customInput}
          onChangeText={(text) => {
            setCustomInput(text)
            // Also update data so canGoNext works
            const field = currentStep as keyof PlanWorkoutData
            if (field !== 'equipment') {
              setData((prev) => ({ ...prev, [field]: text }))
            }
          }}
          autoFocus
        />
      </View>
    )
  }

  const renderMusclesStep = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: colors.text }]}>
        What muscle groups do you want to train?
      </Text>
      <ScrollView
        style={styles.optionsScroll}
        showsVerticalScrollIndicator={false}
      >
        {renderChips(MUSCLE_OPTIONS, 'muscles')}
        {renderCustomInput('e.g., Chest and Back, Glutes only...')}
      </ScrollView>
    </View>
  )

  const renderDurationStep = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: colors.text }]}>
        How much time do you have?
      </Text>
      <ScrollView
        style={styles.optionsScroll}
        showsVerticalScrollIndicator={false}
      >
        {renderChips(DURATION_OPTIONS, 'duration')}
        {renderCustomInput('e.g., 40 minutes, 2 hours...')}
      </ScrollView>
    </View>
  )

  const renderIntensityStep = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: colors.text }]}>
        What's your training focus today?
      </Text>
      <ScrollView
        style={styles.optionsScroll}
        showsVerticalScrollIndicator={false}
      >
        {renderChips(INTENSITY_OPTIONS, 'intensity')}
        {renderCustomInput('e.g., Low volume strength, Drop sets...')}
      </ScrollView>
    </View>
  )

  const renderEquipmentStep = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: colors.text }]}>
        What equipment do you have access to?
      </Text>
      {savedEquipment && (
        <Text style={[styles.savedHint, { color: colors.textSecondary }]}>
          Your saved preference: {EQUIPMENT_OPTIONS.find((o) => o.value === savedEquipment)?.label}
        </Text>
      )}
      <ScrollView
        style={styles.optionsScroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.chipsContainer}>
          {EQUIPMENT_OPTIONS.map((option) => {
            const isSelected = data.equipment === option.value
            return (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.chip,
                  styles.equipmentChip,
                  {
                    backgroundColor: isSelected ? colors.primary : colors.backgroundLight,
                    borderColor: isSelected ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => handleSelectOption('equipment', option.value)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: isSelected ? colors.white : colors.text },
                  ]}
                >
                  {option.label}
                </Text>
                <Text
                  style={[
                    styles.chipDescription,
                    { color: isSelected ? colors.white : colors.textSecondary },
                  ]}
                >
                  {option.description}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>
      </ScrollView>
    </View>
  )

  const renderSpecificsStep = () => (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.stepContent}>
        <Text style={[styles.stepTitle, { color: colors.text }]}>
          Any specific requests or injuries?
        </Text>
        <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
          Optional - skip if none
        </Text>
        <View style={[styles.specificsInputContainer, { backgroundColor: colors.backgroundLight }]}>
          <TextInput
            style={[styles.specificsInput, { color: colors.text }]}
            placeholder="e.g., No deadlifts, focus on compound movements, include supersets..."
            placeholderTextColor={colors.textSecondary}
            value={data.specifics}
            onChangeText={(text) => setData((prev) => ({ ...prev, specifics: text }))}
            multiline
            numberOfLines={3}
            blurOnSubmit
            returnKeyType="done"
          />
        </View>
      </View>
    </TouchableWithoutFeedback>
  )

  const renderConfirmStep = () => {
    const equipmentLabel = EQUIPMENT_OPTIONS.find((o) => o.value === data.equipment)?.label || data.equipment
    
    return (
      <View style={styles.stepContent}>
        <Text style={[styles.stepTitle, { color: colors.text }]}>
          Ready to generate your workout?
        </Text>
        <View style={[styles.summaryCard, { backgroundColor: colors.backgroundLight }]}>
          <SummaryRow
            label="Muscles"
            value={data.muscles}
            colors={colors}
            onEdit={() => setCurrentStep('muscles')}
          />
          <SummaryRow
            label="Duration"
            value={data.duration}
            colors={colors}
            onEdit={() => setCurrentStep('duration')}
          />
          <SummaryRow
            label="Focus"
            value={data.intensity}
            colors={colors}
            onEdit={() => setCurrentStep('intensity')}
          />
          <SummaryRow
            label="Equipment"
            value={equipmentLabel}
            colors={colors}
            onEdit={() => setCurrentStep('equipment')}
          />
          {data.specifics ? (
            <SummaryRow
              label="Notes"
              value={data.specifics}
              colors={colors}
              onEdit={() => setCurrentStep('specifics')}
            />
          ) : null}
        </View>
      </View>
    )
  }

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'muscles':
        return renderMusclesStep()
      case 'duration':
        return renderDurationStep()
      case 'intensity':
        return renderIntensityStep()
      case 'equipment':
        return renderEquipmentStep()
      case 'specifics':
        return renderSpecificsStep()
      case 'confirm':
        return renderConfirmStep()
      default:
        return null
    }
  }

  const styles = createStyles(colors)

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 50 : 0}
    >
      {renderStepIndicator()}
      {renderCurrentStep()}
      <View style={styles.navigationContainer}>
        <TouchableOpacity
          style={[styles.navButton, styles.backButton, { borderColor: colors.border }]}
          onPress={handleBack}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text} />
          <Text style={[styles.navButtonText, { color: colors.text }]}>
            {currentStepIndex === 0 ? 'Cancel' : 'Back'}
          </Text>
        </TouchableOpacity>

        {currentStep === 'specifics' && (
          <TouchableOpacity
            style={[styles.navButton, styles.skipButton, { borderColor: colors.border }]}
            onPress={handleSkip}
            activeOpacity={0.7}
          >
            <Text style={[styles.navButtonText, { color: colors.textSecondary }]}>
              Skip
            </Text>
          </TouchableOpacity>
        )}

        {currentStep === 'confirm' ? (
          <TouchableOpacity
            style={[styles.navButton, styles.confirmButton, { backgroundColor: colors.primary }]}
            onPress={handleConfirm}
            activeOpacity={0.7}
          >
            <Ionicons name="flash" size={20} color={colors.white} />
            <Text style={[styles.navButtonText, { color: colors.white }]}>
              Generate
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.navButton,
              styles.nextButton,
              {
                backgroundColor: canGoNext() ? colors.primary : colors.backgroundLight,
              },
            ]}
            onPress={handleNext}
            disabled={!canGoNext()}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.navButtonText,
                { color: canGoNext() ? colors.white : colors.textSecondary },
              ]}
            >
              Next
            </Text>
            <Ionicons
              name="arrow-forward"
              size={20}
              color={canGoNext() ? colors.white : colors.textSecondary}
            />
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  )
}

function SummaryRow({
  label,
  value,
  colors,
  onEdit,
}: {
  label: string
  value: string
  colors: PlanWorkoutWizardProps['colors']
  onEdit: () => void
}) {
  return (
    <View style={summaryStyles.row}>
      <View style={summaryStyles.labelContainer}>
        <Text style={[summaryStyles.label, { color: colors.textSecondary }]}>
          {label}
        </Text>
        <Text style={[summaryStyles.value, { color: colors.text }]} numberOfLines={2}>
          {value}
        </Text>
      </View>
      <TouchableOpacity onPress={onEdit} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="pencil" size={16} color={colors.primary} />
      </TouchableOpacity>
    </View>
  )
}

const summaryStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  labelContainer: {
    flex: 1,
    marginRight: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  value: {
    fontSize: 15,
    fontWeight: '600',
  },
})

const createStyles = (colors: PlanWorkoutWizardProps['colors']) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: 16,
    },
    stepIndicatorContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      gap: 6,
    },
    stepDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    stepText: {
      fontSize: 12,
      marginLeft: 8,
    },
    stepContent: {
      flex: 1,
    },
    stepTitle: {
      fontSize: 20,
      fontWeight: '700',
      marginBottom: 8,
    },
    stepSubtitle: {
      fontSize: 14,
      marginBottom: 16,
    },
    savedHint: {
      fontSize: 13,
      marginBottom: 12,
      fontStyle: 'italic',
    },
    optionsScroll: {
      flex: 1,
    },
    chipsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      paddingBottom: 16,
    },
    chip: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      minWidth: 80,
    },
    equipmentChip: {
      width: '100%',
      flexDirection: 'column',
      alignItems: 'flex-start',
    },
    customChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    chipText: {
      fontSize: 15,
      fontWeight: '600',
    },
    chipDescription: {
      fontSize: 12,
      marginTop: 2,
    },
    customInputContainer: {
      borderRadius: 12,
      padding: 12,
      marginTop: 8,
    },
    customInput: {
      fontSize: 15,
      minHeight: 40,
    },
    specificsInputContainer: {
      borderRadius: 12,
      padding: 12,
      marginTop: 8,
    },
    specificsInput: {
      fontSize: 15,
      minHeight: 80,
      textAlignVertical: 'top',
    },
    summaryCard: {
      borderRadius: 16,
      padding: 16,
      marginTop: 16,
    },
    navigationContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 16,
      gap: 12,
    },
    navButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: 12,
      gap: 6,
    },
    backButton: {
      borderWidth: 1,
      flex: 1,
    },
    skipButton: {
      borderWidth: 1,
      paddingHorizontal: 16,
    },
    nextButton: {
      flex: 1,
    },
    confirmButton: {
      flex: 1,
    },
    navButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
  })

