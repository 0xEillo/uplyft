import { useThemedColors } from '@/hooks/useThemedColors'
import { Ionicons } from '@expo/vector-icons'
import React, { useEffect, useRef } from 'react'
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  description?: string
  buttonText?: string
  onPress?: () => void
  style?: any
}

export function EmptyState({ 
  icon, 
  title, 
  description, 
  buttonText, 
  onPress,
  style 
}: EmptyStateProps) {
  const colors = useThemedColors()
  
  // Clean entrance animation
  const fadeAnim = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(10)).current
  
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const styles = createStyles(colors)

  return (
    <Animated.View 
      style={[
        styles.container, 
        { 
          opacity: fadeAnim,
          transform: [{ translateY }]
        },
        style
      ]}
    >
      <View style={styles.iconWrapper}>
        <Ionicons
          name={icon}
          size={42}
          color={colors.brandPrimary}
        />
      </View>

      <Text style={styles.title}>{title}</Text>
      
      {description ? (
        <Text style={styles.description}>{description}</Text>
      ) : (
        <View style={{ height: 16 }} />
      )}

      {buttonText && onPress && (
        <TouchableOpacity 
          activeOpacity={0.7} 
          onPress={onPress}
          style={styles.button}
        >
          <Text style={styles.buttonText}>{buttonText}</Text>
        </TouchableOpacity>
      )}
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
      paddingBottom: 80, // Optical centering - shifts content upward
    },
    iconWrapper: {
      width: 90,
      height: 90,
      borderRadius: 45,
      backgroundColor: colors.brandPrimarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 24,
    },
    title: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.textPrimary,
      textAlign: 'center',
      marginBottom: 12,
      letterSpacing: -0.5,
    },
    description: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 32,
      paddingHorizontal: 20,
    },
    button: {
      backgroundColor: colors.brandPrimary,
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 12,
      shadowColor: colors.brandPrimary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 4,
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '600',
    },
  })
