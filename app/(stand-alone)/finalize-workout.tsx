import { WorkoutSongPicker } from '@/components/workout-song-picker'
import { WorkoutSongPreview } from '@/components/workout-song-preview'
import { useWorkoutComposer } from '@/contexts/workout-composer-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import type { WorkoutSong } from '@/types/music'
import { Ionicons } from '@expo/vector-icons'
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker'
import * as ImagePicker from 'expo-image-picker'
import { useLocalSearchParams, useRouter } from 'expo-router'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { LiquidGlassSurface } from '@/components/liquid-glass-surface'
import { beginSingleFlight, endSingleFlight } from '@/lib/utils/single-flight'

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
  const {
    enqueueCurrentSession,
    hasActiveSession,
    hasHydrated,
    review,
    returnToEditing,
    updateReview,
  } = useWorkoutComposer()

  const [showPhotoMenu, setShowPhotoMenu] = useState(false)
  const [showSongPicker, setShowSongPicker] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)

  const [isLoading, setIsLoading] = useState(false)
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const hasDismissedRef = useRef(false)
  const isFinishingRef = useRef(false)

  const closeToTabs = useCallback(() => {
    if (hasDismissedRef.current) {
      return
    }

    hasDismissedRef.current = true
    router.dismissTo('/(tabs)')
  }, [router])

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'
    const showSub = Keyboard.addListener(showEvent, (e) =>
      setKeyboardHeight(e.endCoordinates.height),
    )
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0))
    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [])

  useEffect(() => {
    if (!hasHydrated) {
      return
    }

    if (!hasActiveSession) {
      closeToTabs()
    }
  }, [closeToTabs, hasActiveSession, hasHydrated])

  const workoutDate = useMemo(() => {
    if (review.performedAt) {
      const parsed = new Date(review.performedAt)
      if (!Number.isNaN(parsed.getTime())) {
        return parsed
      }
    }

    return new Date()
  }, [review.performedAt])

  const handleDateChange = useCallback(
    (event: DateTimePickerEvent, selectedDate?: Date) => {
      if (Platform.OS === 'android') {
        setShowDatePicker(false)
      }
      if (event.type === 'set' && selectedDate) {
        updateReview({
          performedAt: selectedDate.toISOString(),
        })
      }
    },
    [updateReview],
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

  const toggleSongPicker = useCallback(() => {
    setShowPhotoMenu(false)
    setShowSongPicker((current) => !current)
  }, [])

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
        updateReview({ imageUri: result.assets[0].uri })
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
        updateReview({ imageUri: result.assets[0].uri })
      }
    } catch (error) {
      console.error('Error selecting photo:', error)
      alert('Failed to select photo.')
    }
  }

  const handleFinish = async () => {
    if (!hasActiveSession || !beginSingleFlight(isFinishingRef)) return
    setIsLoading(true)

    try {
      await enqueueCurrentSession()
      closeToTabs()
    } catch (error) {
      console.error('Failed to submit workout', error)
      alert('Failed to submit workout. Please try again.')
      setIsLoading(false)
      endSingleFlight(isFinishingRef)
    }
  }

  if (!hasHydrated || !hasActiveSession) {
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
        <LiquidGlassSurface style={styles.headerButtonGlass}>
          <TouchableOpacity
            style={styles.headerButtonTouchable}
            onPress={() => {
              returnToEditing()
              router.back()
            }}
            disabled={isLoading}
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </LiquidGlassSurface>
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
              <ActivityIndicator size="small" color={colors.brandPrimary} />
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
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: 40 + keyboardHeight },
          ]}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          {/* Workout Title */}
          <View style={[styles.titleInputRow, { borderColor: 'transparent' }]}>
            <TextInput
              style={[styles.titleInput, { color: colors.textPrimary }]}
              placeholder="Workout title"
              placeholderTextColor={colors.textTertiary}
              value={review.title}
              onChangeText={(value) => updateReview({ title: value })}
              maxLength={50}
              editable={!isLoading}
            />
            {review.title.trim().length > 0 && (
              <TouchableOpacity
                onPress={() => updateReview({ title: '' })}
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

          <View style={styles.mediaButtonsRow}>
            {/* Add Photo Button or Image Preview (replaces when photo added) */}
            <View style={{ position: 'relative', zIndex: 10 }}>
              {review.imageUri ? (
                <View style={styles.imagePreviewContainer}>
                  <Image
                    source={{ uri: review.imageUri }}
                    style={styles.imagePreview}
                  />
                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={() => updateReview({ imageUri: null })}
                    disabled={isLoading}
                  >
                    <Ionicons
                      name="close-circle"
                      size={24}
                      color={colors.surface}
                    />
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <TouchableOpacity
                    style={[
                      styles.mediaButtonLarge,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={() => {
                      setShowSongPicker(false)
                      setShowPhotoMenu((current) => !current)
                    }}
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
                </>
              )}
            </View>

            <TouchableOpacity
              style={[
                styles.mediaButtonLarge,
                {
                  backgroundColor: review.song
                    ? colors.brandPrimarySoft
                    : colors.surface,
                  borderColor: review.song
                    ? colors.brandPrimary
                    : colors.border,
                },
              ]}
              onPress={toggleSongPicker}
              disabled={isLoading}
            >
              <Ionicons
                name={review.song ? 'musical-notes' : 'musical-notes-outline'}
                size={24}
                color={review.song ? colors.brandPrimary : colors.textPrimary}
                style={{ marginBottom: 6 }}
              />
              <Text
                style={[
                  styles.mediaButtonText,
                  {
                    color: review.song
                      ? colors.brandPrimary
                      : colors.textPrimary,
                  },
                ]}
              >
                {review.song ? 'Change song' : 'Add music'}
              </Text>
              {review.song && (
                <Text
                  style={[
                    styles.mediaButtonMeta,
                    { color: colors.textSecondary },
                  ]}
                  numberOfLines={2}
                >
                  {`${review.song.trackName} • ${review.song.artistName}`}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {(review.song || showSongPicker) && (
            <View
              style={[
                styles.musicSection,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={styles.musicSectionHeader}>
                <View style={styles.musicSectionCopy}>
                  <Text
                    style={[
                      styles.musicSectionTitle,
                      { color: colors.textPrimary },
                    ]}
                  >
                    Music
                  </Text>
                  <Text
                    style={[
                      styles.musicSectionSubtitle,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Add a song that captures the session.
                  </Text>
                </View>
                {showSongPicker && (
                  <TouchableOpacity
                    onPress={() => setShowSongPicker(false)}
                    disabled={isLoading}
                    style={styles.musicSectionAction}
                  >
                    <Text
                      style={[
                        styles.musicSectionActionText,
                        { color: colors.brandPrimary },
                      ]}
                    >
                      Close
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {review.song && (
                <WorkoutSongPreview
                  song={review.song}
                  onRemove={() => {
                    updateReview({ song: null })
                    setShowSongPicker(false)
                  }}
                  showAttribution={!showSongPicker}
                  containerStyle={[
                    styles.musicPreviewCard,
                    {
                      backgroundColor: colors.surfaceSubtle,
                    },
                  ]}
                  artworkSize={52}
                />
              )}

              {showSongPicker && (
                <WorkoutSongPicker
                  selectedSong={review.song as WorkoutSong | null}
                  onSelectSong={(song) => {
                    updateReview({ song })
                    setShowSongPicker(false)
                  }}
                  isDisabled={isLoading}
                />
              )}
            </View>
          )}

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
              value={review.description}
              onChangeText={(value) => updateReview({ description: value })}
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
                  style={[
                    styles.datePickerTitle,
                    { color: colors.textPrimary },
                  ]}
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
  headerButtonGlass: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButtonTouchable: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
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
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 20,
  },
  mediaButtonLarge: {
    width: 120,
    height: 120,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaButtonText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  mediaButtonMeta: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  imagePreviewContainer: {
    width: 120,
    height: 120,
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
  musicSection: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 16,
    marginBottom: 32,
  },
  musicSectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  musicSectionCopy: {
    flex: 1,
    gap: 4,
  },
  musicSectionTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  musicSectionSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  musicSectionAction: {
    paddingVertical: 4,
  },
  musicSectionActionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  musicPreviewCard: {
    borderRadius: 18,
    padding: 12,
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
