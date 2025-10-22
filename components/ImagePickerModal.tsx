import { useThemedColors } from '@/hooks/useThemedColors'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useEffect, useRef } from 'react'
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

interface ImagePickerModalProps {
  visible: boolean
  onClose: () => void
  onScanWithCamera: () => void
  onScanWithLibrary: () => void
  onAttachWithCamera: () => void
  onAttachWithLibrary: () => void
}

interface FABButtonProps {
  icon: string
  label: string
  onPress: () => void
  color: string
  animation: Animated.Value
  delay: number
  styles: ReturnType<typeof createStyles>
}

function FABButton({ icon, label, onPress, color, animation, delay, styles }: FABButtonProps) {
  const colors = useThemedColors()

  const scale = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  })

  const opacity = animation.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, 1],
  })

  const translateY = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0],
  })

  return (
    <Animated.View
      style={[
        styles.fabButtonContainer,
        {
          opacity,
          transform: [{ scale }, { translateY }],
        },
      ]}
    >
      <TouchableOpacity
        style={[styles.fabButton, { backgroundColor: color }]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <Ionicons name={icon as any} size={26} color={colors.white} />
      </TouchableOpacity>
      <View style={styles.labelContainer}>
        <Text style={styles.label}>{label}</Text>
      </View>
    </Animated.View>
  )
}

export function ImagePickerModal({
  visible,
  onClose,
  onScanWithCamera,
  onScanWithLibrary,
  onAttachWithCamera,
  onAttachWithLibrary,
}: ImagePickerModalProps) {
  const colors = useThemedColors()
  const backdropAnim = useRef(new Animated.Value(0)).current
  const button1Anim = useRef(new Animated.Value(0)).current
  const button2Anim = useRef(new Animated.Value(0)).current
  const closeButtonAnim = useRef(new Animated.Value(0)).current
  const mainButtonRotate = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (visible) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

      // Reset all animations
      button1Anim.setValue(0)
      button2Anim.setValue(0)
      closeButtonAnim.setValue(0)

      Animated.parallel([
        // Backdrop fade in
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        // Main button rotate
        Animated.spring(mainButtonRotate, {
          toValue: 1,
          tension: 80,
          friction: 8,
          useNativeDriver: true,
        }),
        // Staggered button animations
        Animated.stagger(60, [
          Animated.spring(button1Anim, {
            toValue: 1,
            tension: 80,
            friction: 8,
            useNativeDriver: true,
          }),
          Animated.spring(button2Anim, {
            toValue: 1,
            tension: 80,
            friction: 8,
            useNativeDriver: true,
          }),
          Animated.spring(closeButtonAnim, {
            toValue: 1,
            tension: 80,
            friction: 8,
            useNativeDriver: true,
          }),
        ]),
      ]).start()
    } else {
      Animated.parallel([
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(mainButtonRotate, {
          toValue: 0,
          tension: 80,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(button1Anim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(button2Anim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(closeButtonAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }, [visible, backdropAnim, button1Anim, button2Anim, closeButtonAnim, mainButtonRotate])

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onClose()
  }

  const handleScan = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onClose()
    // Launch camera directly after menu closes
    setTimeout(onScanWithCamera, 250)
  }

  const handleAttach = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onClose()
    // Launch camera directly after menu closes
    setTimeout(onAttachWithCamera, 250)
  }

  const closeScale = closeButtonAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  })

  const closeOpacity = closeButtonAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, 1],
  })

  const styles = createStyles(colors)

  if (!visible) return null

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <View style={styles.container}>
        {/* Backdrop */}
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose}>
          <Animated.View
            style={[
              styles.backdrop,
              {
                opacity: backdropAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.4],
                }),
              },
            ]}
          />
        </Pressable>

        {/* FAB Menu - positioned at bottom right */}
        <View style={styles.fabMenu}>
          {/* Scan Button */}
          <FABButton
            icon="scan"
            label="Scan Workout"
            onPress={handleScan}
            color={colors.primary}
            animation={button1Anim}
            delay={0}
            styles={styles}
          />

          {/* Attach Button */}
          <FABButton
            icon="image"
            label="Attach Photo"
            onPress={handleAttach}
            color="#6366f1"
            animation={button2Anim}
            delay={60}
            styles={styles}
          />

          {/* Close Button */}
          <Animated.View
            style={[
              styles.closeButtonContainer,
              {
                opacity: closeOpacity,
                transform: [{ scale: closeScale }],
              },
            ]}
          >
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    </Modal>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 1)',
    },
    fabMenu: {
      position: 'absolute',
      bottom: 24,
      right: 24,
      alignItems: 'flex-end',
      gap: 16,
    },
    fabButtonContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    fabButton: {
      width: 64,
      height: 64,
      borderRadius: 32,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    labelContainer: {
      backgroundColor: colors.white,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 8,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 6,
      elevation: 4,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      whiteSpace: 'nowrap',
    },
    closeButtonContainer: {
      alignSelf: 'center',
    },
    closeButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.white,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 6,
      elevation: 4,
    },
  })
