import { useThemedColors } from '@/hooks/useThemedColors'
import { Ionicons } from '@expo/vector-icons'
import React, { useEffect, useRef } from 'react'
import { Animated, Easing, StyleSheet, Text, View } from 'react-native'

export function EmptyFeedState() {
  const colors = useThemedColors()

  // Animation values
  const arrowBounce = useRef(new Animated.Value(0)).current
  const arrowOpacity = useRef(new Animated.Value(0)).current
  const textFade = useRef(new Animated.Value(0)).current
  const iconScale = useRef(new Animated.Value(0)).current

  useEffect(() => {
    // Sequence of animations for smooth entry
    Animated.sequence([
      // First fade in the icon with scale
      Animated.parallel([
        Animated.spring(iconScale, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(textFade, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
      // Then show the arrow after a brief delay
      Animated.delay(300),
      Animated.timing(arrowOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start()

    // Continuous bouncing animation for arrow
    Animated.loop(
      Animated.sequence([
        Animated.timing(arrowBounce, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(arrowBounce, {
          toValue: 0,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start()
  }, [arrowBounce, arrowOpacity, textFade, iconScale])

  const arrowTranslateY = arrowBounce.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 12],
  })

  const arrowTranslateX = arrowBounce.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 12],
  })

  const styles = createStyles(colors)

  return (
    <View style={styles.container}>
      {/* Icon and text section */}
      <Animated.View
        style={[
          styles.contentContainer,
          {
            opacity: textFade,
            transform: [{ scale: iconScale }]
          }
        ]}
      >
        <View style={styles.iconContainer}>
          <Ionicons
            name="barbell-outline"
            size={72}
            color={colors.primary}
          />
        </View>
        <Text style={styles.title}>Welcome to Your Feed!</Text>
        <Text style={styles.subtitle}>
          Start tracking your fitness journey
        </Text>
        <Text style={styles.description}>
          Log your first workout to see it appear here
        </Text>
      </Animated.View>

      {/* Animated arrow pointing diagonally to the + button */}
      <Animated.View
        style={[
          styles.arrowContainer,
          {
            opacity: arrowOpacity,
            transform: [
              { translateY: arrowTranslateY },
              { translateX: arrowTranslateX },
            ],
          },
        ]}
      >
        <View style={styles.arrowWrapper}>
          <Animated.View
            style={{
              transform: [{ rotate: '-45deg' }],
            }}
          >
            <Ionicons name="arrow-down" size={48} color={colors.primary} />
          </Animated.View>
        </View>
        <Text style={styles.arrowText}>Tap here to start</Text>
      </Animated.View>
    </View>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
      paddingBottom: 120, // Space above the tab bar
    },
    contentContainer: {
      alignItems: 'center',
      marginBottom: 40,
    },
    iconContainer: {
      width: 128,
      height: 120,
      borderRadius: 60,
      backgroundColor: colors.backgroundLight,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 24,
      borderWidth: 2,
      borderColor: colors.primary,
    },
    title: {
      fontSize: 26,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 17,
      fontWeight: '500',
      color: colors.textSecondary,
      marginBottom: 8,
      textAlign: 'center',
    },
    description: {
      fontSize: 15,
      color: colors.textLight,
      textAlign: 'center',
      lineHeight: 22,
    },
    arrowContainer: {
      alignItems: 'center',
      position: 'absolute',
      bottom: 50, // Position above the + button (tab bar height ~90 + button elevation ~72)
      right: 100, // Positioned more toward center, pointing diagonally to the + button
    },
    arrowWrapper: {
      backgroundColor: colors.backgroundLight,
      borderRadius: 32,
      padding: 8,
      marginBottom: 8,
      borderWidth: 2,
      borderColor: colors.primary,
    },
    arrowText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.primary,
      textAlign: 'center',
    },
  })
