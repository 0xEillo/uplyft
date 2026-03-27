import type { BodyPartSlug } from '@/lib/body-mapping'
import { useBodyDiagramGender } from '@/hooks/useBodyDiagramGender'
import { haptic } from '@/lib/haptics'
import { Ionicons } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import Body from '@/components/PatchedBodyHighlighter'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export const WORKOUT_PLANNING_PREFS_KEY = '@workout_planning_preferences'
export const EQUIPMENT_PREF_KEY = '@equipment_preference'
export const DEFAULT_WORKOUT_DURATION = '60 min'

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
    brandPrimary: string
    surface: string
    surfaceSubtle: string
    textPrimary: string
    bg: string
  }
  onComplete: (data: WorkoutPlanningData) => void
  onCancel: () => void
  initialData?: Partial<WorkoutPlanningData>
  commonMuscles?: string[]
}

interface MuscleBodyMapping {
  slug: BodyPartSlug
  side: 'front' | 'back'
  bodyHalf: 'upper' | 'lower' | 'full'
}

const MUSCLE_TO_BODY_PARTS: Record<
  string,
  MuscleBodyMapping | MuscleBodyMapping[]
> = {
  // Compound muscle groups
  Push: [
    { slug: 'chest', side: 'front', bodyHalf: 'upper' },
    { slug: 'deltoids', side: 'front', bodyHalf: 'upper' },
    { slug: 'triceps', side: 'front', bodyHalf: 'upper' },
  ],
  Pull: [
    { slug: 'upper-back', side: 'back', bodyHalf: 'upper' },
    { slug: 'biceps', side: 'front', bodyHalf: 'upper' },
    { slug: 'trapezius', side: 'back', bodyHalf: 'upper' },
  ],
  Full: [
    { slug: 'chest', side: 'front', bodyHalf: 'full' },
    { slug: 'deltoids', side: 'front', bodyHalf: 'full' },
    { slug: 'abs', side: 'front', bodyHalf: 'full' },
    { slug: 'quadriceps', side: 'front', bodyHalf: 'full' },
    { slug: 'biceps', side: 'front', bodyHalf: 'full' },
  ],
  Upper: [
    { slug: 'chest', side: 'front', bodyHalf: 'upper' },
    { slug: 'deltoids', side: 'front', bodyHalf: 'upper' },
    { slug: 'biceps', side: 'front', bodyHalf: 'upper' },
    { slug: 'triceps', side: 'front', bodyHalf: 'upper' },
  ],
  Lower: [
    { slug: 'quadriceps', side: 'front', bodyHalf: 'lower' },
    { slug: 'hamstring', side: 'back', bodyHalf: 'lower' },
    { slug: 'gluteal', side: 'back', bodyHalf: 'lower' },
    { slug: 'calves', side: 'back', bodyHalf: 'lower' },
  ],
  // Specific
  Chest: { slug: 'chest', side: 'front', bodyHalf: 'upper' },
  Back: [
    { slug: 'upper-back', side: 'back', bodyHalf: 'upper' },
    { slug: 'lower-back', side: 'back', bodyHalf: 'upper' },
    { slug: 'trapezius', side: 'back', bodyHalf: 'upper' },
  ],
  Shoulders: { slug: 'deltoids', side: 'front', bodyHalf: 'upper' },
  Arms: [
    { slug: 'biceps', side: 'front', bodyHalf: 'upper' },
    { slug: 'triceps', side: 'front', bodyHalf: 'upper' },
  ],
  Core: [
    { slug: 'abs', side: 'front', bodyHalf: 'upper' },
    { slug: 'obliques', side: 'front', bodyHalf: 'upper' },
  ],
  Biceps: { slug: 'biceps', side: 'front', bodyHalf: 'upper' },
  Triceps: { slug: 'triceps', side: 'back', bodyHalf: 'upper' },
  Abs: { slug: 'abs', side: 'front', bodyHalf: 'upper' },
  // Legs
  Quads: { slug: 'quadriceps', side: 'front', bodyHalf: 'lower' },
  Hamstrings: { slug: 'hamstring', side: 'back', bodyHalf: 'lower' },
  Glutes: { slug: 'gluteal', side: 'back', bodyHalf: 'lower' },
  Calves: { slug: 'calves', side: 'back', bodyHalf: 'lower' },
}

