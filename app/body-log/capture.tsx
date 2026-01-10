import { useThemedColors } from '@/hooks/useThemedColors'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import * as ImagePicker from 'expo-image-picker'
import { useRouter, useLocalSearchParams } from 'expo-router'
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, {
  Layout,
  ZoomIn,
} from 'react-native-reanimated'
import { useState } from 'react'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const GRID_PADDING = 20
const SLOT_SIZE = (SCREEN_WIDTH - GRID_PADDING * 2 - 12) / 2

interface CapturedPhoto {
  uri: string
  timestamp: number
}

const MAX_PHOTOS = 3

export default function BodyLogCaptureScreen() {
  const colors = useThemedColors()
  const router = useRouter()
  const { entryId } = useLocalSearchParams<{ entryId?: string }>()

  const [photos, setPhotos] = useState<(CapturedPhoto | null)[]>([null, null, null])
  const [isTakingPhoto, setIsTakingPhoto] = useState(false)
  const [activeTakingPhotoSlot, setActiveTakingPhotoSlot] = useState<number | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const photoCount = photos.filter((p) => p !== null).length
  const canContinue = photoCount >= 1
  const continueLabel = `Save (${photoCount}/${MAX_PHOTOS} photo${photoCount !== 1 ? 's' : ''})`

  const handleTakePhoto = async (slotIndex: number) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    try {
      // Check current permission status
      const currentStatus = await ImagePicker.getCameraPermissionsAsync()

      // If permission was previously denied, guide user to settings
      if (currentStatus.status === 'denied' && !currentStatus.canAskAgain) {
        Alert.alert(
          'Camera Access Needed',
          Platform.select({
            ios: 'To take body scan photos, please enable camera access in Settings > Rep AI > Camera.',
            android: 'To take body scan photos, please enable camera access in Settings > Apps > Rep AI > Permissions.',
          }),
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => Linking.openSettings(),
            },
          ],
        )
        return
      }

      // Request permission
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync()

      if (!permissionResult.granted) {
        Alert.alert(
          'Camera Permission Required',
          'Rep AI needs camera access to take body scan photos. You can enable this in your device settings.',
          [
            { text: 'Not Now', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => Linking.openSettings(),
            },
          ],
        )
        return
      }

      setIsTakingPhoto(true)
      setActiveTakingPhotoSlot(slotIndex)

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images' as any,
        allowsEditing: false,
        quality: 0.8,
      })

      if (!result.canceled && result.assets?.[0]) {
        const localUri = result.assets[0].uri
        const newPhotos = [...photos]
        newPhotos[slotIndex] = {
          uri: localUri,
          timestamp: Date.now(),
        }
        setPhotos(newPhotos)
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      }
    } catch (error) {
      console.error('Error opening camera:', error)
      Alert.alert(
        'Camera Error',
        'Failed to open camera. Please check your camera permissions in device settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open Settings',
            onPress: () => Linking.openSettings(),
          },
        ],
      )
    } finally {
      setIsTakingPhoto(false)
      setActiveTakingPhotoSlot(null)
    }
  }

  const handleRemovePhoto = async (slotIndex: number) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const newPhotos = [...photos]
    newPhotos[slotIndex] = null
    setPhotos(newPhotos)
  }

  const handleRetakePhoto = async (slotIndex: number) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    await handleTakePhoto(slotIndex)
  }

  const handlePhotoSlotPress = async (slotIndex: number) => {
    if (photos[slotIndex]) {
      // Show menu to retake or remove
      Alert.alert(
        `Photo ${slotIndex + 1}`,
        'What would you like to do?',
        [
          {
            text: 'Retake',
            onPress: () => handleRetakePhoto(slotIndex),
          },
          {
            text: 'Remove',
            onPress: () => handleRemovePhoto(slotIndex),
            style: 'destructive',
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ],
      )
    } else {
      // Take new photo
      await handleTakePhoto(slotIndex)
    }
  }

  const handleContinue = async () => {
    if (!canContinue || !entryId) return

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setIsSaving(true)

    try {
      const { uploadBodyLogImages } = await import('@/lib/utils/body-log-storage')
      const { database } = await import('@/lib/database')

      // Get user ID (we need to access it properly)
      const photoUris = photos
        .map((p) => p?.uri)
        .filter((uri): uri is string => uri !== undefined && uri !== null)

      // We need user ID - get from auth context (will need to pass it via params or get from context)
      // For now, let's assume we can get it from the entry
      const { supabase } = await import('@/lib/supabase')
      const { data: entryData } = await supabase
        .from('body_log_entries')
        .select('user_id')
        .eq('id', entryId)
        .single()

      if (!entryData) {
        throw new Error('Entry not found')
      }

      const userId = entryData.user_id

      // Upload images to storage
      const filePaths = await uploadBodyLogImages(photoUris, userId, entryId)

      // Add images to entry
      for (let i = 0; i < filePaths.length; i++) {
        await database.bodyLog.addImage(entryId, userId, filePaths[i], i + 1)
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

      // Navigate back to detail page
      router.back()
    } catch (error) {
      console.error('Error saving photos:', error)
      Alert.alert('Error', 'Failed to save photos. Please try again.')
      setIsSaving(false)
    }
  }

  const handleClose = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    router.back()
  }

  const dynamicStyles = createDynamicStyles(colors)

  return (
    <View style={dynamicStyles.container}>
      {/* Dark overlay */}
      <View style={dynamicStyles.overlay} />

      <SafeAreaView style={dynamicStyles.safeArea} edges={['top']}>
        {/* Header with close button */}
        <View style={dynamicStyles.header}>
          <TouchableOpacity
            style={dynamicStyles.closeButton}
            onPress={handleClose}
            accessibilityLabel="Close"
            accessibilityRole="button"
          >
            <Ionicons name="close" size={26} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Title */}
        <View style={dynamicStyles.titleSection}>
          <Text style={dynamicStyles.title}>Add Photos</Text>
          <Text style={dynamicStyles.subtitle}>
            Take 1-3 progress photos
          </Text>
        </View>

        {/* Photos Grid */}
        <View style={dynamicStyles.gridContainer}>
          <View style={dynamicStyles.grid}>
            {photos.map((photo, index) => (
              <Animated.View
                key={index}
                entering={ZoomIn.springify()}
                layout={Layout.springify()}
              >
                <TouchableOpacity
                  style={[
                    dynamicStyles.photoSlot,
                    {
                      width: SLOT_SIZE,
                      height: SLOT_SIZE,
                    },
                  ]}
                  onPress={() => handlePhotoSlotPress(index)}
                  activeOpacity={0.8}
                  disabled={isTakingPhoto}
                >
                  {photo ? (
                    <>
                      <Image
                        source={{ uri: photo.uri }}
                        style={dynamicStyles.photoImage}
                        resizeMode="cover"
                      />
                      {/* Checkmark overlay */}
                      <Animated.View
                        entering={ZoomIn.springify()}
                        style={dynamicStyles.checkmarkOverlay}
                      >
                        <View style={dynamicStyles.checkmarkCircle}>
                          <Ionicons
                            name="checkmark"
                            size={24}
                            color={colors.white}
                          />
                        </View>
                      </Animated.View>
                    </>
                  ) : (
                    <>
                      {isTakingPhoto && activeTakingPhotoSlot === index ? (
                        <View style={dynamicStyles.loadingContainer}>
                          <ActivityIndicator
                            size="large"
                            color={colors.primary}
                          />
                        </View>
                      ) : (
                        <>
                          <View
                            style={[
                              dynamicStyles.emptySlot,
                              {
                                backgroundColor: `${colors.primary}15`,
                              },
                            ]}
                          >
                            <Ionicons
                              name="camera"
                              size={40}
                              color={colors.primary}
                            />
                          </View>
                          <Text style={dynamicStyles.slotLabel}>
                            Photo {index + 1}
                          </Text>
                        </>
                      )}
                    </>
                  )}
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>

          {/* Progress indicator */}
          <View style={dynamicStyles.progressSection}>
            <View style={dynamicStyles.progressDots}>
              {photos.map((_, index) => (
                <View
                  key={index}
                  style={[
                    dynamicStyles.progressDot,
                    photos[index] !== null && {
                      backgroundColor: colors.primary,
                    },
                  ]}
                />
              ))}
            </View>
            <Text style={dynamicStyles.progressText}>
              {photoCount} of {MAX_PHOTOS} photos
            </Text>
          </View>
        </View>

        {/* Info text */}
        <View style={dynamicStyles.infoSection}>
          <View style={dynamicStyles.infoBadge}>
            <Ionicons
              name="bulb-outline"
              size={16}
              color={colors.primary}
            />
            <Text style={[
              dynamicStyles.infoText,
              { color: colors.primary }
            ]}>
              Take at least one photo. More photos = better body scan analysis.
            </Text>
          </View>
        </View>

        {/* Continue button */}
        <View style={dynamicStyles.buttonSection}>
          <TouchableOpacity
            style={[
              dynamicStyles.continueButton,
              {
                backgroundColor: canContinue
                  ? colors.primary
                  : colors.textSecondary + '40',
              },
            ]}
            onPress={handleContinue}
            activeOpacity={canContinue ? 0.8 : 1}
            disabled={!canContinue || isTakingPhoto || isSaving}
            accessibilityLabel={`Save ${photoCount} photos`}
            accessibilityRole="button"
          >
            <Text style={dynamicStyles.continueButtonText}>
              {isSaving ? 'Saving...' : continueLabel}
            </Text>
          </TouchableOpacity>
          <Text style={dynamicStyles.buttonHint}>
            {photoCount === 0
              ? 'Take at least one photo to continue.'
              : `${photoCount} photo${photoCount !== 1 ? 's' : ''} ready to save.`}
          </Text>
        </View>
      </SafeAreaView>
    </View>
  )
}

type Colors = ReturnType<typeof useThemedColors>

const createDynamicStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000000',
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: '#000000',
    },
    safeArea: {
      flex: 1,
      justifyContent: 'space-between',
    },
    header: {
      alignItems: 'flex-end',
      paddingHorizontal: GRID_PADDING,
      paddingVertical: 8,
    },
    closeButton: {
      width: 44,
      height: 44,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 22,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    titleSection: {
      alignItems: 'center',
      paddingHorizontal: GRID_PADDING,
      marginBottom: 16,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: '#FFFFFF',
      letterSpacing: -0.5,
      marginBottom: 6,
    },
    subtitle: {
      fontSize: 13,
      color: 'rgba(255, 255, 255, 0.85)',
      textAlign: 'center',
      fontWeight: '500',
    },
    gridContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: GRID_PADDING,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 12,
      marginBottom: 32,
    },
    photoSlot: {
      borderRadius: 20,
      overflow: 'hidden',
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      borderWidth: 2,
      borderColor: `${colors.primary}30`,
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
    },
    photoImage: {
      width: '100%',
      height: '100%',
    },
    emptySlot: {
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 18,
      padding: 24,
    },
    slotLabel: {
      position: 'absolute',
      bottom: 8,
      fontSize: 11,
      fontWeight: '600',
      color: 'rgba(255, 255, 255, 0.7)',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    checkmarkOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'flex-end',
      alignItems: 'flex-end',
      padding: 8,
    },
    checkmarkCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.success,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: colors.success,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.5,
      shadowRadius: 8,
      elevation: 4,
    },
    loadingContainer: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.3)',
      borderRadius: 20,
    },
    progressSection: {
      alignItems: 'center',
      gap: 12,
    },
    progressDots: {
      flexDirection: 'row',
      gap: 8,
    },
    progressDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: 'rgba(255, 255, 255, 0.3)',
    },
    progressText: {
      fontSize: 12,
      fontWeight: '600',
      color: 'rgba(255, 255, 255, 0.7)',
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    infoSection: {
      paddingHorizontal: GRID_PADDING,
      paddingVertical: 16,
      marginBottom: 12,
    },
    infoBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: `${colors.primary}15`,
      gap: 8,
    },
    infoText: {
      fontSize: 13,
      fontWeight: '500',
      letterSpacing: -0.1,
    },
    weightSection: {
      paddingHorizontal: 24,
      gap: 12,
      marginBottom: 12,
    },
    weightHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    weightTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
      letterSpacing: -0.2,
    },
    unitToggle: {
      flexDirection: 'row',
      gap: 8,
    },
    unitButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.3)',
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
    unitButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    unitButtonText: {
      fontSize: 12,
      fontWeight: '600',
      color: 'rgba(255, 255, 255, 0.7)',
      letterSpacing: 0.6,
    },
    unitButtonTextActive: {
      color: colors.buttonText,
    },
    weightInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 18,
      backgroundColor: 'rgba(0, 0, 0, 0.35)',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    weightIcon: {
      marginRight: 12,
    },
    weightInput: {
      flex: 1,
      fontSize: 22,
      fontWeight: '600',
      color: '#FFFFFF',
      letterSpacing: -0.3,
    },
    weightInputError: {
      borderColor: colors.error,
    },
    weightHelperRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    weightHelperText: {
      fontSize: 12,
      color: 'rgba(255, 255, 255, 0.7)',
      flex: 1,
      marginRight: 8,
    },
    weightHelperTextError: {
      color: colors.error,
    },
    weightPreview: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary,
    },
    buttonSection: {
      paddingHorizontal: GRID_PADDING,
      paddingBottom: 32,
      gap: 10,
    },
    continueButton: {
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 16,
      elevation: 10,
    },
    continueButtonText: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.white,
      letterSpacing: -0.3,
    },
    buttonHint: {
      fontSize: 12,
      color: 'rgba(255, 255, 255, 0.7)',
      textAlign: 'center',
    },
  })
