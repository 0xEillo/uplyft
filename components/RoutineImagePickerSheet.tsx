import { useThemedColors } from '@/hooks/useThemedColors'
import {
    generateRandomTintColor,
    getRoutineImageUrl,
    listSelectableRoutineImages,
    ROUTINE_TINT_COLORS,
    RoutineImage,
} from '@/lib/utils/routine-images'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { Image } from 'expo-image'
import React, { useCallback, useEffect, useState } from 'react'
import {
    ActivityIndicator,
    Dimensions,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const { width } = Dimensions.get('window')
// 3 columns with 20px horizontal padding and 12px gaps between images
const IMAGE_SIZE = (width - 40 - 24) / 3

interface RoutineImagePickerSheetProps {
  visible: boolean
  onClose: () => void
  onSelect: (imagePath: string | null, tintColor: string) => void
  selectedImagePath: string | null
  selectedTintColor: string | null
}

export function RoutineImagePickerSheet({
  visible,
  onClose,
  onSelect,
  selectedImagePath,
  selectedTintColor,
}: RoutineImagePickerSheetProps) {
  const colors = useThemedColors()
  const insets = useSafeAreaInsets()
  const styles = createStyles(colors)

  const [images, setImages] = useState<RoutineImage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentImagePath, setCurrentImagePath] = useState<string | null>(
    selectedImagePath
  )
  const [currentTintColor, setCurrentTintColor] = useState<string>(
    selectedTintColor || generateRandomTintColor()
  )

  useEffect(() => {
    if (visible) {
      loadImages()
      setCurrentImagePath(selectedImagePath)
      setCurrentTintColor(selectedTintColor || generateRandomTintColor())
    }
  }, [visible, selectedImagePath, selectedTintColor])

  const loadImages = async () => {
    setIsLoading(true)
    try {
      const availableImages = await listSelectableRoutineImages()
      setImages(availableImages)
    } catch (error) {
      console.error('Error loading routine images:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleImageSelect = useCallback((imagePath: string | null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setCurrentImagePath(imagePath)
  }, [])

  const handleColorSelect = useCallback((color: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setCurrentTintColor(color)
  }, [])

  const handleConfirm = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    onSelect(currentImagePath, currentTintColor)
    onClose()
  }, [currentImagePath, currentTintColor, onSelect, onClose])

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Choose Cover</Text>
          <TouchableOpacity onPress={handleConfirm} style={styles.headerButton}>
            <Text style={styles.doneText}>Done</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Preview */}
          <View style={styles.previewSection}>
            <View
              style={[
                styles.previewCard,
                { backgroundColor: currentTintColor + '30' },
              ]}
            >
              {currentImagePath ? (
                <Image
                  source={{ uri: getRoutineImageUrl(currentImagePath) || '' }}
                  style={styles.previewImage}
                  contentFit="cover"
                />
              ) : (
                <View
                  style={[
                    styles.previewPlaceholder,
                    { backgroundColor: currentTintColor + '40' },
                  ]}
                >
                  <Ionicons
                    name="barbell-outline"
                    size={48}
                    color={currentTintColor}
                  />
                </View>
              )}
              <View
                style={[
                  styles.previewTintOverlay,
                  { backgroundColor: currentTintColor, opacity: 0.2 },
                ]}
              />
            </View>
          </View>

          {/* Tint Color Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tint Color</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.colorsContainer}
            >
              {ROUTINE_TINT_COLORS.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    currentTintColor === color && styles.colorOptionSelected,
                  ]}
                  onPress={() => handleColorSelect(color)}
                >
                  {currentTintColor === color && (
                    <Ionicons name="checkmark" size={20} color="#FFF" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Images Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cover Image</Text>
            <Text style={styles.sectionSubtitle}>
              Choose an image or leave blank for a gradient background
            </Text>

            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : (
              <View style={styles.imagesGrid}>
                {/* No image option */}
                <TouchableOpacity
                  style={[
                    styles.imageOption,
                    !currentImagePath && styles.imageOptionSelected,
                  ]}
                  onPress={() => handleImageSelect(null)}
                >
                  <View
                    style={[
                      styles.noImagePlaceholder,
                      { backgroundColor: currentTintColor + '30' },
                    ]}
                  >
                    <Ionicons
                      name="color-palette-outline"
                      size={32}
                      color={currentTintColor}
                    />
                    <Text style={[styles.noImageText, { color: colors.text }]}>
                      Gradient
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Available images */}
                {images.map((image) => (
                  <TouchableOpacity
                    key={image.path}
                    style={[
                      styles.imageOption,
                      currentImagePath === image.path &&
                        styles.imageOptionSelected,
                    ]}
                    onPress={() => handleImageSelect(image.path)}
                  >
                    <Image
                      source={{ uri: image.url }}
                      style={styles.imageThumb}
                      contentFit="cover"
                    />
                    {currentImagePath === image.path && (
                      <View style={styles.selectedOverlay}>
                        <Ionicons name="checkmark-circle" size={28} color="#FFF" />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
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
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerButton: {
      padding: 8,
      minWidth: 60,
    },
    headerTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
    },
    cancelText: {
      fontSize: 17,
      color: colors.textSecondary,
    },
    doneText: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.primary,
      textAlign: 'right',
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 40,
    },
    previewSection: {
      padding: 20,
      alignItems: 'center',
    },
    previewCard: {
      width: 160,
      height: 200,
      borderRadius: 16,
      overflow: 'hidden',
    },
    previewImage: {
      width: '100%',
      height: '100%',
    },
    previewPlaceholder: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    previewTintOverlay: {
      ...StyleSheet.absoluteFillObject,
    },
    section: {
      padding: 20,
      paddingTop: 0,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    sectionSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 16,
    },
    colorsContainer: {
      gap: 12,
      paddingVertical: 8,
    },
    colorOption: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 3,
      borderColor: 'transparent',
    },
    colorOptionSelected: {
      borderColor: colors.text,
    },
    loadingContainer: {
      height: 200,
      justifyContent: 'center',
      alignItems: 'center',
    },
    imagesGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    imageOption: {
      width: IMAGE_SIZE,
      height: IMAGE_SIZE * 1.3,
      borderRadius: 16,
      overflow: 'hidden',
      borderWidth: 3,
      borderColor: 'transparent',
    },
    imageOptionSelected: {
      borderColor: colors.primary,
    },
    imageThumb: {
      width: '100%',
      height: '100%',
    },
    noImagePlaceholder: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 13,
      gap: 8,
    },
    noImageText: {
      fontSize: 12,
      fontWeight: '600',
    },
    selectedOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'center',
      alignItems: 'center',
    },
  })
