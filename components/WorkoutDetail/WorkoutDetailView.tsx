import { SlideInView } from '@/components/slide-in-view'
import { getColors } from '@/constants/colors'
import { useTheme } from '@/contexts/theme-context'
import { formatTimeAgo } from '@/lib/utils/formatters'
import { getWorkoutMuscleGroups } from '@/lib/utils/muscle-split'
import { WorkoutSessionWithDetails } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import type { Href } from 'expo-router'
import { useLocalSearchParams, useRouter } from 'expo-router'
import React, { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { ExerciseDetailCard } from './ExerciseDetailCard'
import { MuscleSplitChart } from './MuscleSplitChart'
import { WorkoutStatsGrid } from './WorkoutStatsGrid'

interface PrDetailForDisplay {
  label: string
  weight: number
  previousReps?: number
  currentReps: number
  isCurrent: boolean
}

export interface ExercisePRInfo {
  exerciseName: string
  prSetIndices: Set<number>
  prLabels: string[]
  prDetails: PrDetailForDisplay[]
  hasCurrentPR: boolean
}

interface WorkoutDetailViewProps {
  workout: WorkoutSessionWithDetails | null
  prInfo?: ExercisePRInfo[]
  // Social props
  likeCount?: number
  commentCount?: number
  isLiked?: boolean
  onLike?: () => void
  onComment?: () => void
  onShare?: () => void
  // Action props
  onEdit?: () => void
  onDelete?: () => void
  onCreateRoutine?: () => void
  // Loading state
  isLoading?: boolean
}

export function WorkoutDetailView({
  workout,
  prInfo = [],
  likeCount = 0,
  commentCount = 0,
  isLiked = false,
  onLike,
  onComment,
  onShare,
  onEdit,
  onDelete,
  onCreateRoutine,
  isLoading = false,
}: WorkoutDetailViewProps) {
  const { isDark } = useTheme()
  const colors = getColors(isDark)
  const router = useRouter()
  const params = useLocalSearchParams<{ returnTo?: string }>()
  const [menuVisible, setMenuVisible] = useState(false)
  const [shouldExit, setShouldExit] = useState(false)
  const normalizedReturnTo = useMemo(() => {
    const raw = params.returnTo
    if (!raw) return undefined
    const value = Array.isArray(raw) ? raw[0] : raw
    if (!value) return undefined
    try {
      const decoded = decodeURIComponent(value)
      if (decoded.startsWith('http')) {
        console.warn(
          '[WorkoutDetail] Ignoring external returnTo param:',
          decoded,
        )
        return undefined
      }
      return decoded.startsWith('/') ? decoded : `/${decoded}`
    } catch (error) {
      console.warn(
        '[WorkoutDetail] Failed to decode returnTo param:',
        value,
        error,
      )
      return undefined
    }
  }, [params.returnTo])

  // Get workout metadata
  const muscleGroups = workout ? getWorkoutMuscleGroups(workout) : ''
  const workoutTitle = workout?.type || muscleGroups || 'Workout'
  const timeAgo = workout ? formatTimeAgo(workout.created_at) : ''
  const profile = workout?.profile

  const handleBack = () => {
    // Trigger exit animation first
    setShouldExit(true)
  }

  const handleExitComplete = () => {
    // Prefer native back navigation to preserve the existing stack + animations
    if (router.canGoBack()) {
      router.back()
      return
    }

    // If there's no stack history (deep link, notification, etc), fall back to the provided target
    if (normalizedReturnTo) {
      router.replace(normalizedReturnTo as Href)
      return
    }

    router.replace('/(tabs)')
  }

  const handleUserPress = () => {
    if (workout?.user_id) {
      router.push(`/user/${workout.user_id}`)
    }
  }

  const handleDelete = () => {
    Alert.alert(
      'Delete Workout',
      'Are you sure you want to delete this workout? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setMenuVisible(false)
            onDelete?.()
          },
        },
      ],
    )
  }

  return (
    <SlideInView
      style={styles.container}
      shouldExit={shouldExit}
      onExitComplete={handleExitComplete}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: colors.backgroundWhite,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Workout Detail
          </Text>
          <TouchableOpacity
            onPress={() => setMenuVisible(!menuVisible)}
            style={styles.menuButton}
          >
            <Ionicons
              name="ellipsis-horizontal"
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>
        </View>

        {/* Menu dropdown */}
        {menuVisible && (
          <View
            style={[
              styles.menuDropdown,
              {
                backgroundColor: colors.backgroundWhite,
                borderColor: colors.border,
              },
            ]}
          >
            {onEdit && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setMenuVisible(false)
                  onEdit()
                }}
              >
                <Ionicons name="create-outline" size={20} color={colors.text} />
                <Text style={[styles.menuItemText, { color: colors.text }]}>
                  Edit
                </Text>
              </TouchableOpacity>
            )}
            {onCreateRoutine && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setMenuVisible(false)
                  onCreateRoutine()
                }}
              >
                <Ionicons name="albums-outline" size={20} color={colors.text} />
                <Text style={[styles.menuItemText, { color: colors.text }]}>
                  Save as Routine
                </Text>
              </TouchableOpacity>
            )}
            {onDelete && (
              <TouchableOpacity style={styles.menuItem} onPress={handleDelete}>
                <Ionicons name="trash-outline" size={20} color={colors.error} />
                <Text style={[styles.menuItemText, { color: colors.error }]}>
                  Delete
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {isLoading ? (
          <ScrollView style={styles.scrollView}>
            <View
              style={[
                styles.topCard,
                {
                  backgroundColor: colors.backgroundWhite,
                  borderBottomColor: colors.border,
                },
              ]}
            >
              {/* Loading skeleton */}
              <View style={styles.userInfo}>
                <View
                  style={[
                    styles.skeletonAvatar,
                    { backgroundColor: colors.backgroundLight },
                  ]}
                />
                <View style={styles.userDetails}>
                  <View
                    style={[
                      styles.skeletonText,
                      styles.skeletonName,
                      { backgroundColor: colors.backgroundLight },
                    ]}
                  />
                  <View
                    style={[
                      styles.skeletonText,
                      styles.skeletonTime,
                      { backgroundColor: colors.backgroundLight },
                    ]}
                  />
                </View>
              </View>

              <View style={styles.titleSection}>
                <View
                  style={[
                    styles.skeletonText,
                    styles.skeletonTitle,
                    { backgroundColor: colors.backgroundLight },
                  ]}
                />
                <View
                  style={[
                    styles.skeletonText,
                    styles.skeletonNotes,
                    { backgroundColor: colors.backgroundLight },
                  ]}
                />
              </View>

              {/* Loading indicator */}
              <View style={styles.loadingIndicator}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            </View>
          </ScrollView>
        ) : workout ? (
          <ScrollView style={styles.scrollView}>
            {/* Top Card: Profile + Stats + Social Actions */}
            <View
              style={[
                styles.topCard,
                {
                  backgroundColor: colors.backgroundWhite,
                  borderBottomColor: colors.border,
                },
              ]}
            >
              {/* User info */}
              <TouchableOpacity
                onPress={handleUserPress}
                style={styles.userInfo}
              >
                {profile?.avatar_url ? (
                  <Image
                    source={{ uri: profile.avatar_url }}
                    style={styles.avatar}
                  />
                ) : (
                  <View
                    style={[
                      styles.avatar,
                      {
                        backgroundColor: colors.primary,
                        justifyContent: 'center',
                        alignItems: 'center',
                      },
                    ]}
                  >
                    <Text style={[styles.avatarText, { color: colors.white }]}>
                      {profile?.display_name?.[0]?.toUpperCase() || 'U'}
                    </Text>
                  </View>
                )}
                <View style={styles.userDetails}>
                  <Text style={[styles.userName, { color: colors.text }]}>
                    {profile?.display_name || 'User'}
                  </Text>
                  <Text
                    style={[styles.timeAgo, { color: colors.textSecondary }]}
                  >
                    {timeAgo}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Workout title */}
              <View style={styles.titleSection}>
                <Text style={[styles.workoutTitle, { color: colors.text }]}>
                  {workoutTitle}
                </Text>
                {workout.notes && (
                  <Text
                    style={[
                      styles.workoutNotes,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {workout.notes}
                  </Text>
                )}
              </View>

              {/* Stats grid */}
              <View style={styles.statsContainer}>
                <WorkoutStatsGrid workout={workout} />
              </View>

              {/* Social actions bar */}
              <View
                style={[styles.socialBar, { borderTopColor: colors.border }]}
              >
                <TouchableOpacity
                  style={styles.socialButton}
                  onPress={onLike}
                  disabled={!onLike}
                >
                  <Ionicons
                    name={isLiked ? 'thumbs-up' : 'thumbs-up-outline'}
                    size={20}
                    color={isLiked ? colors.primary : colors.icon}
                  />
                  {likeCount > 0 && (
                    <Text
                      style={[
                        styles.socialCount,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {likeCount}
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.socialButton}
                  onPress={onComment}
                  disabled={!onComment}
                >
                  <Ionicons
                    name="chatbubble-outline"
                    size={20}
                    color={colors.icon}
                  />
                  {commentCount > 0 && (
                    <Text
                      style={[
                        styles.socialCount,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {commentCount}
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.socialButton}
                  onPress={onShare}
                  disabled={!onShare}
                >
                  <Ionicons
                    name="share-outline"
                    size={20}
                    color={colors.icon}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Muscle split chart */}
            <MuscleSplitChart workout={workout} />

            {/* Exercise list */}
            <View
              style={[
                styles.exercisesSection,
                { backgroundColor: colors.backgroundWhite },
              ]}
            >
              <Text
                style={[styles.sectionTitle, { color: colors.textSecondary }]}
              >
                Workout
              </Text>
              {workout?.workout_exercises.map((workoutExercise, index) => {
                const exercisePR = prInfo.find(
                  (pr) => pr.exerciseName === workoutExercise.exercise?.name,
                )
                return (
                  <ExerciseDetailCard
                    key={workoutExercise.id || index}
                    workoutExercise={workoutExercise}
                    prInfo={exercisePR}
                  />
                )
              })}
            </View>
          </ScrollView>
        ) : null}
      </View>
    </SlideInView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  menuButton: {
    padding: 4,
  },
  menuDropdown: {
    position: 'absolute',
    top: 100,
    right: 16,
    borderRadius: 8,
    borderWidth: 1,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  menuItemText: {
    fontSize: 15,
  },
  scrollView: {
    flex: 1,
  },
  topCard: {
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 0,
    borderBottomWidth: 1,
    marginBottom: 0,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  timeAgo: {
    fontSize: 13,
  },
  titleSection: {
    marginBottom: 0,
  },
  workoutTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  workoutNotes: {
    fontSize: 14,
    lineHeight: 20,
  },
  statsContainer: {
    marginHorizontal: -16,
  },
  socialBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 14,
    paddingBottom: 10,
    marginHorizontal: -16,
    marginTop: 12,
    borderTopWidth: 1,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  socialCount: {
    fontSize: 13,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  exercisesSection: {},
  // Loading skeleton styles
  skeletonAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  skeletonText: {
    height: 12,
    borderRadius: 6,
  },
  skeletonName: {
    width: 120,
    marginBottom: 8,
  },
  skeletonTime: {
    width: 80,
  },
  skeletonTitle: {
    height: 24,
    width: '70%',
    marginBottom: 12,
    borderRadius: 8,
  },
  skeletonNotes: {
    height: 14,
    width: '90%',
    borderRadius: 6,
  },
  loadingIndicator: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
