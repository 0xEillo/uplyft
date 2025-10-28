import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { Ionicons } from '@expo/vector-icons'
import { memo, useEffect, useRef } from 'react'
import {
  ActivityIndicator,
  Animated,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native'

interface PlaceholderFeedCardProps {
  userName: string
  userAvatar: string
  workoutTitle: string
  workoutImageUrl?: string | null
}

/**
 * Placeholder feed card shown while workout is being parsed.
 * Shows actual title, photo, and timestamp with skeleton shimmer for exercises.
 */
export const PlaceholderFeedCard = memo(function PlaceholderFeedCard({
  userName,
  userAvatar,
  workoutTitle,
  workoutImageUrl,
}: PlaceholderFeedCardProps) {
  const colors = useThemedColors()
  const { weightUnit } = useWeightUnits()
  const shimmerAnim = useRef(new Animated.Value(0)).current
  const pulseAnim = useRef(new Animated.Value(0)).current
  const imageOpacity = useRef(new Animated.Value(0)).current
  const imageLoading = useRef(true)

  const styles = createStyles(colors)

  // Shimmer animation for skeleton rows
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
    ).start()
  }, [shimmerAnim])

  // Pulse animation for badge
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ]),
    ).start()
  }, [pulseAnim])

  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  })

  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 1],
  })

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          {userAvatar ? (
            <Image source={{ uri: userAvatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{userName[0]}</Text>
            </View>
          )}
          <View>
            <Text style={styles.userName}>{userName}</Text>
            <Text style={styles.timeAgo}>Just now</Text>
          </View>
        </View>
        {/* Analyzing badge with pulse animation */}
        <Animated.View
          style={[styles.analyzingBadge, { opacity: pulseOpacity }]}
        >
          <Ionicons name="sync" size={12} color={colors.primary} />
          <Text style={styles.analyzingText}>Analyzing...</Text>
        </Animated.View>
      </View>

      {/* Workout Title */}
      <Text style={styles.workoutTitle}>{workoutTitle}</Text>

      {/* Workout Image */}
      {workoutImageUrl && (
        <View style={styles.workoutImageContainer}>
          <Animated.Image
            source={{ uri: workoutImageUrl }}
            style={[styles.workoutImage, { opacity: imageOpacity }]}
            resizeMode="cover"
            onLoadStart={() => {
              imageLoading.current = true
            }}
            onLoad={() => {
              imageLoading.current = false
              Animated.timing(imageOpacity, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
              }).start()
            }}
            onError={(error) => {
              console.error(
                'Failed to load placeholder workout image:',
                error.nativeEvent.error,
              )
              imageLoading.current = false
            }}
          />
          {imageLoading.current && (
            <View style={styles.imageLoadingOverlay}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          )}
        </View>
      )}

      {/* Skeleton Exercise Table */}
      <View style={styles.exercisesContainer}>
        {/* Table Header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, styles.exerciseCol]}>
            Exercise
          </Text>
          <Text style={[styles.tableHeaderText, styles.setsCol]}>Sets</Text>
          <Text style={[styles.tableHeaderText, styles.repsCol]}>Reps</Text>
          <Text style={[styles.tableHeaderText, styles.weightCol]}>
            {`Wt (${weightUnit})`}
          </Text>
        </View>
        <View style={styles.headerDivider} />

        {/* Skeleton Rows */}
        {[60, 80, 70].map((width, index) => (
          <View key={index} style={styles.skeletonRow}>
            <Animated.View
              style={[
                styles.skeletonBar,
                styles.skeletonBarLong,
                { opacity: shimmerOpacity, width: `${width}%` },
              ]}
            />
            <Animated.View
              style={[
                styles.skeletonBar,
                styles.skeletonBarShort,
                { opacity: shimmerOpacity },
              ]}
            />
            <Animated.View
              style={[
                styles.skeletonBar,
                styles.skeletonBarShort,
                { opacity: shimmerOpacity },
              ]}
            />
            <Animated.View
              style={[
                styles.skeletonBar,
                styles.skeletonBarShort,
                { opacity: shimmerOpacity },
              ]}
            />
          </View>
        ))}
      </View>

      {/* Footer message */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Parsing your workout and identifying exercises...
        </Text>
      </View>
    </View>
  )
})

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.white,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 2,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    userInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    avatar: {
      width: 41,
      height: 41,
      borderRadius: 21,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: {
      color: colors.white,
      fontSize: 18,
      fontWeight: '600',
    },
    userName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    timeAgo: {
      fontSize: 13,
      color: colors.textTertiary,
      marginTop: 2,
    },
    analyzingBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.primaryLight,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 12,
    },
    analyzingText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary,
    },
    workoutTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    workoutImageContainer: {
      width: '100%',
      aspectRatio: 16 / 9,
      marginBottom: 12,
      borderRadius: 8,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundLight,
      maxHeight: 400,
    },
    workoutImage: {
      width: '100%',
      height: '100%',
    },
    imageLoadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.backgroundLight,
    },
    exercisesContainer: {
      marginBottom: 12,
      borderRadius: 8,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    tableHeader: {
      flexDirection: 'row',
      paddingVertical: 8,
      paddingHorizontal: 4,
      backgroundColor: colors.backgroundLight,
    },
    tableHeaderText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    headerDivider: {
      height: 1,
      backgroundColor: colors.border,
    },
    exerciseCol: {
      flex: 3,
    },
    setsCol: {
      flex: 1,
      textAlign: 'center',
    },
    repsCol: {
      flex: 1.5,
      textAlign: 'center',
    },
    weightCol: {
      flex: 1.5,
      textAlign: 'right',
    },
    skeletonRow: {
      flexDirection: 'row',
      paddingVertical: 12,
      paddingHorizontal: 4,
      backgroundColor: colors.backgroundLight,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      alignItems: 'center',
      gap: 8,
    },
    skeletonBar: {
      height: 12,
      backgroundColor: colors.border,
      borderRadius: 6,
    },
    skeletonBarLong: {
      flex: 3,
    },
    skeletonBarShort: {
      flex: 1,
      minWidth: 30,
    },
    footer: {
      paddingTop: 8,
      alignItems: 'center',
    },
    footerText: {
      fontSize: 13,
      color: colors.textSecondary,
      fontStyle: 'italic',
    },
  })
