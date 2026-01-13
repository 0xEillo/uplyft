import type { BodyPartSlug } from '@/lib/body-mapping'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useState } from 'react'
import {
  Image,
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
import Body from 'react-native-body-highlighter'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ExerciseMedia } from './ExerciseMedia'
import { WizardIcon, type WizardIconName } from './WizardIcons'

export const WORKOUT_PLANNING_PREFS_KEY = '@workout_planning_preferences'
export const EQUIPMENT_PREF_KEY = '@equipment_preference'

export type EquipmentType =
  | 'full_gym'
  | 'home_minimal'
  | 'dumbbells_only'
  | 'bodyweight'

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
  initialData?: Partial<WorkoutPlanningData>
  commonMuscles?: string[]
}

type WizardStep =
  | 'goal'
  | 'muscles'
  | 'duration'
  | 'equipment'
  | 'specifics'
  | 'confirm'

// Mapping from muscle group names to body part slugs for SVG highlighting
interface MuscleBodyMapping {
  slug: BodyPartSlug
  side: 'front' | 'back'
  bodyHalf: 'upper' | 'lower' | 'full'
}

// Body diagram scale/offset config for upper and lower body views
const BODY_HALF_CONFIG = {
  upper: { scale: 0.52, offsetY: 42 },
  lower: { scale: 0.38, offsetY: -26 },
  full: { scale: 0.28, offsetY: 0 }, // Show complete body
}

const MUSCLE_TO_BODY_PARTS: Record<string, MuscleBodyMapping | MuscleBodyMapping[]> = {
  // Compound muscle groups - show multiple highlights
  'Push': [
    { slug: 'chest', side: 'front', bodyHalf: 'upper' },
    { slug: 'deltoids', side: 'front', bodyHalf: 'upper' },
    { slug: 'triceps', side: 'front', bodyHalf: 'upper' },
  ],
  'Pull': [
    { slug: 'upper-back', side: 'back', bodyHalf: 'upper' },
    { slug: 'biceps', side: 'back', bodyHalf: 'upper' },
    { slug: 'trapezius', side: 'back', bodyHalf: 'upper' },
  ],
  'Full Body': [
    { slug: 'chest', side: 'front', bodyHalf: 'full' },
    { slug: 'deltoids', side: 'front', bodyHalf: 'full' },
    { slug: 'abs', side: 'front', bodyHalf: 'full' },
    { slug: 'quadriceps', side: 'front', bodyHalf: 'full' },
    { slug: 'biceps', side: 'front', bodyHalf: 'full' },
  ],
  'Upper Body': [
    { slug: 'chest', side: 'front', bodyHalf: 'upper' },
    { slug: 'deltoids', side: 'front', bodyHalf: 'upper' },
    { slug: 'biceps', side: 'front', bodyHalf: 'upper' },
    { slug: 'triceps', side: 'front', bodyHalf: 'upper' },
  ],
  'Lower Body': [
    { slug: 'quadriceps', side: 'front', bodyHalf: 'lower' },
    { slug: 'hamstring', side: 'front', bodyHalf: 'lower' },
    { slug: 'gluteal', side: 'front', bodyHalf: 'lower' },
    { slug: 'calves', side: 'front', bodyHalf: 'lower' },
  ],
  // Specific muscle groups
  'Chest': { slug: 'chest', side: 'front', bodyHalf: 'upper' },
  'Back': [
    { slug: 'upper-back', side: 'back', bodyHalf: 'upper' },
    { slug: 'trapezius', side: 'back', bodyHalf: 'upper' },
  ],
  'Shoulders': { slug: 'deltoids', side: 'front', bodyHalf: 'upper' },
  'Arms': [
    { slug: 'biceps', side: 'front', bodyHalf: 'upper' },
    { slug: 'triceps', side: 'front', bodyHalf: 'upper' },
  ],
  'Core': [
    { slug: 'abs', side: 'front', bodyHalf: 'upper' },
    { slug: 'obliques', side: 'front', bodyHalf: 'upper' },
  ],
}

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
    label: 'General Fitness',
    value: 'General Fitness',
    icon: 'heart',
    description: 'Stay healthy & active',
  },
]

