import { useThemedColors } from '@/hooks/useThemedColors'
import { Ionicons } from '@expo/vector-icons'
import React from 'react'
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface FinalizeWorkoutOverlayProps {
  visible: boolean
  onClose: () => void // Called when modal is dismissed (swipe down)
  onSkip: () => void // Called when "Skip" is pressed
  onFinish: () => void
  onAttachWithCamera: () => void
  onAttachWithLibrary: () => void
  imageUri: string | null
  onRemoveImage: () => void
  description: string
  setDescription: (text: string) => void
  isLoading?: boolean
}

export function FinalizeWorkoutOverlay({
  visible,
  onClose,
  onSkip,
  onFinish,
  onAttachWithCamera,
  onAttachWithLibrary,
  imageUri,
  onRemoveImage,
  description,
  setDescription,
  isLoading = false,
}: FinalizeWorkoutOverlayProps) {
  const colors = useThemedColors()
  const insets = useSafeAreaInsets()
  const [showPhotoMenu, setShowPhotoMenu] = React.useState(false)

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerSpacer} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Log Workout
          </Text>
          <TouchableOpacity
            onPress={onSkip}
            style={styles.headerButton}
            disabled={isLoading}
          >
            <Text
              style={[styles.headerButtonText, { color: colors.textTertiary }]}
            >
              Skip
            </Text>
          </TouchableOpacity>
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
                backgroundColor: colors.backgroundLight,
                borderColor: colors.border,
              },
            ]}
          >
            {/* Media Row */}
            <View style={styles.mediaButtonsRow}>
              {/* Add Photo Button */}
              <View style={{ position: 'relative', zIndex: 10 }}>
                <TouchableOpacity
                  style={[
                    styles.mediaButton,
                    {
                      backgroundColor: colors.backgroundWhite,
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
                    color={colors.primary}
                  />
                  <Text
                    style={[
                      styles.mediaButtonText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Photos
                  </Text>
                </TouchableOpacity>

                {/* Custom Context Menu */}
                {showPhotoMenu && (
                  <View
                    style={[
                      styles.menuContainer,
                      {
                        backgroundColor: colors.backgroundWhite,
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
                      <Text style={[styles.menuText, { color: colors.text }]}>
                        Take a photo
                      </Text>
                      <Ionicons
                        name="camera-outline"
                        size={20}
                        color={colors.primary}
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
                      <Text style={[styles.menuText, { color: colors.text }]}>
                        Choose from Library...
                      </Text>
                      <Ionicons
                        name="grid-outline"
                        size={20}
                        color={colors.primary}
                      />
                    </TouchableOpacity>
                  </View>
                )}
              </View>

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
                      color={colors.white}
                    />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Description Input */}
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Say something about your workout (optional)"
              placeholderTextColor={colors.textTertiary}
              multiline
              value={description}
              onChangeText={setDescription}
              textAlignVertical="top"
              editable={!isLoading}
            />
          </View>

          {/* Finish Button */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.finishButton, { backgroundColor: colors.primary }]}
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerSpacer: {
    width: 60, // Balance the "Skip" button width
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  headerButton: {
    minWidth: 60,
    alignItems: 'flex-end',
    paddingVertical: 8,
  },
  headerButtonText: {
    fontSize: 16,
    fontWeight: '500',
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
    // Actually screenshot shows square buttons with icon on top of text.
    // Let's adjust to match screenshot: square buttons.
    width: 80,
    height: 80,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    flexDirection: 'column',
  },
  mediaButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  imagePreviewContainer: {
    width: 80,
    height: 80,
    marginBottom: 16,
    position: 'relative',
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
