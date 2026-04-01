import { useThemedColors } from '@/hooks/useThemedColors'
import { hapticAsync } from '@/lib/haptics'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import React, { useEffect, useRef, useState } from 'react'
import {
    Animated,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native'

interface ProfilePicPromptModalProps {
  visible: boolean
  onDismiss: () => void
}

export function ProfilePicPromptModal({
  visible,
  onDismiss,
}: ProfilePicPromptModalProps) {
  const colors = useThemedColors()
  const router = useRouter()
  const styles = createStyles(colors)

  const [modalVisible, setModalVisible] = useState(false)
  const fadeAnim = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(0.9)).current

  useEffect(() => {
    if (visible) {
      setModalVisible(true)
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start()
    } else if (modalVisible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.9,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setModalVisible(false)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- animations are stable refs
  }, [visible])

  const handleUpload = async () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      await hapticAsync('medium')
    }
    onDismiss()
    // Small delay to let the modal dismiss animation complete
    setTimeout(() => {
      router.push('/edit-profile')
    }, 350)
  }

  const handleMaybeLater = async () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      await hapticAsync('light')
    }
    onDismiss()
  }

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleMaybeLater}
    >
      <Animated.View
        style={[
          styles.backdrop,
          {
            opacity: fadeAnim,
          },
        ]}
      >
        <Pressable style={styles.backdropPress} onPress={handleMaybeLater}>
          <Animated.View
            style={[
              styles.modalContainer,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <Pressable>
              {/* Icon */}
              <View style={styles.iconContainer}>
                <View style={styles.iconCircle}>
                  <Ionicons name="camera-outline" size={32} color="#FFFFFF" />
                </View>
              </View>

              {/* Headline */}
              <Text style={styles.headline}>Add a Profile Photo</Text>

              {/* Body Text */}
              <Text style={styles.bodyText}>
                You've been putting in the work! Add a profile photo so your
                gym friends can recognise you 📸
              </Text>

              {/* Primary Button */}
              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.primaryButtonPressed,
                ]}
                onPress={handleUpload}
              >
                <Text style={styles.primaryButtonText}>Upload Photo</Text>
                <Ionicons
                  name="arrow-forward"
                  size={18}
                  color="#FFFFFF"
                  style={styles.buttonIcon}
                />
              </Pressable>

              {/* Secondary Button */}
              <Pressable
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.secondaryButtonPressed,
                ]}
                onPress={handleMaybeLater}
              >
                <Text style={styles.secondaryButtonText}>Maybe Later</Text>
              </Pressable>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Animated.View>
    </Modal>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    backdropPress: {
      flex: 1,
      width: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    modalContainer: {
      backgroundColor: colors.bg,
      borderRadius: 20,
      padding: 24,
      width: '100%',
      maxWidth: 400,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.3,
          shadowRadius: 16,
        },
        android: {
          elevation: 12,
        },
      }),
    },
    iconContainer: {
      alignItems: 'center',
      marginBottom: 20,
    },
    iconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.brandPrimary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headline: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.textPrimary,
      textAlign: 'center',
      marginBottom: 12,
    },
    bodyText: {
      fontSize: 16,
      lineHeight: 24,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 32,
    },
    primaryButton: {
      backgroundColor: colors.brandPrimary,
      borderRadius: 12,
      paddingVertical: 16,
      paddingHorizontal: 24,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
    },
    primaryButtonPressed: {
      opacity: 0.8,
      transform: [{ scale: 0.98 }],
    },
    primaryButtonText: {
      fontSize: 17,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    buttonIcon: {
      marginLeft: 8,
    },
    secondaryButton: {
      paddingVertical: 12,
      paddingHorizontal: 24,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
    },
    secondaryButtonPressed: {
      opacity: 0.5,
    },
    secondaryButtonText: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.textSecondary,
    },
  })
