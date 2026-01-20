import { useThemedColors } from '@/hooks/useThemedColors'
import { Ionicons } from '@expo/vector-icons'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import React from 'react'
import {
    Platform,
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
  title = 'Analysis Complete',
  subtitle = 'Upgrade to Pro to unlock your full body composition and physique breakdown.',
  buttonText = 'Unlock Results',
}: LockedResultsOverlayProps) {
  const colors = useThemedColors()
  const styles = createStyles(colors)

  return (
    <View style={styles.container}>
      {/* Real Blur Effect */}
      <BlurView
        tint={colors.bg === '#f6f6f8' ? 'light' : 'dark'}
        intensity={Platform.OS === 'ios' ? 60 : 80}
        style={StyleSheet.absoluteFill}
      />
      
      {/* Content overlay */}
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <LinearGradient
            colors={[colors.brandPrimary, colors.brandPrimary + 'DD']}
            style={styles.iconGradient}
          >
            <Ionicons name="lock-closed" size={28} color="#FFF" />
          </LinearGradient>
        </View>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        <TouchableOpacity
          style={styles.unlockButtonWrapper}
          onPress={onUnlock}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={[colors.brandPrimary, colors.brandPrimary + 'DD']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.unlockButton}
          >
            <Text style={styles.unlockButtonText}>{buttonText}</Text>
          </LinearGradient>
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
    content: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    iconContainer: {
      width: 72,
      height: 72,
      borderRadius: 36,
      overflow: 'hidden',
      marginBottom: 20,
      shadowColor: colors.brandPrimary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 6,
    },
    iconGradient: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.textPrimary,
      textAlign: 'center',
      marginBottom: 10,
      letterSpacing: -0.5,
    },
    subtitle: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 32,
      paddingHorizontal: 10,
    },
    unlockButtonWrapper: {
      width: '100%',
      maxWidth: 240,
      shadowColor: colors.brandPrimary,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.25,
      shadowRadius: 15,
      elevation: 8,
    },
    unlockButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 28,
      paddingVertical: 16,
      borderRadius: 30,
      gap: 8,
    },
    unlockButtonText: {
      color: '#FFF',
      fontSize: 17,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
  })
}
