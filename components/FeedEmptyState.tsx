import { useThemedColors } from '@/hooks/useThemedColors'
import { haptic } from '@/lib/haptics'
import { useRouter } from 'expo-router'
import React, { useEffect, useRef } from 'react'
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

interface FeedEmptyStateProps {
  isOffline?: boolean
}

export function FeedEmptyState({ isOffline }: FeedEmptyStateProps) {
  const colors = useThemedColors()
  const router = useRouter()
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start()
  }, [fadeAnim])

  const styles = createStyles(colors)

  if (isOffline) {
    return (
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        <View style={styles.offlineContainer}>
          <Text style={styles.offlineTitle}>You're offline</Text>
          <Text style={styles.offlineDescription}>
            Your feed will load when you're back online. You can still log workouts and they'll sync automatically.
          </Text>
          <TouchableOpacity
            style={styles.offlineButton}
            onPress={() => {
              haptic('light')
              router.push('/(tabs)/create-post')
            }}
          >
            <Text style={styles.offlineButtonText}>Log a Workout</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    )
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.skeletonContainer}>
        {/* Skeleton Header */}
        <View style={styles.skeletonHeader}>
          <View style={styles.skeletonAvatar} />
          <View style={styles.skeletonTextContainer}>
            <View style={styles.skeletonTextLine1} />
            <View style={styles.skeletonTextLine2} />
          </View>
        </View>
        {/* Skeleton Content */}
        <View style={styles.skeletonContent} />
      </View>

      <Text style={styles.title}>Once you log a workout, it'll show up here.</Text>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            haptic('light')
            router.push('/(tabs)/create-post')
          }}
        >
          <Text style={styles.buttonText}>Start my first workout</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            haptic('light')
            // Navigate to find friends (usually profile or explore/search)
            router.push('/search')
          }}
        >
          <Text style={styles.buttonText}>Find friends to follow</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 60,
    },
    skeletonContainer: {
      width: '100%',
      backgroundColor: colors.surfaceCard,
      borderRadius: 16,
      padding: 16,
      marginBottom: 32,
      // Optional subtle shadow or border if needed, but screenshot looks flat
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    skeletonHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    skeletonAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surfaceSubtle,
    },
    skeletonTextContainer: {
      marginLeft: 12,
      gap: 8,
    },
    skeletonTextLine1: {
      width: 140,
      height: 12,
      borderRadius: 6,
      backgroundColor: colors.surfaceSubtle,
    },
    skeletonTextLine2: {
      width: 90,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.surfaceSubtle,
    },
    skeletonContent: {
      width: '100%',
      height: 200,
      borderRadius: 12,
      backgroundColor: colors.surfaceSubtle,
    },
    title: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 24,
    },
    buttonContainer: {
      width: '100%',
      gap: 12,
    },
    button: {
      width: '100%',
      height: 52,
      backgroundColor: colors.surfaceSubtle,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.textPrimary,
    },
    offlineContainer: {
      alignItems: 'center',
      padding: 20,
      marginTop: 40,
    },
    offlineTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 8,
    },
    offlineDescription: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 24,
      lineHeight: 22,
    },
    offlineButton: {
      paddingHorizontal: 24,
      paddingVertical: 12,
      backgroundColor: colors.brandPrimary,
      borderRadius: 20,
    },
    offlineButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#fff',
    },
  })
