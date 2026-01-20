import { useThemedColors } from '@/hooks/useThemedColors'
import { haptic } from '@/lib/haptics'
import { Ionicons } from '@expo/vector-icons'
import { useEffect } from 'react'
import {
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native'
import {
    Gesture,
    GestureDetector,
    GestureHandlerRootView,
} from 'react-native-gesture-handler'
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated'

interface ImagePickerModalProps {
  visible: boolean
  onClose: () => void
  onScanWithCamera: () => void
  onScanWithLibrary: () => void
}

export function ImagePickerModal({
  visible,
  onClose,
  onScanWithCamera,
  onScanWithLibrary,
}: ImagePickerModalProps) {
  const colors = useThemedColors()
  const translateY = useSharedValue(0)

  useEffect(() => {
    if (visible) {
      haptic('medium')
      translateY.value = 0
    }
  }, [visible, translateY])

  const closeSheet = () => {
    haptic('light')
    onClose()
  }

  const pan = Gesture.Pan()
    .onUpdate((event) => {
      if (event.translationY > 0) {
        translateY.value = event.translationY
      }
    })
    .onEnd((event) => {
      if (event.translationY > 100 || event.velocityY > 1000) {
        translateY.value = withTiming(500, { duration: 200 }, () => {
          runOnJS(closeSheet)()
        })
      } else {
        translateY.value = withSpring(0, {
          damping: 20,
          stiffness: 300,
        })
      }
    })

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }))

  const handleClose = () => {
    haptic('light')
    onClose()
  }

  const handleScan = () => {
    haptic('medium')
    onClose()
    // Launch camera directly after menu closes
    setTimeout(onScanWithCamera, 250)
  }

  const styles = createStyles(colors)

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <GestureHandlerRootView style={styles.container}>
        {/* Backdrop */}
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose}>
          <View style={styles.backdrop} />
        </Pressable>

        {/* Bottom Sheet */}
        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.bottomSheet, animatedStyle]}>
            <View style={styles.sheetHandle}>
              <View style={styles.handle} />
            </View>

            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Scan Workout</Text>
            </View>

            <View style={styles.optionsContainer}>
              {/* Scan Button */}
              <TouchableOpacity
                style={styles.optionButton}
                onPress={handleScan}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.optionIcon,
                    { backgroundColor: colors.brandPrimary },
                  ]}
                >
                  <Ionicons name="scan" size={28} color={colors.surface} />
                </View>
                <View style={styles.optionTextContainer}>
                  <Text style={styles.optionLabel}>Scan Workout</Text>
                  <Text style={styles.optionDescription}>
                    Extract text from image
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    bottomSheet: {
      backgroundColor: colors.bg,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingBottom: 34,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 12,
    },
    sheetHandle: {
      alignItems: 'center',
      paddingTop: 12,
      paddingBottom: 4,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
    },
    sheetHeader: {
      alignItems: 'center',
      paddingTop: 12,
      paddingBottom: 8,
      paddingHorizontal: 24,
    },
    sheetTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
      letterSpacing: 0.3,
    },
    optionsContainer: {
      paddingHorizontal: 16,
      paddingTop: 16,
      gap: 12,
    },
    optionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      padding: 18,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 16,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 2,
    },
    optionIcon: {
      width: 56,
      height: 56,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
    },
    optionTextContainer: {
      flex: 1,
      gap: 4,
    },
    optionLabel: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.textPrimary,
      letterSpacing: 0.1,
    },
    optionDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      letterSpacing: 0,
    },
  })
