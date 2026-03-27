import { useThemedColors } from '@/hooks/useThemedColors'
import { Ionicons } from '@expo/vector-icons'
import React, { useEffect, useRef } from 'react'
import { Animated, StyleSheet, Text } from 'react-native'

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap
  title: string
  description?: string
  /** @deprecated no longer rendered */
  buttonText?: string
  /** @deprecated no longer rendered */
  onPress?: () => void
  style?: any
}

export function EmptyState({ icon, title, description, style }: EmptyStateProps) {
  const colors = useThemedColors()
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const styles = createStyles(colors)

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }, style]}>
      {icon && (
        <Ionicons name={icon} size={28} color={colors.textTertiary} style={styles.icon} />
      )}
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
    </Animated.View>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 40,
      paddingVertical: 60,
    },
    icon: {
      marginBottom: 14,
    },
    title: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.textTertiary,
      textAlign: 'center',
      marginBottom: 6,
    },
    description: {
      fontSize: 14,
      color: colors.textTertiary,
      textAlign: 'center',
      lineHeight: 20,
      opacity: 0.7,
    },
  })
