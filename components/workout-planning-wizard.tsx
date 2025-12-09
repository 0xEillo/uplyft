import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
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

const WORKOUT_PLANNING_PREFS_KEY = '@workout_planning_preferences'
const EQUIPMENT_PREF_KEY = '@equipment_preference'

export type EquipmentType =
  | 'full_gym'
  | 'dumbbells_only'
  | 'home_minimal'
  | 'bodyweight'
  | 'barbell_only'

export interface WorkoutPlanningData {
  goal: string
  muscles: string
  duration: string
  equipment: EquipmentType
  specifics: string
}

interface WorkoutPlanningWizardProps {
  colors: {
    background: string
    backgroundLight: string
    text: string
    textSecondary: string
    primary: string
    border: string
    white: string
  }
  onComplete: (data: WorkoutPlanningData) => void
  onCancel: () => void
}

type WizardStep =
  | 'goal'
  | 'muscles'
  | 'duration'
  | 'equipment'
  | 'specifics'
  | 'confirm'

// Enhanced options with icons and cleaner values
const GOAL_OPTIONS = [
  {
    label: 'Strength',
    value: 'Strength',
    icon: 'barbell',
    description: 'Heavy weight, lower reps',
  },
  {
    label: 'Hypertrophy',
    value: 'Hypertrophy',
    icon: 'body',
    description: 'Build muscle size',
  },
  {
    label: 'Fat Loss',
    value: 'Fat Loss / HIIT',
    icon: 'flame',
    description: 'High intensity circuits',
  },
  {
    label: 'Endurance',
    value: 'Endurance',
    icon: 'stopwatch',
    description: 'Stamina & conditioning',
  },
  {
    label: 'Powerlifting',
    value: 'Powerlifting',
    icon: 'trophy',
    description: 'S/B/D focus',
  },
  {
    label: 'Athletic',
    value: 'Athletic Performance',
    icon: 'flash',
    description: 'Speed & agility',
  },
  {
    label: 'General Fitness',
    value: 'General Fitness',
    icon: 'heart',
    description: 'Stay healthy & active',
  },
]

const MUSCLE_OPTIONS = [
  {
    label: 'Push',
    value: 'Push',
    description: 'Chest, Shoulders, Triceps',
  },
  {
    label: 'Pull',
    value: 'Pull',
    description: 'Back, Biceps',
  },
  {
    label: 'Legs',
    value: 'Legs',
    description: 'Quads, Hamstrings, Glutes',
  },
  {
    label: 'Full Body',
    value: 'Full Body',
    description: 'Hit everything',
  },
  {
    label: 'Upper Body',
    value: 'Upper Body',
    description: 'Torso & Arms',
  },
  {
    label: 'Lower Body',
    value: 'Lower Body',
    description: 'Legs & Core',
  },
  {
    label: 'Chest',
    value: 'Chest',
    description: 'Pectorals',
  },
  {
    label: 'Back',
    value: 'Back',
    description: 'Lats & Traps',
  },
  {
    label: 'Shoulders',
    value: 'Shoulders',
    description: 'Deltoids',
  },
  {
    label: 'Arms',
    value: 'Arms',
    description: 'Biceps & Triceps',
  },
  {
    label: 'Core',
    value: 'Core',
    description: 'Abs & Obliques',
  },
]

const DURATION_OPTIONS = [
  { label: '20 min', value: '20 minutes', icon: 'timer-outline' },
  { label: '30 min', value: '30 minutes', icon: 'timer-outline' },
  { label: '45 min', value: '45 minutes', icon: 'timer-outline' },
  { label: '1 hour', value: '1 hour', icon: 'time-outline' },
  { label: '90 min', value: '90 minutes', icon: 'time-outline' },
]

const EQUIPMENT_OPTIONS: {
  label: string
  value: EquipmentType
  description: string
}[] = [
  {
    label: 'Full Gym',
    value: 'full_gym',
    description: 'All machines & free weights',
  },
  {
    label: 'Dumbbells Only',
    value: 'dumbbells_only',
    description: 'Just dumbbells',
  },
  {
    label: 'Home / Minimal',
    value: 'home_minimal',
    description: 'Basic home equipment',
  },
  {
    label: 'Bodyweight',
    value: 'bodyweight',
    description: 'No equipment needed',
  },
  {
    label: 'Barbell Only',
    value: 'barbell_only',
    description: 'Barbell & plates',
  },
]

const SPECIFICS_TAGS = [
  'No Jumping',
  'Knee Friendly',
  'Low Back Friendly',
  'Quiet',
  'Supersets',
  'No Machines',
  'Focus on Form',
]