export const MUSCLE_OPTIONS = [
  { label: 'Push', value: 'Push', description: 'Chest, Shoulders, Triceps' },
  { label: 'Pull', value: 'Pull', description: 'Back, Biceps' },
  { label: 'Full Body', value: 'Full Body', description: 'Hit everything' },
  { label: 'Upper Body', value: 'Upper Body', description: 'Torso & Arms' },
  { label: 'Lower Body', value: 'Lower Body', description: 'Legs & Core' },
  { label: 'Chest', value: 'Chest', description: 'Pectorals' },
  { label: 'Back', value: 'Back', description: 'Lats & Traps' },
  { label: 'Shoulders', value: 'Shoulders', description: 'Deltoids' },
  { label: 'Arms', value: 'Arms', description: 'Biceps & Triceps' },
  { label: 'Core', value: 'Core', description: 'Abs & Obliques' },
]

export const EQUIPMENT_OPTIONS: any[] = []

const LOCATION_OPTS = ['Gym', 'Home']
const WORKOUT_TYPES = [
  'Strength',
  'Bodybuilding',
  'Powerlifting',
  'CrossFit',
  'Calisthenics',
]
const TIMES = ['20 min', '30 min', '40 min', '50 min', '60 min', '80 min']
const MAIN_MUSCLES = ['Full', 'Upper', 'Lower']
const SPECIFIC_MUSCLES = [
  'Shoulders',
  'Biceps',
  'Triceps',
  'Back',
  'Chest',
  'Abs',
  'Quads',
  'Hamstrings',
  'Glutes',
  'Calves',
]
const UPPER_SPECIFIC = ['Shoulders', 'Biceps', 'Triceps', 'Back', 'Chest', 'Abs']
const LOWER_SPECIFIC = ['Quads', 'Hamstrings', 'Glutes', 'Calves']
const MAIN_TO_SPECIFIC: Record<string, string[]> = {
  Full: SPECIFIC_MUSCLES,
  Upper: UPPER_SPECIFIC,
  Lower: LOWER_SPECIFIC,
}

// Align with select-exercise: red highlight, correct side (Triceps on back), scale/offsetY
const BODY_HALF_CONFIG = {
  upper: { scale: 0.52, offsetY: 42 },
  lower: { scale: 0.36, offsetY: -26 },
  full: { scale: 0.4, offsetY: 0 },
}
const MUSCLE_HIGHLIGHT_COLOR = '#EF4444'
const MUSCLE_BORDER_COLOR = '#D1D5DB'

interface SpecificMuscleChipData {
  label: string
  bodyData: { slug: BodyPartSlug; intensity: number }[]
  side: 'front' | 'back'
  scale: number
  offsetY: number
}

const SPECIFIC_MUSCLE_CHIP_DATA: SpecificMuscleChipData[] = SPECIFIC_MUSCLES.map(
  (label) => {
    const mapping = MUSCLE_TO_BODY_PARTS[label]
    if (!mapping) return null
    const mappings = Array.isArray(mapping) ? mapping : [mapping]
    const first = mappings[0]
    const config = BODY_HALF_CONFIG[first.bodyHalf]
    return {
      label,
      bodyData: mappings.map((m) => ({ slug: m.slug, intensity: 1 })),
      side: first.side,
      scale: config.scale,
      offsetY: config.offsetY,
    }
  },
).filter((c): c is SpecificMuscleChipData => c !== null)
const INTENSITY_OPTS = ['Basic', 'Moderate', 'High']

const DEFAULT_SELECTED_MUSCLES = ['Full', ...SPECIFIC_MUSCLES]

const LEGACY_MUSCLE_LABELS: Record<string, string> = {
  'full body': 'Full',
  full: 'Full',
  'upper body': 'Upper',
  upper: 'Upper',
  'lower body': 'Lower',
  lower: 'Lower',
}

function getLocationFromEquipment(equipment?: EquipmentType) {
  return equipment === 'home_minimal' || equipment === 'bodyweight'
    ? 'Home'
    : 'Gym'
}

function parseInitialSelectedMuscles(muscles?: string) {
  if (!muscles) return DEFAULT_SELECTED_MUSCLES

  const parsed = muscles
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      const normalizedValue = LEGACY_MUSCLE_LABELS[value.toLowerCase()]
      return normalizedValue ?? value
    })
    .filter(
      (value, index, array) =>
        (MAIN_MUSCLES.includes(value) || SPECIFIC_MUSCLES.includes(value)) &&
        array.indexOf(value) === index,
    )

  return parsed.length > 0 ? parsed : DEFAULT_SELECTED_MUSCLES
}

function parseInitialIntensity(specifics?: string) {
  if (specifics?.includes('Intensity: High')) return 'High'
  if (specifics?.includes('Intensity: Moderate')) return 'Moderate'
  return 'Basic'
}

