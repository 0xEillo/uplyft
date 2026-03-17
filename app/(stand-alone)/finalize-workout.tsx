import { useSubmitWorkout } from '@/hooks/useSubmitWorkout'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import type { StructuredExerciseDraft } from '@/lib/utils/workout-draft'
import {
  clearDraft as clearWorkoutDraft,
  loadDraft as loadWorkoutDraft,
} from '@/lib/utils/workout-draft'
import { Ionicons } from '@expo/vector-icons'
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker'
import * as ImagePicker from 'expo-image-picker'
import { useLocalSearchParams, useRouter } from 'expo-router'
import React, { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { LiquidGlassSurface } from '@/components/liquid-glass-surface'

export function convertStructuredDataToText(
  data: StructuredExerciseDraft[],
  unitDisplay: string = 'kg',
): string {
  if (!data || data.length === 0) return ''

  return data
    .map((exercise) => {
      const lines = [exercise.name]

      exercise.sets.forEach((set, index) => {
        if (set.weight || set.reps) {
          const weightText = set.weight || '___'
          const repsText = set.reps || '___'

          lines.push(
            `Set ${index + 1}: ${weightText} ${unitDisplay} x ${repsText} reps`,
          )
        }
      })

      return lines.join('\n')
    })
    .join('\n\n')
}

function getDefaultWorkoutTitle(): string {
  const hour = new Date().getHours()
  return hour < 12
    ? 'Morning Session'
    : hour < 15
      ? 'Afternoon Session'
      : 'Evening Session'
}

export default function FinalizeWorkoutScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{
    durationDisplay: string
    volumeValue: string
    volumeUnit: string
    setsCount: string
    durationSeconds: string
  }>()

  const colors = useThemedColors()
  const { weightUnit } = useWeightUnits()

  const [showPhotoMenu, setShowPhotoMenu] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [workoutDate, setWorkoutDate] = useState(new Date())
  const [imageUri, setImageUri] = useState<string | null>(null)
  
  const [isLoading, setIsLoading] = useState(false)
  const [draftLoaded, setDraftLoaded] = useState(false)
  const [draft, setDraft] = useState<any>(null)

  const { submitWorkout } = useSubmitWorkout()

  useEffect(() => {
    async function load() {
      const savedDraft = await loadWorkoutDraft()
      if (savedDraft) {
        setDraft(savedDraft)
        setTitle(
          savedDraft.title?.trim()
            ? savedDraft.title
            : getDefaultWorkoutTitle(),
        )
      } else {
        setTitle(getDefaultWorkoutTitle())
      }
      setDraftLoaded(true)
    }
    load()
  }, [])

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      setIsKeyboardVisible(true)
    })
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setIsKeyboardVisible(false)
    })

    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [])

  const handleDateChange = useCallback(
    (event: DateTimePickerEvent, selectedDate?: Date) => {
      if (Platform.OS === 'android') {
        setShowDatePicker(false)
      }
      if (event.type === 'set' && selectedDate) {
        setWorkoutDate(selectedDate)
      }
    },
    [],
  )

  const formatDisplayDateTime = (date: Date) => {
    const dPart = date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
    const tPart = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })
    return `${dPart}, ${tPart}`
  }

  const handleAttachWithCamera = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync()
      if (!permissionResult.granted) {
        alert('You need to enable camera permissions to take a picture.')
        return
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      })

      if (!result.canceled) {
        setImageUri(result.assets[0].uri)
      }
    } catch (error) {
      console.error('Error taking photo:', error)
      alert('Failed to take photo.')
    }
  }

  const handleAttachWithLibrary = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!permissionResult.granted) {
        alert('You need to enable camera roll permissions to select a picture.')
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      })

      if (!result.canceled) {
        setImageUri(result.assets[0].uri)
      }
    } catch (error) {
      console.error('Error selecting photo:', error)
      alert('Failed to select photo.')
    }
  }

  const handleFinish = async () => {
    if (!draft) return
    setIsLoading(true)

    try {
      // Combine structured data with free-form notes
      let workoutNotes = draft.notes
      let parserNotes = draft.notes

      if (
        draft.isStructuredMode &&
        draft.structuredData &&
        draft.structuredData.length > 0
      ) {
        const unitDisplay = weightUnit === 'kg' ? 'kg' : 'lbs'
        const structuredText = convertStructuredDataToText(
          draft.structuredData,
          unitDisplay,
        )

        workoutNotes =
          structuredText + (draft.notes.trim() ? '\n\n' + draft.notes : '')
      }

      await submitWorkout({
        notes: workoutNotes,
        title: title,
        imageUri: imageUri,
        routineId: draft.selectedRoutineId ?? null,
        durationSeconds: params.durationSeconds
          ? parseInt(params.durationSeconds, 10)
          : undefined,
        description: description,
        parserNotes: parserNotes,
        song: null,
        structuredData: draft.isStructuredMode
          ? draft.structuredData
          : undefined,
        isStructuredMode: draft.isStructuredMode,
        date: workoutDate,
      })

      // Clear draft after successful queue
      await clearWorkoutDraft('finalize-workout-submit')

      router.replace('/(tabs)')
    } catch (error) {
      console.error('Failed to submit workout', error)
      alert('Failed to submit workout. Please try again.')
      setIsLoading(false)
    }
  }

  if (!draftLoaded) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.bg,
            justifyContent: 'center',
            alignItems: 'center',
          },
        ]}
      >
        <ActivityIndicator size="large" color={colors.brandPrimary} />
      </View>
    )
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.bg }]}
      edges={['top', 'bottom']}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.back()}
          disabled={isLoading}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          Save Workout
        </Text>
        <LiquidGlassSurface style={styles.saveButtonGlass}>
          <TouchableOpacity
            onPress={handleFinish}
            style={styles.saveButtonTouchable}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator
                size="small"
                color={colors.brandPrimary}
              />
            ) : (
              <Ionicons
                name="checkmark"
                size={24}
                color={colors.brandPrimary}
              />
            )}
          </TouchableOpacity>
        </LiquidGlassSurface>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          {/* Workout Title */}
          <View style={[styles.titleInputRow, { borderColor: 'transparent' }]}>
            <TextInput
              style={[styles.titleInput, { color: colors.textPrimary }]}
              placeholder="Workout title"
              placeholderTextColor={colors.textTertiary}
              value={title}
              onChangeText={setTitle}
              maxLength={50}
              editable={!isLoading}
            />
            {title.trim().length > 0 && (
              <TouchableOpacity
                onPress={() => setTitle('')}
                disabled={isLoading}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={styles.titleClearButton}
              >
                <Ionicons
                  name="close-circle"
                  size={22}
                  color={colors.textTertiary}
                />
              </TouchableOpacity>
            )}
          </View>

          {/* Stats Section */}
          <View style={styles.statsContainer}>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text
                  style={[styles.statLabel, { color: colors.textSecondary }]}
                >
                  Duration
                </Text>
                <Text
                  style={[styles.statValue, { color: colors.brandPrimary }]}
                >
                  {params.durationDisplay}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text
                  style={[styles.statLabel, { color: colors.textSecondary }]}
                >
                  Volume
                </Text>
                <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                  {params.volumeValue} {params.volumeUnit}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text
                  style={[styles.statLabel, { color: colors.textSecondary }]}
                >
                  Sets
                </Text>
                <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                  {params.setsCount}
                </Text>
              </View>
            </View>

            <View
              style={[styles.statsDivider, { backgroundColor: colors.border }]}
            />

            <View style={styles.datePickerContainer}>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                When
              </Text>
              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                style={styles.dateButton}
                disabled={isLoading}
              >
                <Text
                  style={[
                    styles.dateButtonText,
                    { color: colors.brandPrimary },
                  ]}
                >
                  {formatDisplayDateTime(workoutDate)}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

        {/* Media Row */}
        <View style={styles.mediaButtonsRow}>
            {/* Add Photo Button */}
            <View style={{ position: 'relative', zIndex: 10 }}>
              <TouchableOpacity
                style={[
                  styles.mediaButtonLarge,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => setShowPhotoMenu(!showPhotoMenu)}
                disabled={isLoading}
              >
                <Ionicons
                  name="images-outline"
                  size={24}
                  color={colors.textPrimary}
                  style={{ marginBottom: 4 }}
                />
                <Text
                  style={[
                    styles.mediaButtonText,
                    { color: colors.textPrimary },
                  ]}
                >
                  Add a photo
                </Text>
              </TouchableOpacity>

              {/* Custom Context Menu */}
              {showPhotoMenu && (
                <View
                  style={[
                    styles.menuContainer,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => {
                      setShowPhotoMenu(false)
                      handleAttachWithCamera()
                    }}
                  >
                    <Text
                      style={[styles.menuText, { color: colors.textPrimary }]}
                    >
                      Take a photo
                    </Text>
                    <Ionicons
                      name="camera-outline"
                      size={20}
                      color={colors.brandPrimary}
                    />
                  </TouchableOpacity>
                  <View
                    style={[
                      styles.menuDivider,
                      { backgroundColor: colors.border },
                    ]}
                  />
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => {
                      setShowPhotoMenu(false)
                      handleAttachWithLibrary()
                    }}
                  >
                    <Text
                      style={[styles.menuText, { color: colors.textPrimary }]}
                    >
                      Choose from Library...
                    </Text>
                    <Ionicons
                      name="grid-outline"
                      size={20}
                      color={colors.brandPrimary}
                    />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Attached Image Preview */}
            {imageUri && (
              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: imageUri }} style={styles.imagePreview} />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => setImageUri(null)}
                  disabled={isLoading}
                >
                  <Ionicons
                    name="close-circle"
                    size={24}
                    color={colors.surface}
                  />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Description Input */}
          <View style={styles.descriptionSection}>
            <Text
              style={[
                styles.statLabel,
                { color: colors.textSecondary, marginBottom: 8 },
              ]}
            >
              Description
            </Text>
            <TextInput
              style={[styles.input, { color: colors.textPrimary }]}
              placeholder="How did your workout go? Leave some notes here..."
              placeholderTextColor={colors.textTertiary}
              multiline
              value={description}
              onChangeText={setDescription}
              textAlignVertical="top"
              editable={!isLoading}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Date Picker Overlay */}
      {Platform.OS === 'ios' && showDatePicker && (
        <Modal
          transparent
          animationType="slide"
          visible={showDatePicker}
          onRequestClose={() => setShowDatePicker(false)}
        >
          <View style={styles.datePickerOverlay} pointerEvents="auto">
            <View
              style={[
                styles.datePickerContent,
                { backgroundColor: colors.surfaceSheet },
              ]}
            >
              <View
                style={[
                  styles.datePickerHeader,
                  { borderBottomColor: colors.border },
                ]}
              >
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Text
                    style={[
                      styles.datePickerCancelText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
                <Text
                  style={[styles.datePickerTitle, { color: colors.textPrimary }]}
                >
                  Select Date
                </Text>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Text
                    style={[
                      styles.datePickerDoneText,
                      { color: colors.brandPrimary },
                    ]}
                  >
                    Done
                  </Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={workoutDate}
                mode="datetime"
                display="spinner"
                onChange={handleDateChange}
                maximumDate={new Date()}
                textColor={colors.textPrimary}
              />
            </View>
          </View>
        </Modal>
      )}

      {Platform.OS === 'android' && showDatePicker && (
        <DateTimePicker
          value={workoutDate}
          mode="datetime"
          display="default"
          onChange={handleDateChange}
          maximumDate={new Date()}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  saveButtonGlass: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonTouchable: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  titleInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: '700',
    paddingVertical: 0,
    paddingHorizontal: 0,
    paddingRight: 8,
  },
  titleClearButton: {
    padding: 4,
  },
  statsContainer: {
    marginBottom: 32,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 32,
    marginBottom: 20,
  },
  statItem: {
    gap: 4,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '400',
  },
  statValue: {
    fontSize: 17,
    fontWeight: '500',
  },
  statsDivider: {
    height: StyleSheet.hairlineWidth,
    marginBottom: 20,
  },
  datePickerContainer: {
    gap: 4,
  },
  dateButton: {
    paddingVertical: 4,
  },
  dateButtonText: {
    fontSize: 17,
    fontWeight: '400',
  },
  mediaButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  mediaButtonLarge: {
    width: 140,
    height: 140,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  imagePreviewContainer: {
    width: 140,
    height: 140,
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
  },
  descriptionSection: {
    marginBottom: 24,
  },
  visibilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 32,
  },
  visibilityLabel: {
    fontSize: 16,
    fontWeight: '400',
  },
  visibilityRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  visibilityValue: {
    fontSize: 16,
  },
  discardButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  discardButtonText: {
    color: '#E53935',
    fontSize: 16,
    fontWeight: '500',
  },
  input: {
    fontSize: 16,
    lineHeight: 24,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  menuContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    width: 250,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  menuText: {
    fontSize: 16,
    fontWeight: '400',
  },
  menuDivider: {
    height: 1,
    width: '100%',
  },
  datePickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    zIndex: 9999,
  },
  datePickerContent: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: Platform.OS === 'ios' ? 40 : 0,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  datePickerCancelText: {
    fontSize: 16,
  },
  datePickerDoneText: {
    fontSize: 16,
    fontWeight: '600',
  },
  datePickerTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
})
