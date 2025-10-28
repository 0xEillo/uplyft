import { useThemedColors } from '@/hooks/useThemedColors'
import { useSubscription } from '@/contexts/subscription-context'
import { AnalyticsEvents } from '@/constants/analytics-events'
import { useAnalytics } from '@/contexts/analytics-context'
import { Paywall } from '@/components/paywall'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import * as ImagePicker from 'expo-image-picker'
import { useRouter, useLocalSearchParams } from 'expo-router'
import {
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
  Platform,
  Linking,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useState } from 'react'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')

export default function BodyLogIntroPage() {
  const colors = useThemedColors()
  const { isProMember } = useSubscription()
  const { trackEvent } = useAnalytics()
  const router = useRouter()
  const { userGender } = useLocalSearchParams<{ userGender?: string }>()
  const [showPaywall, setShowPaywall] = useState(false)

  const gender =
    userGender === 'male' || userGender === 'female' ? userGender : null

  const handleTakePhoto = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    // Check if user is pro member
    if (!isProMember) {
      setShowPaywall(true)
      trackEvent(AnalyticsEvents.PAYWALL_SHOWN, {
        feature: 'body_scan',
      })
      return
    }

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

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images' as any,
        allowsEditing: false,
        quality: 0.8,
      })

      if (result.canceled || !result.assets?.[0]) {
        // User cancelled, stay on intro page
        return
      }

      const localUri = result.assets[0].uri

      // Navigate to processing page with image URI
      router.replace({
        pathname: '/body-log/processing',
        params: { imageUri: localUri },
      })
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
        {/* Close button */}
        <TouchableOpacity
          style={dynamicStyles.closeButton}
          onPress={handleClose}
          accessibilityLabel="Close"
          accessibilityRole="button"
        >
          <Ionicons name="close" size={26} color="#FFFFFF" />
        </TouchableOpacity>
      </SafeAreaView>

      {/* Content */}
      <View style={dynamicStyles.content}>
        {/* Large Example Images - main focus */}
        <View style={dynamicStyles.imagesSection}>
          <View style={dynamicStyles.imagesContainer}>
            {gender === 'male' ? (
              <View style={dynamicStyles.singleImageWrapper}>
                <Image
                  source={require('../../llm/man-rep.png')}
                  style={dynamicStyles.exampleImage}
                  resizeMode="contain"
                />
              </View>
            ) : gender === 'female' ? (
              <View style={dynamicStyles.singleImageWrapper}>
                <Image
                  source={require('../../llm/woman-rep.png')}
                  style={dynamicStyles.exampleImage}
                  resizeMode="contain"
                />
              </View>
            ) : (
              <>
                <View style={dynamicStyles.imageWrapper}>
                  <Image
                    source={require('../../llm/man-rep.png')}
                    style={dynamicStyles.exampleImage}
                    resizeMode="contain"
                  />
                </View>
                <View style={dynamicStyles.imageWrapper}>
                  <Image
                    source={require('../../llm/woman-rep.png')}
                    style={dynamicStyles.exampleImage}
                    resizeMode="contain"
                  />
                </View>
              </>
            )}
          </View>
          <View style={dynamicStyles.captionContainer}>
            <Text style={dynamicStyles.imageCaption}>
              Wear example clothing for best results
            </Text>
          </View>
        </View>

        {/* Bottom Section */}
        <View style={dynamicStyles.bottomSection}>
          {/* Header - compact */}
          <View style={dynamicStyles.header}>
            <Text style={dynamicStyles.title}>Body Scan</Text>
            <Text style={dynamicStyles.description}>
              Get accurate body composition analysis
            </Text>
          </View>

          {/* Take Photo Button - bottom */}
          <TouchableOpacity
            style={dynamicStyles.takePhotoButton}
            onPress={handleTakePhoto}
            activeOpacity={0.8}
            accessibilityLabel="Take photo"
            accessibilityRole="button"
          >
            <Ionicons name="camera" size={24} color={colors.white} />
            <Text style={dynamicStyles.buttonText}>Take Photo</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Paywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        title="Body Scan is Premium"
        message="Track your body composition changes with AI-powered analysis. Unlock body scanning to monitor your progress over time."
      />
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
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10,
    },
    content: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 0,
      justifyContent: 'space-between',
    },
    closeButton: {
      alignSelf: 'flex-end',
      marginRight: 16,
      marginTop: 8,
      width: 44,
      height: 44,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 22,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    imagesSection: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 4,
      maxHeight: SCREEN_HEIGHT * 0.75,
    },
    imagesContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
      width: '100%',
    },
    imageWrapper: {
      aspectRatio: 3 / 4,
      width: SCREEN_WIDTH * 0.47,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: `${colors.primary}12`,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: `${colors.primary}20`,
      overflow: 'hidden',
    },
    singleImageWrapper: {
      aspectRatio: 3 / 4,
      maxWidth: SCREEN_WIDTH * 0.8,
      width: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: `${colors.primary}12`,
      borderRadius: 24,
      borderWidth: 2,
      borderColor: `${colors.primary}25`,
      overflow: 'hidden',
    },
    exampleImage: {
      width: '98%',
      height: '98%',
    },
    captionContainer: {
      paddingTop: 8,
      alignItems: 'center',
      paddingHorizontal: 8,
    },
    imageCaption: {
      fontSize: 12,
      color: 'rgba(255, 255, 255, 0.65)',
      textAlign: 'center',
      fontStyle: 'italic',
      fontWeight: '500',
      lineHeight: 18,
    },
    bottomSection: {
      paddingBottom: 32,
      paddingTop: 12,
    },
    header: {
      alignItems: 'center',
      marginBottom: 16,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: '#FFFFFF',
      letterSpacing: -0.5,
      marginBottom: 6,
    },
    description: {
      fontSize: 13,
      color: 'rgba(255, 255, 255, 0.85)',
      textAlign: 'center',
      lineHeight: 19,
      fontWeight: '500',
    },
    takePhotoButton: {
      flexDirection: 'row',
      backgroundColor: colors.primary,
      paddingVertical: 15,
      paddingHorizontal: 32,
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 12,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 16,
      elevation: 10,
    },
    buttonText: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.white,
      letterSpacing: -0.3,
    },
  })
