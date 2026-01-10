import { useThemedColors } from '@/hooks/useThemedColors'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import React, { useEffect, useRef } from 'react'
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  description?: string
  buttonText?: string
  onPress?: () => void
}

export function EmptyState({ icon, title, description, buttonText, onPress }: EmptyStateProps) {
  const colors = useThemedColors()
  
  // Entrance and floating animations
  const fadeAnim = useRef(new Animated.Value(0)).current
  const floatAnim = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(0.9)).current
  
  useEffect(() => {
    // Entrance
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 20,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start()

    // Continuous floating
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 2500,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2500,
          useNativeDriver: true,
        }),
      ])
    ).start()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- animations are stable refs, run only on mount
  }, [])

  const translateY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -12],
  })

  const styles = createStyles(colors)

  return (
    <Animated.View 
      style={[
        styles.container, 
        { 
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }]
        }
      ]}
    >
      <View style={styles.iconWrapper}>
        <Animated.View style={[styles.glow, { transform: [{ translateY: translateY }] }]} />
        <Animated.View style={{ transform: [{ translateY: translateY }] }}>
          <Ionicons
            name={icon}
            size={80}
            color={colors.primary}
          />
        </Animated.View>
      </View>

      <Text style={styles.title}>{title}</Text>
      
      {description && (
        <Text style={styles.description}>{description}</Text>
      )}

      {buttonText && onPress && (
        <TouchableOpacity 
          activeOpacity={0.8} 
          onPress={onPress}
          style={styles.buttonWrapper}
        >
          <LinearGradient
            colors={[colors.primary, colors.primary + 'CC']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.button}
          >
            <Text style={styles.buttonText}>{buttonText}</Text>
            <Ionicons name="chevron-forward" size={18} color="#FFF" style={styles.buttonIcon} />
          </LinearGradient>
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
      paddingVertical: 60,
    },
    iconWrapper: {
      marginBottom: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    glow: {
      position: 'absolute',
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: colors.primary + '15',
      transform: [{ scale: 1.2 }],
    },
    title: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 12,
      letterSpacing: -0.5,
    },
    description: {
      fontSize: 15,
      fontWeight: '500',
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 32,
      opacity: 0.8,
    },
    buttonWrapper: {
      width: '100%',
      maxWidth: 240,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.25,
      shadowRadius: 15,
      elevation: 8,
    },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 16,
      gap: 8,
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
    buttonIcon: {
      marginTop: 1,
    },
  })
