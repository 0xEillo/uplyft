import { useThemedColors } from '@/hooks/useThemedColors'
import { Ionicons } from '@expo/vector-icons'
import React from 'react'
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

type LockedResultsOverlayProps = {
  onUnlock: () => void
  title?: string
  subtitle?: string
  buttonText?: string
}

export function LockedResultsOverlay({
  onUnlock,
  title = 'Your Results Are Ready',
  subtitle = 'Upgrade to Pro to see your body composition analysis',
  buttonText = 'Unlock Results',
}: LockedResultsOverlayProps) {
  const colors = useThemedColors()
  const styles = createStyles(colors)

  return (
    <View style={styles.container}>
      {/* Semi-transparent overlay with blur effect simulation */}
      <View style={styles.blurOverlay} />

      {/* Content overlay */}
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="lock-closed" size={32} color={colors.primary} />
        </View>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        <TouchableOpacity
          style={styles.unlockButton}
          onPress={onUnlock}
          activeOpacity={0.8}
        >
          <Text style={styles.unlockButtonText}>{buttonText}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

function createStyles(colors: ReturnType<typeof useThemedColors>) {
  return StyleSheet.create({
    container: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 16,
      overflow: 'hidden',
    },
    blurOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.background + 'E8', // 91% opacity for blur-like effect
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    iconContainer: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.primaryLight,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 24,
      paddingHorizontal: 16,
    },
    unlockButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 32,
      paddingVertical: 14,
      borderRadius: 28,
    },
    unlockButtonText: {
      color: colors.buttonText,
      fontSize: 16,
      fontWeight: '700',
    },
  })
}