export const MUSCLE_OPTIONS = [
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

const EQUIPMENT_IMAGES: Record<EquipmentType, any> = {
  full_gym: require('@/assets/images/equipment/full_gym.png'),
  home_minimal: require('@/assets/images/equipment/home_minimal.png'),
  dumbbells_only: require('@/assets/images/equipment/dumbbells.png'),
  bodyweight: require('@/assets/images/equipment/bodyweight.png'),
}

export const EQUIPMENT_OPTIONS: {
  label: string
  value: EquipmentType
  description: string
  image: any
  gifUrl?: string
}[] = [
  {
    label: 'Full Gym',
    value: 'full_gym',
    description: 'All machines & free weights',
    image: EQUIPMENT_IMAGES.full_gym,
    gifUrl: 'DOoWcnA.gif', // Lever Chest Press (Machine)
  },
  {
    label: 'Dumbbells',
    value: 'dumbbells_only',
    description: 'Adjustable or fixed pairs',
    image: EQUIPMENT_IMAGES.dumbbells_only,
    gifUrl: 'OeL23VY.gif', // Dumbbell Seated Bicep Curl to Shoulder Press
  },
  {
    label: 'Minimal',
    value: 'home_minimal',
    description: 'Bands, kettlebell, or a bench',
    image: EQUIPMENT_IMAGES.home_minimal,
    gifUrl: 'ZA8b5hc.gif', // Kettlebell Goblet Squat
  },
  {
    label: 'Bodyweight',
    value: 'bodyweight',
    description: 'No equipment needed',
    image: EQUIPMENT_IMAGES.bodyweight,
    gifUrl: 'x6KpKpq.gif', // Close-grip Push-up
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

export function WorkoutPlanningWizard({
  colors,
  onComplete,
  onCancel,
  initialData,
  commonMuscles,
}: WorkoutPlanningWizardProps) {
  const insets = useSafeAreaInsets()
  const [editingField, setEditingField] = useState<WizardStep | null>(null)
  const [data, setData] = useState<WorkoutPlanningData>({
    goal: '',
    muscles: '',
    duration: '',
    equipment: 'full_gym',
    specifics: '',
    ...initialData,
  })
  const [customInput, setCustomInput] = useState('')
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [savedEquipment, setSavedEquipment] = useState<EquipmentType | null>(
    null,
  )

  // Load saved preferences on mount
  useEffect(() => {
    loadSavedPreferences()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only run on mount
  }, [])

  const loadSavedPreferences = async () => {
    try {
      const [prefsJson, equipmentJson] = await Promise.all([
        AsyncStorage.getItem(WORKOUT_PLANNING_PREFS_KEY),
        AsyncStorage.getItem(EQUIPMENT_PREF_KEY),
      ])

      // If initialData is provided, it takes precedence over saved prefs for those fields
      // But we still want to load saved prefs for fields not in initialData (if any)
      // Actually, for the "Smart Start" flow, initialData usually COMES from saved prefs + profile
      // So we might not need to load from AsyncStorage again if initialData is present.
      // However, to be safe and consistent:

      if (initialData && Object.keys(initialData).length > 0) {
        // If we have initial data passed in (e.g. from Smart Start), use it and don't overwrite with AsyncStorage
        // unless we want to merge? Let's assume initialData is the "proposed" state.
        // But we might want to load saved equipment if not in initialData?
        if (!initialData.equipment && equipmentJson) {
          const equipment = JSON.parse(equipmentJson) as EquipmentType
          setSavedEquipment(equipment)
          setData((prev) => ({ ...prev, equipment }))
        }
        return
      }

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

  // const currentStepIndex = STEPS.indexOf(currentStep)

  const canSaveField = () => {
    if (!editingField) return false
    switch (editingField) {
      case 'goal':
        return data.goal.length > 0
      case 'muscles':
        return data.muscles.length > 0
      case 'duration':
        return data.duration.length > 0
      case 'equipment':
        return data.equipment.length > 0
      case 'specifics':
        return true
      default:
        return true
    }
  }

  const handleDoneEditing = () => {
    if (!canSaveField()) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    // If using custom input, apply it
    if (showCustomInput && customInput.trim()) {
      const field = editingField as keyof WorkoutPlanningData
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

    setEditingField(null)
  }

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setShowCustomInput(false)
    setCustomInput('')

    if (editingField) {
      setEditingField(null)
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
      const current = data[field]
        ? (data[field] as string)
            .split(', ')
            .map((v) => v.trim())
            .filter((v) => v.length > 0)
        : []
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

  // Removed renderStepIndicator as it's no longer needed for menu flow

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
    <View style={styles.gridContainer}>
      {options.map((option) => {
        let isSelected = false
        if (multiSelect) {
          const current = data[field]
            ? (data[field] as string)
                .split(', ')
                .map((v) => v.trim())
                .filter((v) => v.length > 0)
            : []
          isSelected = current.includes(option.value)
        } else {
          isSelected = data[field] === option.value
        }

        return (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.gridCard,
              {
                backgroundColor: isSelected
                  ? `${colors.primary}15`
                  : colors.backgroundLight,
                borderColor: isSelected ? colors.primary : colors.border,
                borderWidth: isSelected ? 2 : 1,
              },
            ]}
            onPress={() => handleSelectOption(field, option.value, multiSelect)}
            activeOpacity={0.7}
          >
            {/* Selection indicator */}
            {multiSelect ? (
              <View
                style={[
                  styles.gridCheckbox,
                  {
                    borderColor: isSelected ? colors.primary : colors.border,
                    backgroundColor: isSelected
                      ? colors.primary
                      : 'transparent',
                  },
                ]}
              >
                {isSelected && (
                  <Ionicons name="checkmark" size={12} color={colors.white} />
                )}
              </View>
            ) : (
              isSelected && (
                <View style={styles.gridSelectedIndicator}>
                  <Ionicons
                    name="checkmark-circle"
                    size={22}
                    color={colors.primary}
                  />
                </View>
              )
            )}

            {/* Icon */}
            {option.icon && (
              <View
                style={[
                  styles.gridIconContainer,
                  {
                    backgroundColor: isSelected
                      ? `${colors.primary}20`
                      : `${colors.textSecondary}10`,
                  },
                ]}
              >
                <Ionicons
                  name={option.icon as any}
                  size={24}
                  color={isSelected ? colors.primary : colors.textSecondary}
                />
              </View>
            )}

            {/* Content */}
            <View style={styles.gridCardContent}>
              <Text
                style={[
                  styles.gridCardTitle,
                  { color: isSelected ? colors.primary : colors.text },
                ]}
                numberOfLines={1}
              >
                {option.label}
              </Text>
            </View>
          </TouchableOpacity>
        )
      })}
    </View>
  )

  // Specialized render function for muscle cards with body SVG illustrations
  const renderMuscleCards = (
    options: {
      label: string
      value: string
      description?: string
    }[],
  ) => (
    <View style={styles.gridContainer}>
      {options.map((option) => {
        const current = data.muscles
          ? (data.muscles as string)
              .split(', ')
              .map((v) => v.trim())
              .filter((v) => v.length > 0)
          : []
        const isSelected = current.includes(option.value)
        const muscleMapping = MUSCLE_TO_BODY_PARTS[option.value]

        // Get mappings as array (normalize single to array)
        const mappingsArray = muscleMapping
          ? Array.isArray(muscleMapping)
            ? muscleMapping
            : [muscleMapping]
          : []

        // Get the primary mapping for display config (side, bodyHalf)
        const primaryMapping = mappingsArray[0]

        // Build body data with ALL muscle slugs for highlighting
        const bodyData = mappingsArray.map((m) => ({
          slug: m.slug,
          intensity: 1,
        }))

        return (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.gridCard,
              styles.muscleCard,
              {
                backgroundColor: isSelected
                  ? `${colors.primary}15`
                  : colors.backgroundLight,
                borderColor: isSelected ? colors.primary : colors.border,
                borderWidth: isSelected ? 2 : 1,
              },
            ]}
            onPress={() => handleSelectOption('muscles', option.value, true)}
            activeOpacity={0.7}
          >
            {/* Multi-select checkbox */}
            <View
              style={[
                styles.gridCheckbox,
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

            {/* Body SVG Illustration */}
            {primaryMapping && (
              <View style={styles.muscleBodyContainer} pointerEvents="none">
                <View
                  style={[
                    styles.muscleBodyWrapper,
                    {
                      transform: [
                        {
                          translateY:
                            BODY_HALF_CONFIG[primaryMapping.bodyHalf].offsetY,
                        },
                      ],
                    },
                  ]}
                >
                  <Body
                    data={bodyData}
                    gender="male"
                    side={primaryMapping.side}
                    scale={BODY_HALF_CONFIG[primaryMapping.bodyHalf].scale}
                    colors={[isSelected ? colors.primary : '#EF4444']}
                    border="#D1D5DB"
                  />
                </View>
              </View>
            )}

            {/* Content - Title only, no description */}
            <View style={styles.gridCardContent}>
              <Text
                style={[
                  styles.gridCardTitle,
                  { color: isSelected ? colors.primary : colors.text },
                ]}
                numberOfLines={1}
              >
                {option.label}
              </Text>
            </View>
          </TouchableOpacity>
        )
      })}
    </View>
  )

  // Specialized render function for equipment cards with background images
  const renderEquipmentCards = (
    options: {
      label: string
      value: string
      description?: string
      image?: any
      gifUrl?: string
    }[],
  ) => (
    <View style={styles.gridContainer}>
      {options.map((option) => {
        const isSelected = data.equipment === option.value

        return (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.gridCard,
              styles.equipmentCard,
              {
                borderColor: isSelected ? colors.primary : colors.border,
                borderWidth: isSelected ? 2 : 1,
              },
            ]}
            onPress={() => handleSelectOption('equipment', option.value)}
            activeOpacity={0.8}
          >
            {/* Background Image or GIF */}
            {option.gifUrl ? (
              <ExerciseMedia
                key={`${option.gifUrl}-${isSelected}`}
                gifUrl={option.gifUrl}
                style={[styles.equipmentImage, { backgroundColor: '#fff' }]}
                contentFit="contain"
                autoPlay={isSelected}
              />
            ) : (
              option.image && (
                <Image source={option.image} style={styles.equipmentImage} />
              )
            )}

            {/* Gradient Overlay */}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.6)']}
              style={styles.equipmentOverlay}
            />

            {/* Selection Checkmark */}
            {isSelected && (
              <View
                style={[
                  styles.gridSelectedIndicator,
                  {
                    backgroundColor: colors.primary,
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    justifyContent: 'center',
                    alignItems: 'center',
                    top: 10,
                    right: 10,
                  },
                ]}
              >
                <Ionicons name="checkmark" size={16} color={colors.white} />
              </View>
            )}

            {/* Content */}
            <View style={styles.equipmentContent}>
              <Text style={styles.equipmentTitle} numberOfLines={1}>
                {option.label}
              </Text>
            </View>
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
          onSubmitEditing={handleDoneEditing} // Allow submit to add
          returnKeyType="done"
        />
        <TouchableOpacity
          style={styles.customInputSubmit}
          onPress={handleDoneEditing} // Re-use next handler to add custom input
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

      {/* Selected Muscles Chips */}
      {data.muscles.length > 0 && (
        <View style={styles.tagsContainer}>
          {data.muscles
            .split(', ')
            .map((m) => m.trim())
            .filter((m) => m.length > 0)
            .map((muscle) => (
              <TouchableOpacity
                key={muscle}
                style={[
                  styles.tag,
                  {
                    backgroundColor: colors.primary,
                    borderColor: colors.primary,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                  },
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  handleSelectOption('muscles', muscle, true)
                }}
              >
                <Text style={[styles.tagText, { color: colors.white }]}>
                  {muscle}
                </Text>
                <Ionicons name="close-circle" size={16} color={colors.white} />
              </TouchableOpacity>
            ))}
        </View>
      )}

      {commonMuscles && commonMuscles.length > 0 && (
        <View style={styles.commonMusclesContainer}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
            Quick Select (Based on your history)
          </Text>
          <View style={styles.tagsContainer}>
            {commonMuscles.map((muscle) => {
              const current = data.muscles
                ? (data.muscles as string)
                    .split(', ')
                    .map((v) => v.trim())
                    .filter((v) => v.length > 0)
                : []
              const isSelected = current.includes(muscle)
              return (
                <TouchableOpacity
                  key={muscle}
                  style={[
                    styles.tag,
                    {
                      backgroundColor: isSelected
                        ? colors.primary
                        : colors.backgroundLight,
                      borderColor: isSelected ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    handleSelectOption('muscles', muscle, true)
                  }}
                >
                  <Text
                    style={[
                      styles.tagText,
                      {
                        color: isSelected ? colors.white : colors.text,
                      },
                    ]}
                  >
                    {muscle}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </View>
      )}
      {renderMuscleCards(MUSCLE_OPTIONS)}
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
        <Text style={[styles.stepTitle, { color: colors.text }]}>Duration</Text>
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
          What&apos;s available to you right now?
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
            Saved:{' '}
            {EQUIPMENT_OPTIONS.find((o) => o.value === savedEquipment)?.label}
          </Text>
        </View>
      )}
      {renderEquipmentCards(EQUIPMENT_OPTIONS)}
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
            <Text
              style={[styles.stepSubtitle, { color: colors.textSecondary }]}
            >
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
                      specifics: prev.specifics
                        .replace(tag, '')
                        .replace(', ,', ',')
                        .replace(/^, /, '')
                        .replace(/, $/, '')
                        .trim(),
                    }))
                  } else {
                    // Add tag
                    setData((prev) => ({
                      ...prev,
                      specifics: prev.specifics
                        ? `${prev.specifics}, ${tag}`
                        : tag,
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

  const renderMenu = () => {
    const equipmentLabel =
      EQUIPMENT_OPTIONS.find((o) => o.value === data.equipment)?.label ||
      data.equipment

    // Format muscles display: convert values to labels
    const musclesLabel =
      data.muscles && data.muscles.trim()
        ? data.muscles
            .split(', ')
            .map((val) => val.trim())
            .filter((val) => val.length > 0)
            .map((val) => {
              const option = MUSCLE_OPTIONS.find((o) => o.value === val)
              return option ? option.label : val
            })
            .join(', ')
        : 'Select Muscles'

    return (
      <ScrollView
        style={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContentContainer}
      >
        <View style={styles.headerContainer}>
          <Text style={[styles.stepTitle, { color: colors.text }]}>
            Workout Plan
          </Text>
        </View>

        <View
          style={[
            styles.summaryCard,
            { backgroundColor: colors.backgroundLight },
          ]}
        >
          <SummaryRow
            label="Equipment"
            value={equipmentLabel || 'Select Equipment'}
            icon="equipment"
            colors={colors}
            onEdit={() => setEditingField('equipment')}
          />
          <SummaryRow
            label="Goal"
            value={data.goal || 'Select Goal'}
            icon="goal"
            colors={colors}
            onEdit={() => setEditingField('goal')}
          />
          <SummaryRow
            label="Muscles"
            value={musclesLabel}
            icon="muscles"
            colors={colors}
            onEdit={() => setEditingField('muscles')}
          />
          <SummaryRow
            label="Duration"
            value={data.duration || 'Select Duration'}
            icon="duration"
            colors={colors}
            onEdit={() => setEditingField('duration')}
          />
          <SummaryRow
            label="Notes"
            value={data.specifics || 'Add Notes'}
            icon="notes"
            colors={colors}
            onEdit={() => setEditingField('specifics')}
          />
        </View>

      </ScrollView>
    )
  }

  const renderCurrentView = () => {
    if (!editingField) {
      return renderMenu()
    }

    switch (editingField) {
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
      default:
        return renderMenu()
    }
  }

  const styles = createStyles(colors, insets)

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      {renderCurrentView()}

      <View style={styles.navigationContainer}>
        {!editingField ? (
          <>
            <TouchableOpacity
              style={[
                styles.navButton,
                styles.backButton,
                {
                  borderColor: colors.border,
                  width: 'auto',
                  paddingHorizontal: 20,
                },
              ]}
              onPress={onCancel}
              activeOpacity={0.6}
            >
              <Text
                style={[styles.navButtonText, { color: colors.textSecondary }]}
              >
                Cancel
              </Text>
            </TouchableOpacity>

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
                Generate Workout
              </Text>
              <Ionicons
                name="flash"
                size={16}
                color={colors.white}
                style={{ marginLeft: 4 }}
              />
            </TouchableOpacity>
          </>
        ) : (
          <>
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

            <TouchableOpacity
              style={[
                styles.navButton,
                styles.nextButton,
                {
                  backgroundColor: canSaveField()
                    ? colors.primary
                    : colors.backgroundLight,
                  opacity: canSaveField() ? 1 : 0.5,
                },
              ]}
              onPress={handleDoneEditing}
              disabled={!canSaveField()}
              activeOpacity={0.6}
            >
              <Text
                style={[
                  styles.navButtonText,
                  { color: canSaveField() ? colors.white : colors.textSecondary },
                ]}
              >
                Done
              </Text>
              <Ionicons
                name="checkmark"
                size={16}
                color={canSaveField() ? colors.white : colors.textSecondary}
              />
            </TouchableOpacity>
          </>
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
  icon: WizardIconName
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
        <WizardIcon name={icon} size={20} color={colors.primary} />
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

const createStyles = (
  colors: WorkoutPlanningWizardProps['colors'],
  insets: { top: number; bottom: number },
) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    scrollContent: {
      flex: 1,
    },
    scrollContentContainer: {
      paddingHorizontal: 16,
      paddingBottom: Math.max(insets.bottom, 16) + 40,
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
      paddingTop: 12,
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
    // Grid layout styles
    gridContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    gridCard: {
      width: '48%' as any, // Slightly wider base with smaller gap
      flexGrow: 1,
      minHeight: 110,
      borderRadius: 16,
      padding: 12,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
    },
    gridIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 10,
    },
    gridCardContent: {
      alignItems: 'center',
    },
    gridCardTitle: {
      fontSize: 15,
      fontWeight: '600',
      textAlign: 'center',
      marginBottom: 2,
    },
    gridCardDescription: {
      fontSize: 12,
      textAlign: 'center',
      lineHeight: 16,
    },
    gridCheckbox: {
      position: 'absolute',
      top: 12,
      right: 12,
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 1.5,
      justifyContent: 'center',
      alignItems: 'center',
    },
    gridSelectedIndicator: {
      position: 'absolute',
      top: 12,
      right: 12,
    },
    // Muscle card with body SVG styles
    muscleCard: {
      minHeight: 130,
      paddingTop: 12,
      paddingBottom: 10,
    },
    muscleBodyContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      position: 'relative',
      marginBottom: 8,
    },
    muscleBodyWrapper: {
      position: 'absolute',
      top: '50%',
      left: '50%',
      width: 140,
      height: 280,
      marginTop: -140,
      marginLeft: -70,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Equipment card with background images styles
    equipmentCard: {
      height: 220, // Taller aspect ratio
      padding: 0, // Image covers the whole card
      backgroundColor: '#000',
    },
    equipmentImage: {
      ...StyleSheet.absoluteFillObject,
      width: '100%',
      height: '100%',
    },
    equipmentOverlay: {
      ...StyleSheet.absoluteFillObject,
    },
    equipmentContent: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: 16,
    },
    equipmentTitle: {
      color: '#FFF',
      fontSize: 20,
      fontWeight: '800',
      marginBottom: 2,
    },
    equipmentDescription: {
      color: 'rgba(255,255,255,0.8)',
      fontSize: 12,
      fontWeight: '500',
    },
    // Legacy card styles (keeping for compatibility)
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
    // Common Muscles
    commonMusclesContainer: {
      marginBottom: 16,
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: '600',
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
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
      paddingBottom: Math.max(insets.bottom, 16) + 40,
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

