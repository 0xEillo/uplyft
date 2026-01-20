import { EmptyState } from '@/components/EmptyState'
import { ScreenHeader } from '@/components/screen-header'
import { SlideInView } from '@/components/slide-in-view'
import { AnalyticsEvents } from '@/constants/analytics-events'
import { useAnalytics } from '@/contexts/analytics-context'
import { useAuth } from '@/contexts/auth-context'
import { useTheme } from '@/contexts/theme-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { getRoutineImageUrl } from '@/lib/utils/routine-images'
import { WorkoutRoutineWithDetails } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useFocusEffect, useRouter } from 'expo-router'
import React, { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const { width } = Dimensions.get('window')

export default function RoutinesScreen() {
  const { user } = useAuth()
  const { isDark } = useTheme()
  const colors = useThemedColors()
  const { trackEvent } = useAnalytics()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const [isLoading, setIsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [routines, setRoutines] = useState<WorkoutRoutineWithDetails[]>([])
  const [shouldExit, setShouldExit] = useState(false)

  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark])

  const loadData = useCallback(async () => {
    if (!user?.id) return

    try {
      const routinesData = await database.workoutRoutines.getAll(user.id)
      const activeRoutines = routinesData.filter((r) => !r.is_archived)
      setRoutines(activeRoutines)

      // Preload routine images for faster display
      const imageUrls = activeRoutines
        .map((r) => (r.image_path ? getRoutineImageUrl(r.image_path) : null))
        .filter((url): url is string => url !== null)
      if (imageUrls.length > 0) {
        Image.prefetch(imageUrls)
      }
    } catch (error) {
      console.error('Error loading routines:', error)
      Alert.alert('Error', 'Failed to load routines')
    } finally {
      setIsLoading(false)
      setRefreshing(false)
    }
  }, [user?.id])

  useFocusEffect(
    useCallback(() => {
      trackEvent(AnalyticsEvents.ROUTINE_VIEWED, {
        source: 'routines_screen',
      })
      loadData()
    }, [loadData, trackEvent]),
  )

  const handleBack = useCallback(() => {
    setShouldExit(true)
  }, [])

  const handleExitComplete = useCallback(() => {
    router.back()
  }, [router])

  const handleCreateRoutine = useCallback(() => {
    router.push('/create-routine')
  }, [router])

  const renderRoutineItem = useCallback(
    ({ item, index }: { item: WorkoutRoutineWithDetails; index: number }) => {
      // Use stored tint color or fallback to index-based color
      const tintColors = ['#A3E635', '#22D3EE', '#94A3B8', '#F0ABFC', '#FB923C']
      const tintColor = item.tint_color || tintColors[index % tintColors.length]

      const exerciseCount = item.workout_routine_exercises?.length || 0
      const setCount =
        item.workout_routine_exercises?.reduce(
          (sum, ex) => sum + (ex.sets?.length || 0),
          0,
        ) || 0

      // Get image source from storage bucket based on item's name or image_path
      const getRoutineImage = () => {
        const imagePath = item.image_path || `${item.name}.png`
        return getRoutineImageUrl(imagePath)
      }

      const imageSource = getRoutineImage()

      return (
        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.routineCard}
          onPress={() => {
            trackEvent(AnalyticsEvents.ROUTINE_SELECTED, {
              routine_id: item.id,
              routine_name: item.name,
              exercise_count: exerciseCount,
              source: 'routines_screen',
            })
            router.push({
              pathname: '/routine/[routineId]',
              params: { routineId: item.id },
            })
          }}
        >
          {imageSource ? (
            <>
              <Image
                source={
                  typeof imageSource === 'string'
                    ? { uri: imageSource }
                    : imageSource
                }
                style={styles.routineImage}
                contentFit="cover"
                cachePolicy="memory-disk"
                priority="normal"
                transition={200}
              />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.9)']}
                style={styles.routineOverlay}
              />
              <View
                style={[
                  styles.colorTint,
                  { backgroundColor: tintColor, opacity: 0.25 },
                ]}
              />
            </>
          ) : (
            <LinearGradient
              colors={[tintColor + '40', tintColor + '20']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.routineGradientBg}
            />
          )}

          <View style={styles.routineContent}>
            <Text
              style={[
                styles.routineTitle,
                !imageSource && { color: colors.text },
              ]}
              numberOfLines={2}
            >
              {item.name}
            </Text>
            <View style={styles.routineStats}>
              <View style={styles.routineStatItem}>
                <Ionicons
                  name="barbell-outline"
                  size={12}
                  color={
                    imageSource ? 'rgba(255,255,255,0.8)' : colors.textSecondary
                  }
                />
                <Text
                  style={[
                    styles.routineStatText,
                    !imageSource && { color: colors.textSecondary },
                  ]}
                >
                  {exerciseCount} exercises
                </Text>
              </View>
              <View style={styles.routineStatItem}>
                <Ionicons
                  name="layers-outline"
                  size={12}
                  color={
                    imageSource ? 'rgba(255,255,255,0.8)' : colors.textSecondary
                  }
                />
                <Text
                  style={[
                    styles.routineStatText,
                    !imageSource && { color: colors.textSecondary },
                  ]}
                >
                  {setCount} sets
                </Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      )
    },
    [styles, router, colors, trackEvent],
  )

  return (
    <SlideInView
      style={{ flex: 1 }}
      shouldExit={shouldExit}
      onExitComplete={handleExitComplete}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScreenHeader
          title="Routines"
          onLeftPress={handleBack}
          leftIcon="arrow-back"
          rightIcon="add"
          onRightPress={handleCreateRoutine}
        />

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            routines.length === 0 && !isLoading && { flexGrow: 1 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true)
                loadData()
              }}
              tintColor={colors.primary}
            />
          }
        >
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : routines.length === 0 ? (
            <EmptyState
              icon="barbell-outline"
              title="No routines found"
              description="Create a routine to quickly start your favorite workouts."
              buttonText="Create Your First Routine"
              onPress={handleCreateRoutine}
              style={{ marginTop: -insets.top - 60 }} // Offset for header and section spacing
            />
          ) : (
            <>
              {/* My Routines Section */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>My Routines</Text>
                <Text style={styles.routineCount}>
                  {routines.length} routine
                  {routines.length !== 1 ? 's' : ''}
                </Text>
              </View>

              {/* Routines Grid */}
              <View style={styles.routinesGrid}>
                {routines.map((routine, index) => (
                  <View key={routine.id} style={styles.routineWrapper}>
                    {renderRoutineItem({ item: routine, index })}
                  </View>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </SlideInView>
  )
}

const createStyles = (
  colors: ReturnType<typeof useThemedColors>,
  isDark: boolean,
) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      paddingBottom: 100,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: 200,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      marginBottom: 16,
      marginTop: 24,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    routineCount: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    routinesGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: 20,
      gap: 16,
      paddingTop: 12,
    },
    routineWrapper: {
      width: (width - 56) / 2,
      marginBottom: 8,
    },
    routineCard: {
      height: 200,
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: colors.feedCardBackground,
    },
    routineImage: {
      width: '100%',
      height: '100%',
      position: 'absolute',
    },
    routineGradientBg: {
      ...StyleSheet.absoluteFillObject,
    },
    colorTint: {
      ...StyleSheet.absoluteFillObject,
    },
    routineOverlay: {
      ...StyleSheet.absoluteFillObject,
    },
    routineContent: {
      flex: 1,
      justifyContent: 'flex-end',
      padding: 16,
      paddingBottom: 16,
    },
    routineTitle: {
      color: '#FFF',
      fontSize: 20,
      fontWeight: '800',
      marginBottom: 6,
      letterSpacing: -0.5,
    },
    routineStats: {
      flexDirection: 'row',
      gap: 12,
    },
    routineStatItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    routineStatText: {
      color: 'rgba(255,255,255,0.8)',
      fontSize: 12,
      fontWeight: '600',
    },
  })