const STEPS: WizardStep[] = [
  'goal',
  'muscles',
  'duration',
  'equipment',
  'specifics',
  'confirm',
]

export function WorkoutPlanningWizard({
  colors,
  onComplete,
  onCancel,
}: WorkoutPlanningWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('goal')
  const [data, setData] = useState<WorkoutPlanningData>({
    goal: '',
    muscles: '',
    duration: '',
    equipment: 'full_gym',
    specifics: '',
  })
  const [customInput, setCustomInput] = useState('')
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [savedEquipment, setSavedEquipment] = useState<EquipmentType | null>(
    null,
  )

  // Load saved preferences on mount
  useEffect(() => {
    loadSavedPreferences()
  }, [])

  const loadSavedPreferences = async () => {
    try {
      const [prefsJson, equipmentJson] = await Promise.all([
        AsyncStorage.getItem(WORKOUT_PLANNING_PREFS_KEY),
        AsyncStorage.getItem(EQUIPMENT_PREF_KEY),
      ])

      if (prefsJson) {
        const prefs = JSON.parse(prefsJson) as Partial<WorkoutPlanningData>
        setData((prev) => ({
          ...prev,
          goal: prefs.goal || '',
          muscles: prefs.muscles || '',
          duration: prefs.duration || '',
          specifics: prefs.specifics || '',
        }))
      }

      if (equipmentJson) {
        const equipment = JSON.parse(equipmentJson) as EquipmentType
        setSavedEquipment(equipment)
        setData((prev) => ({ ...prev, equipment }))
      }
    } catch (error) {
      console.error('Error loading workout planning preferences:', error)
    }
  }

  const savePreferences = async (finalData: WorkoutPlanningData) => {
    try {
      await Promise.all([
        AsyncStorage.setItem(
          WORKOUT_PLANNING_PREFS_KEY,
          JSON.stringify({
            goal: finalData.goal,
            muscles: finalData.muscles,
            duration: finalData.duration,
            specifics: finalData.specifics,
          }),
        ),
        AsyncStorage.setItem(
          EQUIPMENT_PREF_KEY,
          JSON.stringify(finalData.equipment),
        ),
      ])
    } catch (error) {
      console.error('Error saving workout planning preferences:', error)
    }
  }

  const currentStepIndex = STEPS.indexOf(currentStep)

  const canGoNext = () => {
    switch (currentStep) {
      case 'goal':
        return data.goal.length > 0
      case 'muscles':
        return data.muscles.length > 0
      case 'duration':
        return data.duration.length > 0
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
      const field = currentStep as keyof WorkoutPlanningData
      if (field !== 'equipment') {
        if (field === 'muscles') {
          // Add custom muscle to list
          const current = data.muscles ? data.muscles.split(', ') : []
          if (!current.includes(customInput.trim())) {
            const newSelection = [...current, customInput.trim()]
            setData((prev) => ({ ...prev, muscles: newSelection.join(', ') }))
          }
        } else {
          setData((prev) => ({ ...prev, [field]: customInput.trim() }))
        }
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

  const handleSelectOption = (
    field: keyof WorkoutPlanningData,
    value: string,
    multiSelect = false,
  ) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    if (multiSelect && typeof value === 'string') {
      const current = data[field] ? (data[field] as string).split(', ') : []
      let newSelection
      if (current.includes(value)) {
        newSelection = current.filter((m) => m !== value)
      } else {
        newSelection = [...current, value]
      }
      setData((prev) => ({ ...prev, [field]: newSelection.join(', ') }))
    } else {
      setData((prev) => ({ ...prev, [field]: value }))
      // Only auto-advance if it's not multi-select and not specifics
      // Actually, let's keep it manual next for better control unless it's duration
    }

    setShowCustomInput(false)
    setCustomInput('')
  }

  const handleConfirm = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    await savePreferences(data)
    onComplete(data)
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
              width: index === currentStepIndex ? 18 : 6,
            },
          ]}
        />
      ))}
    </View>
  )

  const renderOptionCards = (
    options: {
      label: string
      value: string
      description?: string
      icon?: string
    }[],
    field: keyof WorkoutPlanningData,
    multiSelect = false,
  ) => (
    <View style={[styles.cardsContainer, { backgroundColor: colors.backgroundLight, borderRadius: 12, overflow: 'hidden' }]}>
      {options.map((option, index) => {
        let isSelected = false
        if (multiSelect) {
          const current = data[field] ? (data[field] as string).split(', ') : []
          isSelected = current.includes(option.value)
        } else {
          isSelected = data[field] === option.value
        }
        const isLast = index === options.length - 1

        return (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.card,
              {
                backgroundColor: isSelected
                  ? `${colors.primary}12`
                  : 'transparent',
                borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
                borderBottomColor: colors.border,
              },
            ]}
            onPress={() => handleSelectOption(field, option.value, multiSelect)}
            activeOpacity={0.6}
          >
            {option.icon && (
              <Ionicons
                name={option.icon as any}
                size={18}
                color={isSelected ? colors.primary : colors.textSecondary}
                style={styles.cardIcon}
              />
            )}
            <View style={styles.cardContent}>
              <Text
                style={[
                  styles.cardTitle,
                  { color: isSelected ? colors.primary : colors.text },
                ]}
              >
                {option.label}
              </Text>
              {option.description && (
                <Text
                  style={[
                    styles.cardDescription,
                    { color: colors.textSecondary },
                  ]}
                  numberOfLines={1}
                >
                  {option.description}
                </Text>
              )}
            </View>
            {multiSelect ? (
              <View
                style={[
                  styles.checkbox,
                  {
                    borderColor: isSelected ? colors.primary : colors.border,
                    backgroundColor: isSelected ? colors.primary : 'transparent',
                  },
                ]}
              >
                {isSelected && (
                  <Ionicons name="checkmark" size={12} color={colors.white} />
                )}
              </View>
            ) : (
              isSelected && (
                <Ionicons name="checkmark" size={18} color={colors.primary} />
              )
            )}
          </TouchableOpacity>
        )
      })}
    </View>
  )

  const renderCustomInput = (placeholder: string, field: WizardStep) => {
    if (!showCustomInput) {
      return (
        <TouchableOpacity
          style={styles.customTrigger}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            setShowCustomInput(true)
          }}
        >
          <Ionicons name="add" size={16} color={colors.primary} />
          <Text style={[styles.customTriggerText, { color: colors.primary }]}>
            Custom
          </Text>
        </TouchableOpacity>
      )
    }

    return (
      <View
        style={[
          styles.customInputContainer,
          { backgroundColor: colors.backgroundLight },
        ]}
      >
        <TextInput
          style={[styles.customInput, { color: colors.text }]}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          value={customInput}
          onChangeText={setCustomInput}
          autoFocus
          onSubmitEditing={handleNext} // Allow submit to add
          returnKeyType="done"
        />
        <TouchableOpacity
          style={styles.customInputSubmit}
          onPress={handleNext} // Re-use next handler to add custom input
        >
          <Ionicons name="checkmark-circle" size={28} color={colors.primary} />
        </TouchableOpacity>
      </View>
    )
  }

  const renderGoalStep = () => (
    <ScrollView
      style={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContentContainer}
    >
      <View style={styles.headerContainer}>
        <Text style={[styles.stepTitle, { color: colors.text }]}>
          Primary Goal
        </Text>
        <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
          What do you want to achieve today?
        </Text>
      </View>
      {renderOptionCards(GOAL_OPTIONS, 'goal')}
      {renderCustomInput('e.g., Rehab, Sport-specific...', 'goal')}
    </ScrollView>
  )

  const renderMusclesStep = () => (
    <ScrollView
      style={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContentContainer}
    >
      <View style={styles.headerContainer}>
        <Text style={[styles.stepTitle, { color: colors.text }]}>
          Target Muscles
        </Text>
        <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
          Select one or more areas to focus on.
        </Text>
      </View>
      {renderOptionCards(MUSCLE_OPTIONS, 'muscles', true)}
      {renderCustomInput('e.g., Calves, Neck...', 'muscles')}
    </ScrollView>
  )

  const renderDurationStep = () => (
    <ScrollView
      style={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContentContainer}
    >
      <View style={styles.headerContainer}>
        <Text style={[styles.stepTitle, { color: colors.text }]}>
          Duration
        </Text>
        <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
          How much time do you have?
        </Text>
      </View>
      {renderOptionCards(DURATION_OPTIONS, 'duration')}
      {renderCustomInput('e.g., 2 hours, 15 mins...', 'duration')}
    </ScrollView>
  )

  const renderEquipmentStep = () => (
    <ScrollView
      style={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContentContainer}
    >
      <View style={styles.headerContainer}>
        <Text style={[styles.stepTitle, { color: colors.text }]}>
          Equipment
        </Text>
        <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
          What's available to you right now?
        </Text>
      </View>
      {savedEquipment && (
        <View
          style={[
            styles.savedBadge,
            { backgroundColor: `${colors.primary}15` },
          ]}
        >
          <Ionicons name="save-outline" size={14} color={colors.primary} />
          <Text style={[styles.savedBadgeText, { color: colors.primary }]}>
            Saved: {EQUIPMENT_OPTIONS.find((o) => o.value === savedEquipment)?.label}
          </Text>
        </View>
      )}
      {renderOptionCards(EQUIPMENT_OPTIONS, 'equipment')}
    </ScrollView>
  )

  const renderSpecificsStep = () => (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.stepContent}>
        <ScrollView
          style={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContentContainer}
        >
          <View style={styles.headerContainer}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>
              Specifics
            </Text>
            <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
              Any injuries or preferences? (Optional)
            </Text>
          </View>

          <View style={styles.tagsContainer}>
            {SPECIFICS_TAGS.map((tag) => (
              <TouchableOpacity
                key={tag}
                style={[
                  styles.tag,
                  {
                    backgroundColor: data.specifics.includes(tag)
                      ? colors.primary
                      : colors.backgroundLight,
                    borderColor: data.specifics.includes(tag)
                      ? colors.primary
                      : colors.border,
                  },
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  const current = data.specifics
                  if (current.includes(tag)) {
                    // Remove tag
                    setData((prev) => ({
                      ...prev,
                      specifics: prev.specifics.replace(tag, '').replace(', ,', ',').replace(/^, /, '').replace(/, $/, '').trim(),
                    }))
                  } else {
                    // Add tag
                    setData((prev) => ({
                      ...prev,
                      specifics: prev.specifics ? `${prev.specifics}, ${tag}` : tag,
                    }))
                  }
                }}
              >
                <Text
                  style={[
                    styles.tagText,
                    {
                      color: data.specifics.includes(tag)
                        ? colors.white
                        : colors.text,
                    },
                  ]}
                >
                  {tag}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View
            style={[
              styles.specificsInputContainer,
              { backgroundColor: colors.backgroundLight },
            ]}
          >
            <TextInput
              style={[styles.specificsInput, { color: colors.text }]}
              placeholder="e.g., I have a bad shoulder, include some cardio..."
              placeholderTextColor={colors.textSecondary}
              value={data.specifics}
              onChangeText={(text) =>
                setData((prev) => ({ ...prev, specifics: text }))
              }
              multiline
              numberOfLines={4}
              blurOnSubmit
              returnKeyType="done"
            />
          </View>
        </ScrollView>
      </View>
    </TouchableWithoutFeedback>
  )

  const renderConfirmStep = () => {
    const equipmentLabel =
      EQUIPMENT_OPTIONS.find((o) => o.value === data.equipment)?.label ||
      data.equipment

    const goalOption = GOAL_OPTIONS.find((o) => o.value === data.goal)
    const goalIcon = goalOption?.icon || 'barbell'

    return (
      <ScrollView
        style={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContentContainer}
      >
        <View style={styles.headerContainer}>
          <Text style={[styles.stepTitle, { color: colors.text }]}>
            Summary
          </Text>
          <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
            Ready to generate your plan?
          </Text>
        </View>

        <View
          style={[
            styles.summaryCard,
            { backgroundColor: colors.backgroundLight },
          ]}
        >
          <SummaryRow
            label="Goal"
            value={data.goal}
            icon={goalIcon}
            colors={colors}
            onEdit={() => setCurrentStep('goal')}
          />
          <SummaryRow
            label="Muscles"
            value={data.muscles}
            icon="body"
            colors={colors}
            onEdit={() => setCurrentStep('muscles')}
          />
          <SummaryRow
            label="Duration"
            value={data.duration}
            icon="time"
            colors={colors}
            onEdit={() => setCurrentStep('duration')}
          />
          <SummaryRow
            label="Equipment"
            value={equipmentLabel}
            icon="fitness"
            colors={colors}
            onEdit={() => setCurrentStep('equipment')}
          />
          {data.specifics ? (
            <SummaryRow
              label="Notes"
              value={data.specifics}
              icon="document-text"
              colors={colors}
              onEdit={() => setCurrentStep('specifics')}
            />
          ) : null}
        </View>
      </ScrollView>
    )
  }

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'goal':
        return renderGoalStep()
      case 'muscles':
        return renderMusclesStep()
      case 'duration':
        return renderDurationStep()
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
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      {renderStepIndicator()}
      {renderCurrentStep()}

      <View style={styles.navigationContainer}>
        <TouchableOpacity
          style={[
            styles.navButton,
            styles.backButton,
            { borderColor: colors.border },
          ]}
          onPress={handleBack}
          activeOpacity={0.6}
        >
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </TouchableOpacity>

        {currentStep === 'confirm' ? (
          <TouchableOpacity
            style={[
              styles.navButton,
              styles.confirmButton,
              { backgroundColor: colors.primary },
            ]}
            onPress={handleConfirm}
            activeOpacity={0.6}
          >
            <Text style={[styles.navButtonText, { color: colors.white }]}>
              Generate
            </Text>
            <Ionicons name="sparkles" size={16} color={colors.white} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.navButton,
              styles.nextButton,
              {
                backgroundColor: canGoNext()
                  ? colors.primary
                  : colors.backgroundLight,
                opacity: canGoNext() ? 1 : 0.5,
              },
            ]}
            onPress={handleNext}
            disabled={!canGoNext()}
            activeOpacity={0.6}
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
              name="chevron-forward"
              size={16}
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
  icon,
  colors,
  onEdit,
}: {
  label: string
  value: string
  icon: string
  colors: WorkoutPlanningWizardProps['colors']
  onEdit: () => void
}) {
  return (
    <TouchableOpacity
      style={summaryStyles.row}
      onPress={onEdit}
      activeOpacity={0.6}
    >
      <View style={summaryStyles.iconContainer}>
        <Ionicons name={icon as any} size={16} color={colors.primary} />
      </View>
      <View style={summaryStyles.contentContainer}>
        <Text style={[summaryStyles.label, { color: colors.textSecondary }]}>
          {label}
        </Text>
        <Text
          style={[summaryStyles.value, { color: colors.text }]}
          numberOfLines={2}
        >
          {value}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
    </TouchableOpacity>
  )
}

const summaryStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128, 128, 128, 0.1)',
  },
  iconContainer: {
    marginRight: 12,
    width: 24,
    alignItems: 'center',
  },
  contentContainer: {
    flex: 1,
    marginRight: 10,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  value: {
    fontSize: 15,
    fontWeight: '600',
  },
})

const createStyles = (colors: WorkoutPlanningWizardProps['colors']) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    scrollContent: {
      flex: 1,
    },
    scrollContentContainer: {
      paddingHorizontal: 16,
      paddingBottom: 16,
    },
    stepIndicatorContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      gap: 5,
    },
    stepDot: {
      height: 4,
      borderRadius: 2,
    },
    stepContent: {
      flex: 1,
    },
    headerContainer: {
      marginBottom: 16,
    },
    stepTitle: {
      fontSize: 22,
      fontWeight: '700',
      marginBottom: 4,
    },
    stepSubtitle: {
      fontSize: 14,
      opacity: 0.8,
    },
    cardsContainer: {
      gap: 0,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    cardIcon: {
      marginRight: 12,
      width: 20,
    },
    cardContent: {
      flex: 1,
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: '500',
    },
    cardDescription: {
      fontSize: 12,
      marginTop: 1,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 1.5,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 10,
    },
    // Custom Input
    customTrigger: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      marginTop: 12,
      gap: 6,
    },
    customTriggerText: {
      fontSize: 14,
      fontWeight: '500',
    },
    customInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 10,
      padding: 6,
      marginTop: 12,
    },
    customInput: {
      flex: 1,
      fontSize: 15,
      paddingHorizontal: 10,
      paddingVertical: 10,
      minHeight: 44,
    },
    customInputSubmit: {
      padding: 6,
    },
    // Saved Equipment Badge
    savedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6,
      alignSelf: 'flex-start',
      marginBottom: 12,
      gap: 5,
    },
    savedBadgeText: {
      fontSize: 12,
      fontWeight: '500',
    },
    // Specifics Tags
    tagsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 12,
    },
    tag: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      borderWidth: 1,
    },
    tagText: {
      fontSize: 13,
      fontWeight: '500',
    },
    specificsInputContainer: {
      borderRadius: 12,
      padding: 12,
      minHeight: 100,
    },
    specificsInput: {
      fontSize: 15,
      lineHeight: 22,
      textAlignVertical: 'top',
      flex: 1,
    },
    // Summary
    summaryCard: {
      borderRadius: 12,
      padding: 4,
      paddingHorizontal: 14,
    },
    // Navigation
    navigationContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: Platform.OS === 'ios' ? 16 : 16,
      gap: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    navButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      height: 46,
      borderRadius: 23,
      gap: 6,
    },
    backButton: {
      width: 46,
      borderWidth: 1,
    },
    nextButton: {
      flex: 1,
    },
    confirmButton: {
      flex: 1,
    },
    navButtonText: {
      fontSize: 15,
      fontWeight: '600',
    },
  })