export function WorkoutPlanningWizard({
  colors,
  onComplete,
  onCancel,
  initialData,
}: WorkoutPlanningWizardProps) {
  const bodyGender = useBodyDiagramGender()
  const insets = useSafeAreaInsets()

  const [location, setLocation] = useState(() =>
    getLocationFromEquipment(initialData?.equipment),
  )
  const [workoutType, setWorkoutType] = useState(() =>
    initialData?.goal && WORKOUT_TYPES.includes(initialData.goal)
      ? initialData.goal
      : 'Strength',
  )
  const [time, setTime] = useState(() =>
    initialData?.duration && TIMES.includes(initialData.duration)
      ? initialData.duration
      : DEFAULT_WORKOUT_DURATION,
  )
  const [selectedMuscles, setSelectedMuscles] = useState<string[]>(() =>
    parseInitialSelectedMuscles(initialData?.muscles),
  )
  const [intensity, setIntensity] = useState(() =>
    parseInitialIntensity(initialData?.specifics),
  )

  useEffect(() => {
    setLocation(getLocationFromEquipment(initialData?.equipment))
    setWorkoutType(
      initialData?.goal && WORKOUT_TYPES.includes(initialData.goal)
        ? initialData.goal
        : 'Strength',
    )
    setTime(
      initialData?.duration && TIMES.includes(initialData.duration)
        ? initialData.duration
        : DEFAULT_WORKOUT_DURATION,
    )
    setSelectedMuscles(parseInitialSelectedMuscles(initialData?.muscles))
    setIntensity(parseInitialIntensity(initialData?.specifics))
  }, [initialData])

  const toggleMainMuscle = (main: string) => {
    haptic('light')
    const specific = MAIN_TO_SPECIFIC[main] ?? []
    setSelectedMuscles((prev) => {
      const isSelecting = !prev.includes(main)
      if (isSelecting) {
        return [...new Set([...prev, main, ...specific])]
      }
      return prev.filter((m) => m !== main && !specific.includes(m))
    })
  }

  const toggleMuscle = (m: string) => {
    haptic('light')
    setSelectedMuscles((prev) =>
      prev.includes(m) ? prev.filter((i) => i !== m) : [...prev, m],
    )
  }

  const handleSelect = (setter: any, val: string) => {
    haptic('light')
    setter(val)
  }

  const handleSubmit = () => {
    haptic('medium')
    let equipment: EquipmentType = 'full_gym'
    if (location === 'Home') equipment = 'home_minimal'

    const musclesStr =
      selectedMuscles.length > 0 ? selectedMuscles.join(', ') : 'Full'

    const specificsList = []
    if (intensity) specificsList.push(`Intensity: ${intensity}`)

    const finalData: WorkoutPlanningData = {
      goal: workoutType,
      muscles: musclesStr,
      duration: time,
      equipment,
      specifics: specificsList.join('. '),
    }

    onComplete(finalData)
  }

  const Pill = ({
    label,
    isSelected,
    onPress,
  }: {
    label: string
    isSelected: boolean
    onPress: () => void
  }) => {
    return (
      <TouchableOpacity
        onPress={onPress}
        style={[
          styles.pill,
          {
            backgroundColor: isSelected
              ? colors.textPrimary
              : colors.surfaceSubtle,
          },
        ]}
      >
        <Text
          style={[
            styles.pillText,
            {
              color: isSelected ? colors.bg : colors.textPrimary,
            },
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    )
  }

  const renderIntensityCard = (label: string) => {
    const isSelected = intensity === label
    const maxBars = label === 'Basic' ? 1 : label === 'Moderate' ? 2 : 3

    return (
      <TouchableOpacity
        key={label}
        onPress={() => handleSelect(setIntensity, label)}
        style={[
          styles.intensityCard,
          {
            backgroundColor: isSelected
              ? colors.textPrimary
              : colors.surfaceSubtle,
          },
        ]}
      >
        <View style={styles.intensityIcon}>
          <View
            style={[
              styles.bar,
              {
                height: 8,
                backgroundColor: isSelected ? colors.bg : colors.textPrimary,
              },
            ]}
          />
          <View
            style={[
              styles.bar,
              {
                height: 12,
                backgroundColor:
                  maxBars >= 2
                    ? isSelected
                      ? colors.bg
                      : colors.textPrimary
                    : isSelected
                    ? 'rgba(255,255,255,0.3)'
                    : colors.border,
              },
            ]}
          />
          <View
            style={[
              styles.bar,
              {
                height: 16,
                backgroundColor:
                  maxBars >= 3
                    ? isSelected
                      ? colors.bg
                      : colors.textPrimary
                    : isSelected
                    ? 'rgba(255,255,255,0.3)'
                    : colors.border,
              },
            ]}
          />
        </View>
        <Text
          style={[
            styles.intensityText,
            { color: isSelected ? colors.bg : colors.textPrimary },
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    )
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <View
        style={[
          styles.header,
          {
            borderBottomColor: colors.border,
            paddingTop: insets.top + 16,
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.surfaceSubtle }]}
          onPress={onCancel}
        >
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          Custom Workout
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 120 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Location
          </Text>
          <View style={styles.row}>
            {LOCATION_OPTS.map((opt) => (
              <Pill
                key={opt}
                label={opt}
                isSelected={location === opt}
                onPress={() => handleSelect(setLocation, opt)}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Workout Type
          </Text>
          <View style={styles.row}>
            {WORKOUT_TYPES.map((opt) => (
              <Pill
                key={opt}
                label={opt}
                isSelected={workoutType === opt}
                onPress={() => handleSelect(setWorkoutType, opt)}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Time
          </Text>
          <View style={styles.row}>
            {TIMES.map((opt) => (
              <Pill
                key={opt}
                label={opt}
                isSelected={time === opt}
                onPress={() => handleSelect(setTime, opt)}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Muscle Focus
          </Text>
          <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
            Pick your workout&apos;s main muscles. It may include a few more.
          </Text>
          <View style={styles.row}>
            {MAIN_MUSCLES.map((opt) => (
              <Pill
                key={opt}
                label={opt}
                isSelected={selectedMuscles.includes(opt)}
                onPress={() => toggleMainMuscle(opt)}
              />
            ))}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.muscleScroller}
          >
            {SPECIFIC_MUSCLE_CHIP_DATA.map((chipData) => {
              const isSelected = selectedMuscles.includes(chipData.label)
              return (
                <TouchableOpacity
                  key={chipData.label}
                  style={styles.muscleCard}
                  onPress={() => toggleMuscle(chipData.label)}
                >
                  <View
                    style={[
                      styles.muscleAvatar,
                      {
                        backgroundColor: isSelected
                          ? colors.surfaceSubtle
                          : 'transparent',
                        borderColor: isSelected
                          ? colors.textPrimary
                          : colors.border,
                        borderWidth: isSelected ? 2 : 1,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.muscleBodyWrapper,
                        { transform: [{ translateY: chipData.offsetY }] },
                      ]}
                    >
                      <Body
                        data={chipData.bodyData}
                        gender={bodyGender}
                        side={chipData.side}
                        scale={chipData.scale}
                        colors={[MUSCLE_HIGHLIGHT_COLOR]}
                        border={MUSCLE_BORDER_COLOR}
                      />
                    </View>
                  </View>
                  <Text
                    style={[styles.muscleLabel, { color: colors.textPrimary }]}
                  >
                    {chipData.label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Intensity
          </Text>
          <View style={styles.intensityRow}>
            {INTENSITY_OPTS.map((opt) => renderIntensityCard(opt))}
          </View>
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: Math.max(insets.bottom, 16),
            backgroundColor: colors.bg,
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.submitBtn, { backgroundColor: colors.textPrimary }]}
          onPress={handleSubmit}
        >
          <Text style={[styles.submitText, { color: colors.bg }]}>
            Generate Workout
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  subtitle: {
    fontSize: 17,
    marginTop: 8,
    marginBottom: 24,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  sectionDesc: {
    fontSize: 14,
    marginBottom: 16,
    marginTop: -8,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  pill: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    marginRight: 10,
    marginBottom: 10,
  },
  pillText: {
    fontSize: 15,
    fontWeight: '600',
  },
  muscleScroller: {
    marginTop: 8,
  },
  muscleCard: {
    alignItems: 'center',
    marginRight: 16,
    width: 80,
  },
  muscleAvatar: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  muscleBodyWrapper: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 120,
    height: 240,
    marginTop: -120,
    marginLeft: -60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  muscleLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  intensityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  intensityCard: {
    flex: 1,
    height: 80,
    marginHorizontal: 4,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  intensityIcon: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 8,
    gap: 3,
  },
  bar: {
    width: 4,
    borderRadius: 2,
  },
  intensityText: {
    fontSize: 14,
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  switchTextCol: {
    flex: 1,
    paddingRight: 16,
  },
  switchTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  switchSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  statLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  statValBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statVal: {
    fontSize: 16,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  submitBtn: {
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: {
    fontSize: 16,
    fontWeight: '600',
  },
})
