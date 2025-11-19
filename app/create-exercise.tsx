import { SlideInView } from '@/components/slide-in-view'
import { useAuth } from '@/contexts/auth-context'
import { useExerciseSelection } from '@/hooks/useExerciseSelection'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

const MUSCLE_GROUPS = [
  'Chest',
  'Back',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Core',
  'Glutes',
  'Quads',
  'Hamstrings',
  'Calves',
  'Cardio',
  'Full Body',
] as const

const EXERCISE_TYPES = ['compound', 'isolation'] as const

const EQUIPMENT_OPTIONS = [
  'barbell',
  'dumbbell',
  'bodyweight',
  'cable',
  'machine',
  'kettlebell',
  'resistance band',
  'other',
] as const

export default function CreateExerciseScreen() {
  const colors = useThemedColors()
  const { user } = useAuth()
  const router = useRouter()
  const { exerciseName: initialName } = useLocalSearchParams<{
    exerciseName?: string
  }>()
  const { callCallback } = useExerciseSelection()

  const [exerciseName, setExerciseName] = useState(initialName || '')
  const [muscleGroup, setMuscleGroup] = useState<string>('')
  const [exerciseType, setExerciseType] = useState<string>('')
  const [equipment, setEquipment] = useState<string>('')
  const [isCreating, setIsCreating] = useState(false)
  const [showMuscleGroupModal, setShowMuscleGroupModal] = useState(false)
  const [showTypeModal, setShowTypeModal] = useState(false)
  const [showEquipmentModal, setShowEquipmentModal] = useState(false)
  const [shouldExit, setShouldExit] = useState(false)
  const insets = useSafeAreaInsets()

  const styles = createStyles(colors)

  const showMuscleGroupPicker = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', ...MUSCLE_GROUPS],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex > 0) {
            setMuscleGroup(MUSCLE_GROUPS[buttonIndex - 1])
          }
        },
      )
    } else {
      setShowMuscleGroupModal(true)
    }
  }

  const showTypePicker = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [
            'Cancel',
            ...EXERCISE_TYPES.map((t) => t.charAt(0).toUpperCase() + t.slice(1)),
          ],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex > 0) {
            setExerciseType(EXERCISE_TYPES[buttonIndex - 1])
          }
        },
      )
    } else {
      setShowTypeModal(true)
    }
  }

  const showEquipmentPicker = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [
            'Cancel',
            ...EQUIPMENT_OPTIONS.map((e) => e.charAt(0).toUpperCase() + e.slice(1)),
          ],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex > 0) {
            setEquipment(EQUIPMENT_OPTIONS[buttonIndex - 1])
          }
        },
      )
    } else {
      setShowEquipmentModal(true)
    }
  }

  const isFormValid =
    exerciseName.trim() && muscleGroup && exerciseType && equipment

  const handleCreate = async () => {
    if (!isFormValid || isCreating) return

    if (!user) {
      Alert.alert(
        'Login Required',
        'You must be logged in to create exercises.',
      )
      return
    }

    try {
      setIsCreating(true)
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

      const newExercise = await database.exercises.createWithMetadata(
        exerciseName.trim(),
        user.id,
        {
          muscle_group: muscleGroup,
          type: exerciseType,
          equipment: equipment,
        },
      )

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

      // Trigger the callback to select this exercise
      callCallback(newExercise)

      // Navigate back
      router.back()
    } catch (error) {
      console.error('Error creating exercise:', error)
      Alert.alert(
        'Error',
        error instanceof Error
          ? error.message
          : 'Failed to create exercise. Please try again.',
      )
    } finally {
      setIsCreating(false)
    }
  }

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setShouldExit(true)
  }

  const handleExitComplete = () => {
    router.back()
  }

  return (
    <SlideInView
      style={{ flex: 1 }}
      shouldExit={shouldExit}
      onExitComplete={handleExitComplete}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Exercise</Text>
          <View style={styles.backButton} />
        </View>

        <ScrollView
          style={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.description}>
            Create a custom exercise by providing its details below.
          </Text>

          {/* Exercise Name */}
          <View style={styles.section}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={exerciseName}
              onChangeText={setExerciseName}
              placeholder="e.g. Bench Press"
              placeholderTextColor={colors.textPlaceholder}
              autoCapitalize="words"
            />
          </View>

          {/* Muscle Group */}
          <View style={styles.section}>
            <Text style={styles.label}>Muscle Group</Text>
            <TouchableOpacity
              style={styles.selectButton}
              onPress={showMuscleGroupPicker}
            >
              <Text
                style={[
                  styles.selectButtonText,
                  !muscleGroup && styles.selectButtonPlaceholder,
                ]}
              >
                {muscleGroup || 'Select muscle group'}
              </Text>
              <Ionicons
                name="chevron-down"
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {/* Exercise Type */}
          <View style={styles.section}>
            <Text style={styles.label}>Type</Text>
            <TouchableOpacity
              style={styles.selectButton}
              onPress={showTypePicker}
            >
              <Text
                style={[
                  styles.selectButtonText,
                  !exerciseType && styles.selectButtonPlaceholder,
                ]}
              >
                {exerciseType
                  ? exerciseType.charAt(0).toUpperCase() + exerciseType.slice(1)
                  : 'Select type'}
              </Text>
              <Ionicons
                name="chevron-down"
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
            <Text style={styles.helpText}>
              Compound works multiple muscles, isolation targets one
            </Text>
          </View>

          {/* Equipment */}
          <View style={styles.section}>
            <Text style={styles.label}>Equipment</Text>
            <TouchableOpacity
              style={styles.selectButton}
              onPress={showEquipmentPicker}
            >
              <Text
                style={[
                  styles.selectButtonText,
                  !equipment && styles.selectButtonPlaceholder,
                ]}
              >
                {equipment
                  ? equipment.charAt(0).toUpperCase() + equipment.slice(1)
                  : 'Select equipment'}
              </Text>
              <Ionicons
                name="chevron-down"
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {/* Create Button */}
          <TouchableOpacity
            style={[
              styles.createButton,
              !isFormValid && styles.createButtonDisabled,
            ]}
            onPress={handleCreate}
            disabled={!isFormValid || isCreating}
          >
            {isCreating ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="add-circle" size={20} color="#FFFFFF" />
                <Text style={styles.createButtonText}>Create Exercise</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Android Modals */}
      {Platform.OS === 'android' && (
        <>
          {/* Muscle Group Modal */}
          <Modal
            visible={showMuscleGroupModal}
            transparent
            animationType="fade"
            onRequestClose={() => setShowMuscleGroupModal(false)}
          >
            <Pressable
              style={styles.modalOverlay}
              onPress={() => setShowMuscleGroupModal(false)}
            >
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Select Muscle Group</Text>
                <ScrollView style={styles.modalScroll}>
                  {MUSCLE_GROUPS.map((group) => (
                    <TouchableOpacity
                      key={group}
                      style={styles.modalOption}
                      onPress={() => {
                        setMuscleGroup(group)
                        setShowMuscleGroupModal(false)
                      }}
                    >
                      <Text style={styles.modalOptionText}>{group}</Text>
                      {muscleGroup === group && (
                        <Ionicons
                          name="checkmark"
                          size={20}
                          color={colors.primary}
                        />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </Pressable>
          </Modal>

          {/* Type Modal */}
          <Modal
            visible={showTypeModal}
            transparent
            animationType="fade"
            onRequestClose={() => setShowTypeModal(false)}
          >
            <Pressable
              style={styles.modalOverlay}
              onPress={() => setShowTypeModal(false)}
            >
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Select Exercise Type</Text>
                <ScrollView style={styles.modalScroll}>
                  {EXERCISE_TYPES.map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={styles.modalOption}
                      onPress={() => {
                        setExerciseType(type)
                        setShowTypeModal(false)
                      }}
                    >
                      <Text style={styles.modalOptionText}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </Text>
                      {exerciseType === type && (
                        <Ionicons
                          name="checkmark"
                          size={20}
                          color={colors.primary}
                        />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </Pressable>
          </Modal>

          {/* Equipment Modal */}
          <Modal
            visible={showEquipmentModal}
            transparent
            animationType="fade"
            onRequestClose={() => setShowEquipmentModal(false)}
          >
            <Pressable
              style={styles.modalOverlay}
              onPress={() => setShowEquipmentModal(false)}
            >
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Select Equipment</Text>
                <ScrollView style={styles.modalScroll}>
                  {EQUIPMENT_OPTIONS.map((equip) => (
                    <TouchableOpacity
                      key={equip}
                      style={styles.modalOption}
                      onPress={() => {
                        setEquipment(equip)
                        setShowEquipmentModal(false)
                      }}
                    >
                      <Text style={styles.modalOptionText}>
                        {equip.charAt(0).toUpperCase() + equip.slice(1)}
                      </Text>
                      {equipment === equip && (
                        <Ionicons
                          name="checkmark"
                          size={20}
                          color={colors.primary}
                        />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </Pressable>
          </Modal>
        </>
      )}
      </View>
    </SlideInView>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: colors.backgroundWhite,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    backButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: -8,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    content: {
      flex: 1,
      paddingHorizontal: 20,
      paddingTop: 8,
    },
    description: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
      marginTop: 16,
      marginBottom: 8,
    },
    section: {
      marginTop: 20,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    input: {
      backgroundColor: colors.backgroundWhite,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
    },
    selectButton: {
      backgroundColor: colors.backgroundWhite,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    selectButtonText: {
      fontSize: 16,
      color: colors.text,
    },
    selectButtonPlaceholder: {
      color: colors.textPlaceholder,
    },
    helpText: {
      fontSize: 12,
      color: colors.textTertiary,
      marginTop: 8,
      lineHeight: 16,
    },
    createButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 12,
      marginTop: 40,
      marginBottom: 32,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 4,
    },
    createButtonDisabled: {
      backgroundColor: colors.textTertiary,
      opacity: 0.4,
      shadowOpacity: 0,
      elevation: 0,
    },
    createButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      backgroundColor: colors.backgroundWhite,
      borderRadius: 16,
      width: '100%',
      maxHeight: '70%',
      overflow: 'hidden',
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      padding: 20,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    modalScroll: {
      maxHeight: 400,
    },
    modalOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    modalOptionText: {
      fontSize: 16,
      color: colors.text,
    },
  })
