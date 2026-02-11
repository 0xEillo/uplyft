import { WorkoutSongPicker } from '@/components/workout-song-picker'
import { WorkoutSongPreview } from '@/components/workout-song-preview'
import { useThemedColors } from '@/hooks/useThemedColors'
import type { WorkoutSong } from '@/types/music'
import { Ionicons } from '@expo/vector-icons'
import React from 'react'
import {
    ActivityIndicator,
    Image,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native'

interface FinalizeWorkoutOverlayProps {
  visible: boolean
  onClose: () => void // Called when modal is dismissed (swipe down)
  onFinish: () => void
  onAttachWithCamera: () => void
  onAttachWithLibrary: () => void
  imageUri: string | null
  onRemoveImage: () => void
  selectedSong: WorkoutSong | null
  onSelectSong: (song: WorkoutSong) => void
  onRemoveSong: () => void
  description: string
  setDescription: (text: string) => void
  isLoading?: boolean
}

export function FinalizeWorkoutOverlay({
  visible,
  onClose,
  onFinish,
  onAttachWithCamera,
  onAttachWithLibrary,
  imageUri,
  onRemoveImage,
  selectedSong,
  onSelectSong,
  onRemoveSong,
  description,
  setDescription,
  isLoading = false,
}: FinalizeWorkoutOverlayProps) {
  const colors = useThemedColors()
  const [showPhotoMenu, setShowPhotoMenu] = React.useState(false)
  const [showSongPicker, setShowSongPicker] = React.useState(false)
  const [isKeyboardVisible, setIsKeyboardVisible] = React.useState(false)

  // Reset photo menu state when modal closes to prevent stale state
  React.useEffect(() => {
    if (!visible) {
      setShowPhotoMenu(false)
      setShowSongPicker(false)
      setIsKeyboardVisible(false)
    }
  }, [visible])

  React.useEffect(() => {
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

  const handleRequestClose = React.useCallback(() => {
    if (isKeyboardVisible) {
      Keyboard.dismiss()
      return
    }
    onClose()
  }, [isKeyboardVisible, onClose])

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'formSheet' : 'fullScreen'}
      allowSwipeDismissal={Platform.OS === 'ios'}
      onRequestClose={handleRequestClose}
      onDismiss={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.surfaceSheet }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            Log Workout
          </Text>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.content}
        >
          {/* Main Card */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.surfaceSubtle,
                borderColor: colors.border,
              },
            ]}
          >
            {/* Media Row - Hide when picking a song */}
            {!showSongPicker && (
              <View style={styles.mediaButtonsRow}>
                {/* Add Photo Button */}
                <View style={{ position: 'relative', zIndex: 10 }}>
                  <TouchableOpacity
                    style={[
                      styles.mediaButton,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        borderWidth: 1,
                      },
                    ]}
                    onPress={() => setShowPhotoMenu(!showPhotoMenu)}
                    disabled={isLoading}
                  >
                    <Ionicons
                      name="images-outline"
                      size={24}
                      color={colors.brandPrimary}
                    />
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
                          onAttachWithCamera()
                        }}
                      >
                        <Text style={[styles.menuText, { color: colors.textPrimary }]}>
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
                          onAttachWithLibrary()
                        }}
                      >
                        <Text style={[styles.menuText, { color: colors.textPrimary }]}>
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

                <TouchableOpacity
                  style={[
                    styles.mediaButton,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      borderWidth: 1,
                    },
                  ]}
                  onPress={() => setShowSongPicker((prev) => !prev)}
                  disabled={isLoading}
                >
                  <Ionicons
                    name="musical-notes-outline"
                    size={24}
                    color={colors.brandPrimary}
                  />
                </TouchableOpacity>

                {/* Attached Image Preview */}
                {imageUri && (
                  <View style={styles.imagePreviewContainer}>
                    <Image
                      source={{ uri: imageUri }}
                      style={styles.imagePreview}
                    />
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={onRemoveImage}
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
            )}

            {selectedSong && !showSongPicker && (
              <View style={styles.songPreviewContainer}>
                <WorkoutSongPreview
                  song={selectedSong}
                  onRemove={onRemoveSong}
                  showAttribution={true}
                />
              </View>
            )}

            {showSongPicker && (
              <View style={styles.songPickerContainer}>
                <View style={styles.songPickerHeader}>
                  <TouchableOpacity
                    style={styles.songPickerBackButton}
                    onPress={() => setShowSongPicker(false)}
                    disabled={isLoading}
                  >
                    <Ionicons
                      name="chevron-back"
                      size={18}
                      color={colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.songPickerBackText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Back
                    </Text>
                  </TouchableOpacity>
                </View>
                <WorkoutSongPicker
                  selectedSong={selectedSong}
                  onSelectSong={(song) => {
                    onSelectSong(song)
                    setShowSongPicker(false)
                  }}
                  isDisabled={isLoading}
                />
              </View>
            )}

            {/* Description Input - Hide when picking a song */}
            {!showSongPicker && (
              <TextInput
                style={[styles.input, { color: colors.textPrimary }]}
                placeholder="Say something about your workout (optional)"
                placeholderTextColor={colors.textTertiary}
                multiline
                value={description}
                onChangeText={setDescription}
                textAlignVertical="top"
                editable={!isLoading}
              />
            )}
          </View>

          {/* Finish Button */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.finishButton, { backgroundColor: colors.brandPrimary }]}
              onPress={onFinish}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={[styles.finishButtonText, { color: '#fff' }]}>
                  Finish
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    minHeight: 200,
    borderWidth: 1,
    marginBottom: 24,
  },
  mediaButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  mediaButton: {
    width: 60,
    height: 60,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  imagePreviewContainer: {
    width: 60,
    height: 60,
    marginBottom: 16,
    position: 'relative',
  },
  songPreviewContainer: {
    marginBottom: 16,
    marginHorizontal: -10,
  },
  songPickerContainer: {
    marginBottom: 16,
  },
  songPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 8,
  },
  songPickerBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingRight: 8,
  },
  songPickerBackText: {
    fontSize: 15,
    fontWeight: '500',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
  },
  input: {
    fontSize: 16,
    lineHeight: 24,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  footer: {
    alignItems: 'center',
  },
  finishButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 30,
    minWidth: 120,
    alignItems: 'center',
  },
  finishButtonText: {
    fontSize: 16,
    fontWeight: '700',
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
})
